-- 808Tix Phase 1.6: outbound_messages verification
--
-- Prerequisites:
--   supabase db reset (applies outbound_messages migration)
--   Run in SQL editor as postgres / service role session

do $$
declare
  v_row_id uuid;
  v_order_id uuid;
  v_visible_count bigint;
begin
  if to_regclass('public.outbound_messages') is null then
    raise exception 'outbound_messages table missing';
  end if;

  -- ---------------------------------------------------------------------------
  -- A. Insert + idempotency_key uniqueness
  -- ---------------------------------------------------------------------------
  insert into public.outbound_messages (
    recipient,
    channel,
    message_type,
    status,
    idempotency_key,
    payload_snapshot
  )
  values (
    'buyer@808tix.test',
    'email',
    'order_confirmation',
    'pending',
    'order_confirmation:verify-test-order',
    jsonb_build_object('pass_count', 1)
  )
  returning id into v_row_id;

  if v_row_id is null then
    raise exception 'outbound_messages insert failed';
  end if;

  begin
    insert into public.outbound_messages (
      recipient,
      channel,
      message_type,
      idempotency_key
    )
    values (
      'buyer@808tix.test',
      'email',
      'order_confirmation',
      'order_confirmation:verify-test-order'
    );

    raise exception 'duplicate idempotency_key should be rejected';
  exception
    when unique_violation then
      null;
  end;

  -- ---------------------------------------------------------------------------
  -- B. channel / status checks
  -- ---------------------------------------------------------------------------
  begin
    insert into public.outbound_messages (
      recipient,
      channel,
      message_type,
      idempotency_key
    )
    values (
      'buyer@808tix.test',
      'push',
      'order_confirmation',
      'order_confirmation:verify-invalid-channel'
    );

    raise exception 'invalid channel should be rejected';
  exception
    when check_violation then
      null;
  end;

  begin
    insert into public.outbound_messages (
      recipient,
      channel,
      message_type,
      status,
      idempotency_key
    )
    values (
      'buyer@808tix.test',
      'sms',
      'pass_link',
      'queued',
      'order_confirmation:verify-invalid-status'
    );

    raise exception 'invalid status should be rejected';
  exception
    when check_violation then
      null;
  end;

  -- SMS channel accepted
  insert into public.outbound_messages (
    recipient,
    channel,
    message_type,
    idempotency_key
  )
  values (
    '+15555550100',
    'sms',
    'pass_link',
    'pass_link:verify-test-sms'
  );

  -- ---------------------------------------------------------------------------
  -- C. order_id FK (optional reference)
  -- ---------------------------------------------------------------------------
  select o.id
  into v_order_id
  from public.orders o
  order by o.created_at desc
  limit 1;

  if v_order_id is not null then
    update public.outbound_messages
    set order_id = v_order_id
    where id = v_row_id;

    if not found then
      raise exception 'outbound_messages order_id update failed';
    end if;
  end if;

  -- ---------------------------------------------------------------------------
  -- D. RLS — anon/authenticated cannot read rows
  -- ---------------------------------------------------------------------------
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'anon', true);
  execute 'set local role anon';

  select count(*)
  into v_visible_count
  from public.outbound_messages;

  if v_visible_count <> 0 then
    raise exception 'anon should not read outbound_messages (got %)', v_visible_count;
  end if;

  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';

  select count(*)
  into v_visible_count
  from public.outbound_messages;

  if v_visible_count <> 0 then
    raise exception 'authenticated should not read outbound_messages (got %)', v_visible_count;
  end if;

  -- ---------------------------------------------------------------------------
  -- E. RLS — anon cannot insert
  -- ---------------------------------------------------------------------------
  begin
    insert into public.outbound_messages (
      recipient,
      channel,
      message_type,
      idempotency_key
    )
    values (
      'intruder@808tix.test',
      'email',
      'order_confirmation',
      'order_confirmation:verify-anon-insert'
    );

    raise exception 'anon insert should be denied';
  exception
    when insufficient_privilege then
      null;
  end;

  reset role;

  raise notice 'outbound_messages verification passed.';
end;
$$;
