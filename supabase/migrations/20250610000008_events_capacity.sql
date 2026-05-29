-- 808Tix MVP: event pass capacity (max passes issuable per event)

-- Passes that consume capacity: active + checked_in (voided excluded)

create or replace function public.event_issued_pass_count(p_event_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.passes
  where event_id = p_event_id
    and status in ('active', 'checked_in');
$$;

revoke all on function public.event_issued_pass_count(uuid) from public;
grant execute on function public.event_issued_pass_count(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Column + backfill
-- ---------------------------------------------------------------------------
alter table public.events
  add column capacity integer;

update public.events e
set capacity = greatest(
  1,
  coalesce(public.event_issued_pass_count(e.id), 0)
);

alter table public.events
  alter column capacity set not null;

alter table public.events
  add constraint events_capacity_positive check (capacity > 0);

-- ---------------------------------------------------------------------------
-- Capacity cannot drop below issued pass count
-- ---------------------------------------------------------------------------
create or replace function public.prevent_event_capacity_below_issued()
returns trigger
language plpgsql
as $$
declare
  v_issued integer;
begin
  if new.capacity is distinct from old.capacity and new.capacity < old.capacity then
    v_issued := public.event_issued_pass_count(new.id);

    if new.capacity < v_issued then
      raise exception 'Capacity cannot be less than issued passes (%)', v_issued
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

create trigger events_prevent_capacity_below_issued
  before update of capacity on public.events
  for each row
  execute function public.prevent_event_capacity_below_issued();
