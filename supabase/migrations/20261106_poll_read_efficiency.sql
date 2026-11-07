-- Additive rollout: old Functions still use limit/read; new Functions use
-- read_limited. Both retain the same quotas, private receipts and expiry checks.
create table if not exists green_trap_trial.maintenance (
  singleton boolean primary key default true check (singleton),
  cleaned_minute bigint not null
);
insert into green_trap_trial.maintenance(singleton, cleaned_minute)
  values (true, -1) on conflict (singleton) do nothing;
alter table green_trap_trial.maintenance enable row level security;
revoke all on green_trap_trial.maintenance from public, anon, authenticated;

create or replace function green_trap_trial.prune_expired() returns void
language plpgsql security definer set search_path = '' as $$
declare bucket bigint := floor(extract(epoch from clock_timestamp()) / 60);
begin
  -- Normal polls only read this singleton. A single cleaner works once/minute;
  -- concurrent readers never wait for cleanup's advisory lock.
  if exists (select 1 from green_trap_trial.maintenance where singleton and cleaned_minute >= bucket) then return; end if;
  if not pg_catalog.pg_try_advisory_xact_lock(107902, 2) then return; end if;
  update green_trap_trial.maintenance set cleaned_minute = bucket
    where singleton and cleaned_minute < bucket;
  if not found then return; end if;
  delete from green_trap_trial.rate_buckets where bucket_window < bucket - 1;
  delete from green_trap_trial.receipts where created_at < clock_timestamp() - interval '1 hour';
  delete from green_trap_trial.rooms where expires_at <= clock_timestamp() and code in (
    select r.code from green_trap_trial.rooms r where r.expires_at <= clock_timestamp()
    order by r.expires_at limit 100
  );
end;
$$;
revoke all on function green_trap_trial.prune_expired() from public, anon, authenticated;

