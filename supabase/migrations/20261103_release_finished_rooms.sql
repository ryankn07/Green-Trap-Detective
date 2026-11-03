-- Release admission immediately at GAME_OVER while clients collect the ending.
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
  select r.version, r.payload#>>'{rooms,0,state,phase}' into old_version,old_phase from green_trap_trial.rooms r where r.code = room_code for update;
  if request_id is not null then
    select p.* into previous from green_trap_trial.receipts p where p.scope = scope_hash and p.request_id = game_trial_commit.request_id;
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
