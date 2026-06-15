-- 808Tix Phase 1.5: paid ticketing + lifecycle verification
--
-- Prerequisites:
--   1. supabase db reset
--   2. Run supabase/dev/auth_simulation.sql once in this SQL session
--   3. Replace v_organizer_id and v_other_organizer_id with real auth.users ids

do $$
declare
  v_organizer_id uuid := '00000000-0000-0000-0000-000000000000'; -- REPLACE
  v_other_organizer_id uuid := '00000000-0000-0000-0000-000000000001'; -- REPLACE
  v_event_id uuid;
  v_paid_event_id uuid;
  v_draft_event_id uuid;
  v_capacity_event_id uuid;
  v_tt_event_id uuid;
  v_comp_pass_id uuid;
  v_comp_token text;
  v_paid_token text;
  v_ticket_type_id uuid;
  v_inactive_tt_id uuid;
  v_small_tt_id uuid;
  v_order_id uuid;
  v_stale_order_id uuid;
  v_paid_order_id uuid;
  v_public_token text;
  v_result jsonb;
  v_lookup jsonb;
  v_row_count bigint;
  v_pass_count bigint;
  v_payout_count bigint;
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
  -- Setup: comp-only event (defaults preserved)
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

  -- ---------------------------------------------------------------------------
  -- E. Comp flow compatibility
  -- ---------------------------------------------------------------------------
  insert into public.passes (event_id, guest_name, pass_type, secure_token)
  values (v_event_id, 'Comp Guest', 'VIP', '')
  returning id, secure_token into v_comp_pass_id, v_comp_token;

  if (select source from public.passes where id = v_comp_pass_id) <> 'comp' then
    raise exception 'Comp pass should default source=comp';
  end if;

  if public.get_pass_by_token(v_comp_token) is null then
    raise exception 'get_pass_by_token failed for comp pass';
  end if;

  -- ---------------------------------------------------------------------------
  -- Setup: paid sales event
  -- ---------------------------------------------------------------------------
  insert into public.events (
    organizer_id,
    slug,
    name,
    status,
    capacity,
    ticketing_mode,
    sales_enabled,
    currency,
    platform_fee_bps,
    platform_fee_fixed_cents
  )
  values (
    v_organizer_id,
    'payments-verify-paid',
    'Paid Verify Show',
    'published',
    20,
    'paid',
    true,
    'usd',
    300,
    50
  )
  returning id into v_paid_event_id;

  insert into public.ticket_types (event_id, name, price_cents, currency, capacity)
  values (v_paid_event_id, 'General Admission', 2500, 'usd', 10)
  returning id into v_ticket_type_id;

  -- ---------------------------------------------------------------------------
  -- A. create_pending_order
  -- ---------------------------------------------------------------------------
  perform dev.reset_auth();
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'anon', true);
  execute 'set local role anon';

  v_result := public.create_pending_order(
    v_paid_event_id,
    'buyer@808tix.test',
    v_ticket_type_id,
    2,
    'Buyer One',
    '+15555550100'
  );

  v_order_id := (v_result ->> 'order_id')::uuid;
  v_public_token := v_result ->> 'public_access_token';

  if (v_result ->> 'status') <> 'pending' then
    raise exception 'create_pending_order expected pending status';
  end if;

  if (v_result ->> 'subtotal_cents')::integer <> 5000 then
    raise exception 'create_pending_order subtotal mismatch: %', v_result ->> 'subtotal_cents';
  end if;

  if (v_result ->> 'platform_fee_cents')::integer <> 200 then
    raise exception 'create_pending_order platform fee mismatch: %', v_result ->> 'platform_fee_cents';
  end if;

  if (v_result ->> 'total_cents')::integer <> 5200 then
    raise exception 'create_pending_order total mismatch: %', v_result ->> 'total_cents';
  end if;

  if (v_result ->> 'organizer_net_cents')::integer <> 5000 then
    raise exception 'create_pending_order organizer net mismatch';
  end if;

  if v_public_token is null or length(v_public_token) < 32 then
    raise exception 'create_pending_order missing public_access_token';
  end if;

  if (select reserved_until from public.orders where id = v_order_id) is null then
    raise exception 'create_pending_order missing reserved_until';
  end if;

  if (select count(*) from public.order_items where order_id = v_order_id) <> 1 then
    raise exception 'create_pending_order should create one order_item';
  end if;

  -- Reject unpublished event
  insert into public.events (
    organizer_id, slug, name, status, capacity, ticketing_mode, sales_enabled
  )
  values (
    v_organizer_id, 'payments-verify-draft', 'Draft', 'draft', 10, 'paid', true
  )
  returning id into v_draft_event_id;

  begin
  v_result := public.create_pending_order(
    v_draft_event_id, 'x@t.test', v_ticket_type_id, 1
  );
    raise exception 'Expected unpublished event rejection';
  exception
    when others then
      if sqlerrm not like '%not published%' then
        raise;
      end if;
  end;

  -- Reject sales_enabled=false
  update public.events
  set sales_enabled = false
  where id = v_paid_event_id;

  begin
    v_result := public.create_pending_order(
      v_paid_event_id, 'x@t.test', v_ticket_type_id, 1
    );
    raise exception 'Expected sales_enabled=false rejection';
  exception
    when others then
      if sqlerrm not like '%sales are not enabled%' then
        raise;
      end if;
  end;

  update public.events set sales_enabled = true where id = v_paid_event_id;

  -- Reject inactive ticket type
  insert into public.ticket_types (event_id, name, price_cents, is_active)
  values (v_paid_event_id, 'Inactive', 1000, false)
  returning id into v_inactive_tt_id;

  begin
    v_result := public.create_pending_order(
      v_paid_event_id, 'x@t.test', v_inactive_tt_id, 1
    );
    raise exception 'Expected inactive ticket type rejection';
  exception
    when others then
      if sqlerrm not like '%not active%' then
        raise;
      end if;
  end;

  -- Reject quantity beyond event capacity
  insert into public.events (
    organizer_id, slug, name, status, capacity, ticketing_mode, sales_enabled
  )
  values (
    v_organizer_id, 'payments-verify-cap', 'Cap Test', 'published', 2, 'paid', true
  )
  returning id into v_capacity_event_id;

  insert into public.ticket_types (event_id, name, price_cents)
  values (v_capacity_event_id, 'GA', 1000)
  returning id into v_small_tt_id;

  insert into public.passes (event_id, guest_name, pass_type, secure_token)
  values (v_capacity_event_id, 'Comp One', 'GA', '');

  begin
    v_result := public.create_pending_order(
      v_capacity_event_id, 'x@t.test', v_small_tt_id, 2
    );
    raise exception 'Expected event capacity rejection';
  exception
    when others then
      if sqlerrm not like '%event capacity%' then
        raise;
      end if;
  end;

  -- Reject quantity beyond ticket_type capacity
  insert into public.events (
    organizer_id, slug, name, status, capacity, ticketing_mode, sales_enabled
  )
  values (
    v_organizer_id, 'payments-verify-tt-cap', 'TT Cap', 'published', 50, 'paid', true
  )
  returning id into v_tt_event_id;

  insert into public.ticket_types (event_id, name, price_cents, capacity)
  values (v_tt_event_id, 'Limited', 1000, 1)
  returning id into v_small_tt_id;

  begin
    v_result := public.create_pending_order(
      v_tt_event_id, 'x@t.test', v_small_tt_id, 2
    );
    raise exception 'Expected ticket type capacity rejection';
  exception
    when others then
      if sqlerrm not like '%ticket type capacity%' then
        raise;
      end if;
  end;

  -- ---------------------------------------------------------------------------
  -- D. get_order_by_public_token (pending — no ticket tokens)
  -- ---------------------------------------------------------------------------
  v_lookup := public.get_order_by_public_token(v_public_token);

  if (v_lookup ->> 'status') <> 'pending' then
    raise exception 'lookup pending status mismatch';
  end if;

  if (v_lookup ->> 'ticket_count')::integer <> 2 then
    raise exception 'lookup ticket_count mismatch';
  end if;

  if v_lookup ? 'tickets' and v_lookup -> 'tickets' is not null then
    raise exception 'pending lookup must not expose ticket tokens';
  end if;

  if public.get_order_by_public_token('not-a-real-token') is not null then
    raise exception 'invalid token should return null';
  end if;

  -- ---------------------------------------------------------------------------
  -- C. fulfill_paid_order (reject mismatches before first fulfill)
  -- ---------------------------------------------------------------------------
  begin
    v_result := public.fulfill_paid_order(v_order_id, 1, 'usd');
    raise exception 'Expected amount mismatch rejection';
  exception
    when others then
      if sqlerrm not like '%amount mismatch%' then
        raise;
      end if;
  end;

  begin
    v_result := public.fulfill_paid_order(v_order_id, 5200, 'eur');
    raise exception 'Expected currency mismatch rejection';
  exception
    when others then
      if sqlerrm not like '%currency mismatch%' then
        raise;
      end if;
  end;

  v_result := public.fulfill_paid_order(
    v_order_id,
    5200,
    'usd',
    'cs_test_verify',
    'pi_test_verify',
    'ch_test_verify'
  );
  v_paid_order_id := v_order_id;

  select count(*) into v_pass_count
  from public.passes
  where order_id = v_paid_order_id and source = 'paid';

  if v_pass_count <> 2 then
    raise exception 'fulfill_paid_order expected 2 paid passes, got %', v_pass_count;
  end if;

  if exists (
    select 1
    from public.passes
    where order_id = v_paid_order_id
      and source = 'paid'
      and (order_item_id is null or ticket_type_id is null or sequence is null)
  ) then
    raise exception 'paid passes missing provenance fields';
  end if;

  if exists (
    select 1
    from public.passes p
    inner join public.order_items oi on oi.id = p.order_item_id
    where p.order_id = v_paid_order_id
      and p.pass_type is distinct from oi.pass_type_label
  ) then
    raise exception 'paid pass_type must match ticket type snapshot';
  end if;

  select count(*) into v_row_count
  from public.payments
  where order_id = v_paid_order_id;

  if v_row_count <> 1 then
    raise exception 'payments unique(order_id) expected one row';
  end if;

  select count(*) into v_payout_count
  from public.organizer_payouts
  where order_id = v_paid_order_id;

  if v_payout_count <> 1 then
    raise exception 'organizer_payouts expected one row per order';
  end if;

  v_result := public.fulfill_paid_order(
    v_paid_order_id,
    5200,
    'usd',
    'cs_test_verify_retry',
    'pi_test_verify_retry',
    'ch_test_verify_retry'
  );

  if (v_result ->> 'already_fulfilled')::boolean is distinct from true then
    raise exception 'second fulfill should report already_fulfilled';
  end if;

  select count(*) into v_pass_count
  from public.passes
  where order_id = v_paid_order_id and source = 'paid';

  if v_pass_count <> 2 then
    raise exception 'idempotent fulfill created duplicate passes';
  end if;

  select secure_token into v_paid_token
  from public.passes
  where order_id = v_paid_order_id and sequence = 1
  limit 1;

  -- ---------------------------------------------------------------------------
  -- B. expire_stale_orders
  -- ---------------------------------------------------------------------------
  v_result := public.create_pending_order(
    v_paid_event_id, 'stale@808tix.test', v_ticket_type_id, 1
  );
  v_stale_order_id := (v_result ->> 'order_id')::uuid;

  update public.orders
  set reserved_until = now() - interval '1 minute'
  where id = v_stale_order_id;

  v_result := public.expire_stale_orders();

  if (select status from public.orders where id = v_stale_order_id) <> 'expired' then
    raise exception 'expire_stale_orders did not expire stale order';
  end if;

  v_result := public.expire_stale_orders();
  if (select status from public.orders where id = v_stale_order_id) <> 'expired' then
    raise exception 'expire_stale_orders should be idempotent';
  end if;

  -- Paid order must not be expired
  update public.orders
  set reserved_until = now() - interval '1 hour'
  where id = v_paid_order_id;

  v_result := public.expire_stale_orders();

  if (select status from public.orders where id = v_paid_order_id) <> 'paid' then
    raise exception 'expire_stale_orders must not touch paid orders';
  end if;

  -- ---------------------------------------------------------------------------
  -- D. get_order_by_public_token (paid — exposes ticket tokens)
  -- ---------------------------------------------------------------------------
  v_lookup := public.get_order_by_public_token(v_public_token);

  if (v_lookup ->> 'status') <> 'paid' then
    raise exception 'paid lookup status mismatch';
  end if;

  if jsonb_array_length(v_lookup -> 'tickets') <> 2 then
    raise exception 'paid lookup should return ticket tokens';
  end if;

  -- ---------------------------------------------------------------------------
  -- E. Scanner + guest RPC compatibility
  -- ---------------------------------------------------------------------------
  perform dev.set_auth_as(v_organizer_id);

  v_result := public.validate_pass(v_comp_token, v_event_id);
  if v_result ->> 'result' <> 'valid' then
    raise exception 'validate_pass comp pass failed: %', v_result;
  end if;

  v_result := public.validate_pass(v_paid_token, v_paid_event_id);
  if v_result ->> 'result' <> 'valid' then
    raise exception 'validate_pass paid pass failed: %', v_result;
  end if;

  if public.get_pass_by_token(v_paid_token) is null then
    raise exception 'get_pass_by_token failed for fulfilled paid pass';
  end if;

  perform dev.reset_auth();

  raise notice 'Payments Phase 1.5 lifecycle verification passed.';
end;
$$;
