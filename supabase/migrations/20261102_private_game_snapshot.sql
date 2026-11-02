-- Isolated game storage. Execute as the project owner; no existing table is changed.
create schema if not exists green_trap_private;
revoke all on schema green_trap_private from public, anon, authenticated;
create table if not exists green_trap_private.snapshot (
  singleton boolean primary key default true check (singleton),
  revision bigint not null check (revision >= 0),
  payload jsonb not null
);
revoke all on green_trap_private.snapshot from public, anon, authenticated;
alter table green_trap_private.snapshot enable row level security;
insert into green_trap_private.snapshot(singleton, revision, payload)
values (true, 0, '{"version":1,"rooms":[]}'::jsonb) on conflict (singleton) do nothing;

create or replace function public.game_snapshot_load() returns jsonb
language sql security definer set search_path = '' as $$
  select jsonb_build_object('revision', revision, 'snapshot', payload)
  from green_trap_private.snapshot where singleton = true;
$$;
create or replace function public.game_snapshot_compare_and_swap(expected_revision bigint, new_snapshot jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare updated_revision bigint;
begin
  if jsonb_typeof(new_snapshot) is distinct from 'object' or new_snapshot->>'version' is distinct from '1' or jsonb_typeof(new_snapshot->'rooms') is distinct from 'array' then
    raise exception 'Invalid snapshot';
  end if;
  update green_trap_private.snapshot set revision = revision + 1, payload = new_snapshot
    where singleton = true and revision = expected_revision returning revision into updated_revision;
  if updated_revision is null then raise exception 'Snapshot revision conflict'; end if;
  return jsonb_build_object('revision', updated_revision);
end;
$$;
revoke all on function public.game_snapshot_load() from public, anon, authenticated;
revoke all on function public.game_snapshot_compare_and_swap(bigint,jsonb) from public, anon, authenticated;
grant execute on function public.game_snapshot_load() to service_role;
grant execute on function public.game_snapshot_compare_and_swap(bigint,jsonb) to service_role;
