-- Isolated game storage; no existing application table is changed.
create schema if not exists green_trap_private;
revoke all on schema green_trap_private from public, anon, authenticated;
create table if not exists green_trap_private.snapshot (
  singleton boolean primary key default true check (singleton),
  revision bigint not null check (revision >= 0),
  writer uuid,
  payload jsonb not null
);
revoke all on green_trap_private.snapshot from public, anon, authenticated;
alter table green_trap_private.snapshot enable row level security;
insert into green_trap_private.snapshot(singleton, revision, payload)
values (true, 0, '{"version":1,"rooms":[]}'::jsonb) on conflict (singleton) do nothing;

-- Claim and read happen in the same row-locked update; claiming does not change data.
create or replace function public.game_snapshot_claim(writer_token uuid) returns jsonb
language sql security definer set search_path = '' as $$
  update green_trap_private.snapshot set writer = writer_token
  where singleton = true and writer_token is not null
  returning jsonb_build_object('revision', revision, 'snapshot', payload);
$$;
create or replace function public.game_snapshot_verify(writer_token uuid, expected_revision bigint) returns jsonb
language sql security definer set search_path = '' as $$
  select jsonb_build_object('revision', revision) from green_trap_private.snapshot
  where singleton = true and writer = writer_token and revision = expected_revision;
$$;
create or replace function public.game_snapshot_compare_and_swap(writer_token uuid, expected_revision bigint, new_snapshot jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare updated_revision bigint;
begin
  if jsonb_typeof(new_snapshot) is distinct from 'object' or new_snapshot->>'version' is distinct from '1' or jsonb_typeof(new_snapshot->'rooms') is distinct from 'array' then
    raise exception 'Invalid snapshot';
  end if;
  update green_trap_private.snapshot set revision = revision + 1, payload = new_snapshot
    where singleton = true and writer = writer_token and revision = expected_revision returning revision into updated_revision;
  if updated_revision is null then raise exception 'Snapshot writer or revision conflict'; end if;
  return jsonb_build_object('revision', updated_revision);
end;
$$;
revoke all on function public.game_snapshot_claim(uuid) from public, anon, authenticated;
revoke all on function public.game_snapshot_verify(uuid,bigint) from public, anon, authenticated;
revoke all on function public.game_snapshot_compare_and_swap(uuid,bigint,jsonb) from public, anon, authenticated;
grant execute on function public.game_snapshot_claim(uuid) to service_role;
grant execute on function public.game_snapshot_verify(uuid,bigint) to service_role;
grant execute on function public.game_snapshot_compare_and_swap(uuid,bigint,jsonb) to service_role;
