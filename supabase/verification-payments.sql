-- 808Tix Phase 1.5: paid ticketing schema verification
--
-- Prerequisites:
--   1. supabase db reset (applies migrations including payments Phase 1.5)
--   2. Run supabase/dev/auth_simulation.sql once in this SQL session
--   3. Replace v_organizer_id and v_other_organizer_id with real auth.users ids
--
-- Covers:
--   A. Comp flow compatibility (defaults, pass_type text unchanged)
--   B. Paid schema integrity (constraints, quantity > 1, sequence uniqueness)
--   C. RLS shape (organizer isolation, anon blocked)
--   D. Scanner compatibility (validate_pass on comp + paid passes)

do $$
declare
  v_organizer_id uuid := '00000000-0000-0000-0000-000000000000'; -- REPLACE
  v_other_organizer_id uuid := '00000000-0000-0000-0000-000000000001'; -- REPLACE
  v_event_id uuid;
  v_comp_pass_id uuid;
  v_comp_token text;
  v_paid_pass_id uuid;
  v_paid_token text;
  v_ticket_type_id uuid;
  v_order_id uuid;
  v_order_item_id uuid;
  v_result jsonb;
  v_row_count bigint;
begin
  if v_organizer_id = '00000000-0000-0000-0000-000000000000'::uuid
     or v_other_organizer_id = '00000000-0000-0000-0000-000000000001'::uuid then
    raise exception 'Replace v_organizer_id and v_other_organizer_id with real auth.users ids';
  end if;

  if to_regprocedure('dev.set_auth_as(uuid)') is null then
    raise exception 'Run supabase/dev/auth_simulation.sql in this session first';
  end if;

  insert into public.profiles (id, email)
  values
    (v_organizer_id, 'payments-verify-a@808tix.test'),
    (v_other_organizer_id, 'payments-verify-b@808tix.test')
  on conflict (id) do nothing;

  -- ---------------------------------------------------------------------------
  -- Setup: published event with comp-only defaults preserved
  -- ---------------------------------------------------------------------------
  insert into public.events (
    organizer_id, slug, name, venue_name, event_date, start_time, status, capacity
  )
  values (
    v_organizer_id,
    'payments-verify-show',
    'Payments Verify Show',
    'Test Venue',
    current_date + 14,
    '20:00',
    'published',
    50
  )
  returning id into v_event_id;

  if (select ticketing_mode from public.events where id = v_event_id) <> 'comp_only' then
    raise exception 'Expected default ticketing_mode comp_only';
  end if;

  if (select sales_enabled from public.events where id = v_event_id) is distinct from false then
    raise exception 'Expected default sales_enabled false';
  end if;

  -- ---------------------------------------------------------------------------
  -- A. Comp flow compatibility
  -- ---------------------------------------------------------------------------
  insert into public.passes (event_id, guest_name, pass_type, secure_token)
  values (v_event_id, 'Comp Guest', 'VIP', '')
  returning id, secure_token into v_comp_pass_id, v_comp_token;

  if (select source from public.passes where id = v_comp_pass_id) <> 'comp' then
    raise exception 'Comp pass should default source=comp';
  end if;

  if (select order_id from public.passes where id = v_comp_pass_id) is not null then
    raise exception 'Comp pass should have null order_id';
  end if;

  if public.get_pass_by_token(v_comp_token) is null then
    raise exception 'get_pass_by_token failed for comp pass';
  end if;

  if (public.get_pass_by_token(v_comp_token) ->> 'pass_type') <> 'VIP' then
    raise exception 'get_pass_by_token pass_type mismatch for comp pass';
  end if;

  -- ---------------------------------------------------------------------------
  -- B. Paid schema integrity
  -- ---------------------------------------------------------------------------
  insert into public.ticket_types (event_id, name, price_cents, currency)
  values (v_event_id, 'General Admission', 2500, 'usd')
  returning id into v_ticket_type_id;

  begin
    insert into public.ticket_types (event_id, name, price_cents)
    values (v_event_id, 'Bad Price', -100);
    raise exception 'Expected negative ticket_types.price_cents to fail';
  exception
    when check_violation then
      null;
  end;

  insert into public.orders (
    event_id,
    organizer_id,
    buyer_email,
    buyer_name,
    subtotal_cents,
    platform_fee_cents,
    total_cents,
    organizer_net_cents,
    public_access_token
  )
  values (
    v_event_id,
    v_organizer_id,
    'buyer@808tix.test',
    'Buyer One',
    5000,
    200,
    5200,
    5000,
    public.generate_public_access_token()
  )
  returning id into v_order_id;

  insert into public.order_items (
    order_id,
    ticket_type_id,
    quantity,
    unit_price_cents,
    line_subtotal_cents,
    pass_type_label
  )
  values (
    v_order_id,
    v_ticket_type_id,
    2,
    2500,
    5000,
    'General Admission'
  )
  returning id into v_order_item_id;

  begin
    insert into public.passes (
      event_id, guest_name, pass_type, secure_token, source
    )
    values (v_event_id, 'Bad Paid', 'GA', '', 'paid');
    raise exception 'Expected source=paid without order_id to fail';
  exception
    when check_violation then
      null;
  end;

  insert into public.passes (
    event_id,
    guest_name,
    pass_type,
    secure_token,
    source,
    order_id,
    order_item_id,
    ticket_type_id,
    sequence,
    price_paid_cents
  )
  values (
    v_event_id,
    'Paid Guest One',
    'General Admission',
    '',
    'paid',
    v_order_id,
    v_order_item_id,
    v_ticket_type_id,
    1,
    2500
  )
  returning id, secure_token into v_paid_pass_id, v_paid_token;

  insert into public.passes (
    event_id,
    guest_name,
    pass_type,
    secure_token,
    source,
    order_id,
    order_item_id,
    ticket_type_id,
    sequence,
    price_paid_cents
  )
  values (
    v_event_id,
    'Paid Guest Two',
    'General Admission',
    '',
    'paid',
    v_order_id,
    v_order_item_id,
    v_ticket_type_id,
    2,
    2500
  );

  begin
    insert into public.passes (
      event_id,
      guest_name,
      pass_type,
      secure_token,
      source,
      order_id,
      order_item_id,
      ticket_type_id,
      sequence,
      price_paid_cents
    )
    values (
      v_event_id,
      'Duplicate Seq',
      'General Admission',
      '',
      'paid',
      v_order_id,
      v_order_item_id,
      v_ticket_type_id,
      2,
      2500
    );
    raise exception 'Expected duplicate (order_item_id, sequence) to fail';
  exception
    when unique_violation then
      null;
  end;

  -- ---------------------------------------------------------------------------
  -- C. RLS shape
  -- ---------------------------------------------------------------------------
  perform dev.set_auth_as(v_organizer_id);

  select count(*) into v_row_count
  from public.orders
  where id = v_order_id;

  if v_row_count <> 1 then
    raise exception 'Organizer should see own order via RLS';
  end if;

  perform dev.set_auth_as(v_other_organizer_id);

  select count(*) into v_row_count
  from public.orders
  where id = v_order_id;

  if v_row_count <> 0 then
    raise exception 'Unrelated organizer should not see others orders';
  end if;

  perform dev.reset_auth();
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'anon', true);
  execute 'set local role anon';

  begin
    insert into public.orders (
      event_id,
      organizer_id,
      buyer_email,
      public_access_token
    )
    values (
      v_event_id,
      v_organizer_id,
      'anon@808tix.test',
      public.generate_public_access_token()
    );
    raise exception 'Expected anon direct orders insert to fail';
  exception
    when insufficient_privilege then
      null;
  end;

  begin
    insert into public.passes (event_id, guest_name, pass_type, secure_token)
    values (v_event_id, 'Anon Guest', 'GA', '');
    raise exception 'Expected anon direct passes insert to fail';
  exception
    when insufficient_privilege then
      null;
  end;

  perform dev.reset_auth();

  -- ---------------------------------------------------------------------------
  -- D. Scanner compatibility (validate_pass unchanged for comp + paid)
  -- ---------------------------------------------------------------------------
  perform dev.set_auth_as(v_organizer_id);

  v_result := public.validate_pass(v_comp_token, v_event_id);
  if v_result ->> 'result' <> 'valid' then
    raise exception 'validate_pass comp pass expected valid, got %', v_result;
  end if;

  v_result := public.validate_pass(v_paid_token, v_event_id);
  if v_result ->> 'result' <> 'valid' then
    raise exception 'validate_pass paid pass expected valid, got %', v_result;
  end if;

  perform dev.reset_auth();

  raise notice 'Payments Phase 1.5 verification passed.';
end;
$$;
