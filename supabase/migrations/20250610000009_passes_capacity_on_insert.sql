-- 808Tix MVP: block pass issuance when event is at capacity

create or replace function public.prevent_pass_over_capacity()
returns trigger
language plpgsql
as $$
declare
  v_capacity integer;
  v_issued bigint;
begin
  select e.capacity
  into v_capacity
  from public.events e
  where e.id = new.event_id;

  if v_capacity is null then
    raise exception 'Event not found'
      using errcode = '23503';
  end if;

  v_issued := public.event_issued_pass_count(new.event_id);

  if v_issued >= v_capacity then
    raise exception 'Event is at capacity (% of % passes issued)', v_issued, v_capacity
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger passes_prevent_over_capacity
  before insert on public.passes
  for each row
  execute function public.prevent_pass_over_capacity();
