-- Additive preview storage. Does not read, claim or change green_trap_private.snapshot.
create schema if not exists green_trap_trial;
revoke all on schema green_trap_trial from public, anon, authenticated;
create table if not exists green_trap_trial.rooms (
  code text primary key check (code ~ '^[A-Z2-9]{6}$'),
  version bigint not null check (version > 0),
  payload jsonb not null,
  expires_at timestamptz not null
);
create table if not exists green_trap_trial.receipts (
  scope text not null,
  request_id uuid not null,
  request_hash text not null,
  response jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  primary key (scope, request_id)
);
create table if not exists green_trap_trial.rate_buckets (
  source text not null,
  operation text not null,
  bucket_window bigint not null,
  hits integer not null,
  primary key (source, operation, bucket_window)
);
create index if not exists trial_room_expiry on green_trap_trial.rooms(expires_at);
create index if not exists trial_receipt_expiry on green_trap_trial.receipts(created_at);
create index if not exists trial_rate_expiry on green_trap_trial.rate_buckets(bucket_window);
alter table green_trap_trial.rooms enable row level security;
alter table green_trap_trial.receipts enable row level security;
alter table green_trap_trial.rate_buckets enable row level security;
revoke all on all tables in schema green_trap_trial from public, anon, authenticated;

create or replace function public.game_trial_limit(source_hash text, operation text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare bucket bigint := floor(extract(epoch from clock_timestamp()) / 60); maximum integer; count_hits integer;
begin
  if source_hash is null or source_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid source'; end if;
  maximum := case operation when 'create' then 30 when 'join' then 180 when 'api' then 3000 when 'state' then 120 when 'action' then 60 else null end;
  if maximum is null then raise exception 'Invalid operation'; end if;
  delete from green_trap_trial.rate_buckets where bucket_window < bucket - 1;
  delete from green_trap_trial.receipts where created_at < clock_timestamp() - interval '1 hour';
  delete from green_trap_trial.rooms where code in (
    select r.code from green_trap_trial.rooms r where r.expires_at <= clock_timestamp() order by r.expires_at limit 100
  );
  insert into green_trap_trial.rate_buckets as b(source, operation, bucket_window, hits)
    values (source_hash, operation, bucket, 1)
    on conflict on constraint rate_buckets_pkey do update set hits = least(b.hits + 1, maximum + 1)
    returning hits into count_hits;
  return jsonb_build_object('allowed', count_hits <= maximum);
end;
$$;
create or replace function public.game_trial_read(room_code text, scope_hash text, request_id uuid) returns jsonb
language sql security definer set search_path = '' as $$
  select jsonb_build_object(
    'now', floor(extract(epoch from clock_timestamp()) * 1000),
    'record', (select jsonb_build_object('version', r.version, 'payload', r.payload) from green_trap_trial.rooms r where r.code = room_code and r.expires_at > clock_timestamp()),
    'receipt', (select jsonb_build_object('requestHash', p.request_hash, 'response', p.response) from green_trap_trial.receipts p where p.scope = scope_hash and p.request_id = game_trial_read.request_id and p.created_at > clock_timestamp() - interval '1 hour')
  );
$$;
create or replace function public.game_trial_commit(
  room_code text, expected_version bigint, new_payload jsonb, scope_hash text,
  request_id uuid, request_hash text, public_response jsonb, source_hash text, operation text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare old_version bigint; previous green_trap_trial.receipts%rowtype; room_count integer; seat_count integer; source_rooms integer; source_seats integer;
begin
  if room_code is null or room_code !~ '^[A-Z2-9]{6}$' or expected_version < 0 or source_hash is null or source_hash !~ '^[a-f0-9]{64}$' or operation not in ('create', 'join', 'write') then raise exception 'Invalid commit'; end if;
  if request_id is not null and (scope_hash is null or scope_hash !~ '^[a-f0-9]{64}$' or request_hash is null or request_hash !~ '^[a-f0-9]{64}$' or public_response is null) then raise exception 'Invalid receipt'; end if;
  if new_payload is not null and (
    jsonb_typeof(new_payload) is distinct from 'object' or new_payload->>'version' is distinct from '1'
    or jsonb_typeof(new_payload->'rooms') is distinct from 'array' or jsonb_array_length(new_payload->'rooms') is distinct from 1
    or new_payload#>>'{rooms,0,code}' is distinct from room_code
    or jsonb_typeof(new_payload#>'{rooms,0,players}') is distinct from 'array'
    or jsonb_array_length(new_payload#>'{rooms,0,players}') < 1
  ) then raise exception 'Invalid payload'; end if;
  -- Serialize admission checks only. Different rooms' normal commands remain independent.
  if operation in ('create', 'join') then perform pg_catalog.pg_advisory_xact_lock(107902, 1); end if;
  select r.version into old_version from green_trap_trial.rooms r where r.code = room_code for update;
  if request_id is not null then
    select p.* into previous from green_trap_trial.receipts p where p.scope = scope_hash and p.request_id = game_trial_commit.request_id;
    if found then return jsonb_build_object('receipt', jsonb_build_object('requestHash', previous.request_hash, 'response', previous.response)); end if;
  end if;
  if coalesce(old_version, 0) <> expected_version then return '{"conflict":true}'::jsonb; end if;
  if operation in ('create', 'join') then
    select count(*),
      count(*) filter (where r.payload#>>'{rooms,0,admissionSource}' = source_hash)
      into room_count, source_rooms from green_trap_trial.rooms r where r.expires_at > clock_timestamp();
    select count(*) into seat_count from green_trap_trial.rooms r
      cross join lateral jsonb_array_elements(r.payload#>'{rooms,0,players}') p
      where r.expires_at > clock_timestamp() and coalesce(p->>'removed','false') <> 'true';
    select count(*) into source_seats from green_trap_trial.rooms r
      cross join lateral jsonb_array_elements(r.payload#>'{rooms,0,players}') p
      where r.expires_at > clock_timestamp() and p->>'admissionSource' = source_hash and coalesce(p->>'removed','false') <> 'true';
    if seat_count >= 1200 or (operation = 'create' and room_count >= 100) then return '{"error":"SERVER_BUSY"}'::jsonb; end if;
    if source_seats >= 300 or (operation = 'create' and source_rooms >= 10) then return '{"error":"ADMISSION_LIMIT"}'::jsonb; end if;
  end if;
  if new_payload is null then delete from green_trap_trial.rooms r where r.code = room_code;
  elsif old_version is null then
    insert into green_trap_trial.rooms(code, version, payload, expires_at) values (room_code, 1, new_payload, clock_timestamp() + interval '4 hours');
  else
    update green_trap_trial.rooms r set version = old_version + 1, payload = new_payload, expires_at = clock_timestamp() + interval '4 hours' where r.code = room_code;
  end if;
  if request_id is null then return '{"committed":true}'::jsonb; end if;
  insert into green_trap_trial.receipts(scope, request_id, request_hash, response) values (scope_hash, request_id, request_hash, public_response);
  return jsonb_build_object('receipt', jsonb_build_object('requestHash', request_hash, 'response', public_response));
end;
$$;
revoke all on function public.game_trial_limit(text,text) from public, anon, authenticated;
revoke all on function public.game_trial_read(text,text,uuid) from public, anon, authenticated;
revoke all on function public.game_trial_commit(text,bigint,jsonb,text,uuid,text,jsonb,text,text) from public, anon, authenticated;
grant execute on function public.game_trial_limit(text,text) to service_role;
grant execute on function public.game_trial_read(text,text,uuid) to service_role;
grant execute on function public.game_trial_commit(text,bigint,jsonb,text,uuid,text,jsonb,text,text) to service_role;
