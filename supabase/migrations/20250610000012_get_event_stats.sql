-- Organizer event stats: issued, checked-in, remaining (RLS-safe via auth.uid()).

create or replace function public.get_event_stats(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organizer_id uuid;
  v_capacity integer;
  v_issued integer;
  v_checked_in integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated'
      using errcode = '42501';
  end if;

  select organizer_id, capacity
  into v_organizer_id, v_capacity
  from public.events
  where id = p_event_id;

  if not found then
    raise exception 'Event not found'
      using errcode = 'P0002';
  end if;

  if v_organizer_id is distinct from auth.uid() then
    raise exception 'Access denied'
      using errcode = '42501';
  end if;

  select count(*)::integer
  into v_issued
  from public.passes
  where event_id = p_event_id
    and status in ('active', 'checked_in');

  select count(*)::integer
  into v_checked_in
  from public.passes
  where event_id = p_event_id
    and status = 'checked_in';

  return jsonb_build_object(
    'issued_count', v_issued,
    'checked_in_count', v_checked_in,
    'capacity', v_capacity,
    'remaining_count', greatest(v_capacity - v_issued, 0)
  );
end;
$$;

revoke all on function public.get_event_stats(uuid) from public;
grant execute on function public.get_event_stats(uuid) to authenticated;
