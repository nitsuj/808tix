-- 808Tix MVP: capacity migration verification (run after db reset + auth_simulation)
-- Usage: set v_organizer_id, run in psql after creating a test user.

do $$
declare
  v_organizer_id uuid := '00000000-0000-0000-0000-000000000000'; -- REPLACE
  v_event_id uuid;
  v_pass_id uuid;
  v_token text;
begin
  if v_organizer_id = '00000000-0000-0000-0000-000000000000'::uuid then
    raise exception 'Replace v_organizer_id with a real auth.users id';
  end if;

  insert into public.profiles (id, email)
  values (v_organizer_id, 'capacity-verify@808tix.test')
  on conflict (id) do nothing;

  insert into public.events (
    organizer_id, slug, name, venue_name, event_date, start_time, status, capacity
  )
  values (
    v_organizer_id,
    'capacity-verify-show',
    'Capacity Verify Show',
    'Test Venue',
    current_date + 30,
    '20:00',
    'draft',
    2
  )
  returning id into v_event_id;

  if public.event_issued_pass_count(v_event_id) <> 0 then
    raise exception 'Expected zero issued passes initially';
  end if;

  insert into public.passes (event_id, guest_name, pass_type, secure_token)
  values (v_event_id, 'Guest One', 'GA', '')
  returning id, secure_token into v_pass_id, v_token;

  insert into public.passes (event_id, guest_name, pass_type, secure_token)
  values (v_event_id, 'Guest Two', 'GA', '');

  if public.event_issued_pass_count(v_event_id) <> 2 then
    raise exception 'Expected 2 issued passes, got %', public.event_issued_pass_count(v_event_id);
  end if;

  begin
    update public.events set capacity = 1 where id = v_event_id;
    raise exception 'Expected capacity reduction below issued to fail';
  exception
    when check_violation then
      null;
  end;

  perform set_config('app.allow_pass_status_update', 'true', true);
  update public.passes set status = 'voided' where id = v_pass_id;
  perform set_config('app.allow_pass_status_update', 'false', true);

  if public.event_issued_pass_count(v_event_id) <> 1 then
    raise exception 'Voided pass should not count toward capacity';
  end if;

  update public.events set capacity = 1 where id = v_event_id;

  if (select capacity from public.events where id = v_event_id) <> 1 then
    raise exception 'Capacity should allow 1 when only one non-voided pass';
  end if;

  raise notice 'Capacity verification passed.';
end;
$$;
