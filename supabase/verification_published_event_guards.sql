-- 808Tix: verify published-event guards for pass issuance and validate_pass
--
-- Prerequisites:
--   1. supabase start && supabase db reset
--   2. Run supabase/dev/auth_simulation.sql once in this SQL session
--   3. Replace v_organizer_id below with a test auth.users id

do $$
declare
  v_organizer_id uuid := null; -- REPLACE with auth.users id
  v_draft_event_id uuid;
  v_published_event_id uuid;
  v_pass_id uuid;
  v_token text;
  v_result jsonb;
  v_checkin_count bigint;
begin
  if v_organizer_id is null then
    raise exception 'Replace v_organizer_id with a real auth.users id before running verification';
  end if;

  if to_regprocedure('dev.set_auth_as(uuid)') is null then
    raise exception 'Run supabase/dev/auth_simulation.sql in this session first';
  end if;

  insert into public.profiles (id, email)
  values (v_organizer_id, 'published-guard@808tix.test')
  on conflict (id) do nothing;

  insert into public.events (organizer_id, slug, name, status, capacity)
  values (v_organizer_id, 'guard-draft-show', 'Draft Show', 'draft', 100)
  returning id into v_draft_event_id;

  insert into public.events (organizer_id, slug, name, status, capacity)
  values (v_organizer_id, 'guard-live-show', 'Live Show', 'published', 100)
  returning id into v_published_event_id;

  -- ---------------------------------------------------------------------------
  -- 1. Pass insert blocked for draft events
  -- ---------------------------------------------------------------------------
  begin
    insert into public.passes (event_id, guest_name, pass_type, secure_token)
    values (v_draft_event_id, 'Draft Guest', 'GA', '');

    raise exception 'Expected pass insert on draft event to be blocked';
  exception
    when others then
      if sqlerrm not like '%Cannot issue passes for an unpublished event.%' then
        raise;
      end if;
  end;

  -- ---------------------------------------------------------------------------
  -- 2. Pass insert succeeds for published events
  -- ---------------------------------------------------------------------------
  insert into public.passes (event_id, guest_name, pass_type, secure_token)
  values (v_published_event_id, 'Live Guest', 'GA', '')
  returning id, secure_token into v_pass_id, v_token;

  if v_token is null or length(v_token) < 32 then
    raise exception 'secure_token was not generated for published event pass';
  end if;

  -- ---------------------------------------------------------------------------
  -- 3. validate_pass refuses draft events without audit rows
  -- ---------------------------------------------------------------------------
  perform dev.set_auth_as(v_organizer_id);

  v_result := public.validate_pass(v_token, v_draft_event_id);
  if v_result ->> 'result' <> 'invalid' then
    raise exception 'validate_pass on draft event expected invalid, got %', v_result;
  end if;

  select count(*)
  into v_checkin_count
  from public.checkins
  where event_id = v_draft_event_id;

  if v_checkin_count <> 0 then
    raise exception 'validate_pass on draft event must not insert checkins, found %', v_checkin_count;
  end if;

  if (select status from public.passes where id = v_pass_id) <> 'active' then
    raise exception 'validate_pass on draft event must not mark pass used';
  end if;

  -- ---------------------------------------------------------------------------
  -- 4. validate_pass still checks in passes for published events
  -- ---------------------------------------------------------------------------
  v_result := public.validate_pass(v_token, v_published_event_id);
  if v_result ->> 'result' <> 'valid' then
    raise exception 'validate_pass on published event expected valid, got %', v_result;
  end if;

  v_result := public.validate_pass(v_token, v_published_event_id);
  if v_result ->> 'result' <> 'already_used' then
    raise exception 'second validate_pass expected already_used, got %', v_result;
  end if;

  select count(*)
  into v_checkin_count
  from public.checkins
  where event_id = v_published_event_id
    and pass_id = v_pass_id;

  if v_checkin_count <> 2 then
    raise exception 'published event checkins expected 2 rows, got %', v_checkin_count;
  end if;

  reset role;

  raise notice 'All published-event guard checks passed.';
end;
$$;
