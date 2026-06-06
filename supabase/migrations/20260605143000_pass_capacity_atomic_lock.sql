-- 808Tix: atomic pass capacity enforcement under concurrent inserts.
--
-- Without row locking, two simultaneous pass inserts can both read the same
-- issued count and exceed capacity. SELECT ... FOR UPDATE on the parent event
-- serializes issuance per event within the insert transaction.

create or replace function public.prevent_pass_over_capacity()
returns trigger
language plpgsql
as $$
declare
  v_capacity integer;
  v_issued integer;
begin
  select e.capacity
  into v_capacity
  from public.events e
  where e.id = new.event_id
  for update;

  if not found then
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