create or replace function public.game_trial_limit(source_hash text, operation text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare bucket bigint := floor(extract(epoch from clock_timestamp()) / 60); maximum integer; count_hits integer;
begin
  if source_hash is null or source_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid source'; end if;
  maximum := case operation when 'create' then 30 when 'join' then 180 when 'api' then 3000 when 'state' then 120 when 'action' then 60 else null end;
  if maximum is null then raise exception 'Invalid operation'; end if;
  perform green_trap_trial.prune_expired();
  insert into green_trap_trial.rate_buckets as b(source, operation, bucket_window, hits)
    values (source_hash, operation, bucket, 1)
    on conflict on constraint rate_buckets_pkey do update set hits = least(b.hits + 1, maximum + 1)
    returning hits into count_hits;
  return jsonb_build_object('allowed', count_hits <= maximum);
end;
$$;
revoke all on function public.game_trial_limit(text,text) from public, anon, authenticated;
grant execute on function public.game_trial_limit(text,text) to service_role;

create or replace function public.game_trial_read_limited(
  room_code text, scope_hash text, request_id uuid, source_hash text,
  source_operation text, session_operation text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if source_operation is null or source_operation not in ('create', 'join', 'api') then raise exception 'Invalid source operation'; end if;
  if session_operation is not null and (session_operation not in ('state', 'action') or source_operation <> 'api') then raise exception 'Invalid session operation'; end if;
  if scope_hash is null or scope_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid scope'; end if;
  result := public.game_trial_limit(source_hash, source_operation);
  if result->>'allowed' <> 'true' then return result; end if;
  if session_operation is not null then
    result := public.game_trial_limit(scope_hash, session_operation);
    if result->>'allowed' <> 'true' then return result; end if;
  end if;
  return public.game_trial_read(room_code, scope_hash, request_id) || '{"allowed":true}'::jsonb;
end;
$$;
revoke all on function public.game_trial_read_limited(text,text,uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.game_trial_read_limited(text,text,uuid,text,text,text) to service_role;

-- Targeted expiry checks remain mandatory when global cleanup is throttled.
create or replace function public.game_trial_commit(
  room_code text, expected_version bigint, new_payload jsonb, scope_hash text,
  request_id uuid, request_hash text, public_response jsonb, source_hash text, operation text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare old_version bigint; old_phase text; previous green_trap_trial.receipts%rowtype; room_count integer; seat_count integer; source_rooms integer; source_seats integer;
  room_expiry timestamptz;
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
  delete from green_trap_trial.rooms r where r.code = room_code and r.expires_at <= clock_timestamp();
  if request_id is not null then
    delete from green_trap_trial.receipts p where p.scope = scope_hash and p.request_id = game_trial_commit.request_id
      and p.created_at <= clock_timestamp() - interval '1 hour';
  end if;
  select r.version, r.payload#>>'{rooms,0,state,phase}' into old_version,old_phase from green_trap_trial.rooms r where r.code = room_code for update;
  if request_id is not null then
    select p.* into previous from green_trap_trial.receipts p where p.scope = scope_hash and p.request_id = game_trial_commit.request_id and p.created_at > clock_timestamp() - interval '1 hour';
    if found then return jsonb_build_object('receipt', jsonb_build_object('requestHash', previous.request_hash, 'response', previous.response)); end if;
  end if;
  if coalesce(old_version, 0) <> expected_version then return '{"conflict":true}'::jsonb; end if;
  if old_phase='GAME_OVER' and new_payload is not null and new_payload#>>'{rooms,0,state,phase}' is distinct from 'GAME_OVER' then return '{"conflict":true}'::jsonb; end if;
  if operation in ('create', 'join') then
    select count(*),
      count(*) filter (where r.payload#>>'{rooms,0,admissionSource}' = source_hash)
      into room_count, source_rooms from green_trap_trial.rooms r where r.expires_at > clock_timestamp() and r.payload#>>'{rooms,0,state,phase}' is distinct from 'GAME_OVER';
    select count(*) into seat_count from green_trap_trial.rooms r
      cross join lateral jsonb_array_elements(r.payload#>'{rooms,0,players}') p
      where r.expires_at > clock_timestamp() and r.payload#>>'{rooms,0,state,phase}' is distinct from 'GAME_OVER' and coalesce(p->>'removed','false') <> 'true';
    select count(*) into source_seats from green_trap_trial.rooms r
      cross join lateral jsonb_array_elements(r.payload#>'{rooms,0,players}') p
      where r.expires_at > clock_timestamp() and r.payload#>>'{rooms,0,state,phase}' is distinct from 'GAME_OVER' and p->>'admissionSource' = source_hash and coalesce(p->>'removed','false') <> 'true';
    if seat_count >= 1200 or (operation = 'create' and room_count >= 100) then return '{"error":"SERVER_BUSY"}'::jsonb; end if;
    if source_seats >= 300 or (operation = 'create' and source_rooms >= 10) then return '{"error":"ADMISSION_LIMIT"}'::jsonb; end if;
  end if;
  -- Keep a short delivery window for clients polling independently.
  room_expiry := clock_timestamp() + interval '4 hours';
  if new_payload#>>'{rooms,0,state,phase}' = 'GAME_OVER' and new_payload->>'completionProtocol'='1' then
    room_expiry := clock_timestamp() + interval '2 minutes';
    select least(room_expiry, r.expires_at) into room_expiry
      from green_trap_trial.rooms r where r.code = room_code;
    room_expiry := coalesce(room_expiry, clock_timestamp() + interval '2 minutes');
  end if;
  if new_payload is null then delete from green_trap_trial.rooms r where r.code = room_code;
  elsif old_version is null then
    insert into green_trap_trial.rooms(code, version, payload, expires_at) values (room_code, 1, new_payload, room_expiry);
  else
    update green_trap_trial.rooms r set version = old_version + 1, payload = new_payload, expires_at = room_expiry where r.code = room_code;
  end if;
  if request_id is null then return '{"committed":true}'::jsonb; end if;
  insert into green_trap_trial.receipts(scope, request_id, request_hash, response) values (scope_hash, request_id, request_hash, public_response);
  return jsonb_build_object('receipt', jsonb_build_object('requestHash', request_hash, 'response', public_response));
end;
$$;

-- Legacy rooms keep their existing delivery window during rollout. Only rooms
-- whose clients advertise cached-ending support opt into the shorter expiry.
revoke all on function public.game_trial_commit(text,bigint,jsonb,text,uuid,text,jsonb,text,text) from public, anon, authenticated;
grant execute on function public.game_trial_commit(text,bigint,jsonb,text,uuid,text,jsonb,text,text) to service_role;
