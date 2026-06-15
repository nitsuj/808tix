-- 808Tix Phase 1.5: paid order lifecycle RPCs (no Stripe checkout / webhooks yet).

-- ---------------------------------------------------------------------------
-- Idempotency: one manual payout row per fulfilled order
-- ---------------------------------------------------------------------------
create unique index organizer_payouts_order_id_unique_idx
  on public.organizer_payouts (order_id);

-- ---------------------------------------------------------------------------
-- Capacity / inventory helpers (internal; called from SECURITY DEFINER RPCs)
-- ---------------------------------------------------------------------------
create or replace function public.event_reserved_pass_count(p_event_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(oi.quantity), 0)::integer
  from public.order_items oi
  inner join public.orders o on o.id = oi.order_id
  where o.event_id = p_event_id
    and o.status in ('pending', 'checkout_open')
    and o.reserved_until is not null
    and o.reserved_until > now();
$$;

create or replace function public.ticket_type_issued_pass_count(p_ticket_type_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.passes
  where ticket_type_id = p_ticket_type_id
    and source = 'paid'
    and status in ('active', 'checked_in');
$$;

create or replace function public.ticket_type_reserved_pass_count(p_ticket_type_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(oi.quantity), 0)::integer
  from public.order_items oi
  inner join public.orders o on o.id = oi.order_id
  where oi.ticket_type_id = p_ticket_type_id
    and o.status in ('pending', 'checkout_open')
    and o.reserved_until is not null
    and o.reserved_until > now();
$$;

revoke all on function public.event_reserved_pass_count(uuid) from public;
revoke all on function public.ticket_type_issued_pass_count(uuid) from public;
revoke all on function public.ticket_type_reserved_pass_count(uuid) from public;

-- ---------------------------------------------------------------------------
-- create_pending_order: reserve inventory and create order + line item
-- ---------------------------------------------------------------------------
create or replace function public.create_pending_order(
  p_event_id uuid,
  p_buyer_email text,
  p_ticket_type_id uuid,
  p_quantity integer,
  p_buyer_name text default null,
  p_buyer_phone text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events%rowtype;
  v_ticket_type public.ticket_types%rowtype;
  v_buyer_email text;
  v_subtotal_cents integer;
  v_platform_fee_cents integer;
  v_total_cents integer;
  v_organizer_net_cents integer;
  v_order_id uuid;
  v_public_access_token text;
  v_reserved_until timestamptz;
  v_issued integer;
  v_reserved integer;
  v_tt_issued integer;
  v_tt_reserved integer;
  v_available integer;
begin
  v_buyer_email := btrim(coalesce(p_buyer_email, ''));

  if v_buyer_email = '' then
    raise exception 'buyer_email is required'
      using errcode = '22023';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'quantity must be greater than zero'
      using errcode = '22023';
  end if;

  select *
  into v_event
  from public.events
  where id = p_event_id
  for update;

  if not found then
    raise exception 'Event not found'
      using errcode = 'P0002';
  end if;

  if v_event.status <> 'published' then
    raise exception 'Event is not published'
      using errcode = '22023';
  end if;

  if not v_event.sales_enabled then
    raise exception 'Ticket sales are not enabled for this event'
      using errcode = '22023';
  end if;

  if v_event.ticketing_mode not in ('paid', 'mixed') then
    raise exception 'Event does not support paid ticketing'
      using errcode = '22023';
  end if;

  select *
  into v_ticket_type
  from public.ticket_types
  where id = p_ticket_type_id
  for update;

  if not found then
    raise exception 'Ticket type not found'
      using errcode = 'P0002';
  end if;

  if v_ticket_type.event_id is distinct from p_event_id then
    raise exception 'Ticket type does not belong to this event'
      using errcode = '22023';
  end if;

  if not v_ticket_type.is_active then
    raise exception 'Ticket type is not active'
      using errcode = '22023';
  end if;

  if v_ticket_type.sales_start_at is not null and v_ticket_type.sales_start_at > now() then
    raise exception 'Ticket sales have not started yet'
      using errcode = '22023';
  end if;

  if v_ticket_type.sales_end_at is not null and v_ticket_type.sales_end_at < now() then
    raise exception 'Ticket sales have ended'
      using errcode = '22023';
  end if;

  v_subtotal_cents := v_ticket_type.price_cents * p_quantity;
  v_platform_fee_cents :=
    round(v_subtotal_cents::numeric * v_event.platform_fee_bps / 10000)::integer
    + v_event.platform_fee_fixed_cents;
  v_total_cents := v_subtotal_cents + v_platform_fee_cents;
  v_organizer_net_cents := v_subtotal_cents;

  v_issued := public.event_issued_pass_count(p_event_id);
  v_reserved := public.event_reserved_pass_count(p_event_id);
  v_available := v_event.capacity - v_issued - v_reserved;

  if p_quantity > v_available then
    raise exception 'Not enough event capacity (% available, % requested)', v_available, p_quantity
      using errcode = 'check_violation';
  end if;

  if v_ticket_type.capacity is not null then
    v_tt_issued := public.ticket_type_issued_pass_count(p_ticket_type_id);
    v_tt_reserved := public.ticket_type_reserved_pass_count(p_ticket_type_id);
    v_available := v_ticket_type.capacity - v_tt_issued - v_tt_reserved;

    if p_quantity > v_available then
      raise exception 'Not enough ticket type capacity (% available, % requested)', v_available, p_quantity
        using errcode = 'check_violation';
    end if;
  end if;

  v_public_access_token := public.generate_public_access_token();
  v_reserved_until := now() + interval '30 minutes';

  insert into public.orders (
    event_id,
    organizer_id,
    status,
    buyer_email,
    buyer_name,
    buyer_phone,
    currency,
    subtotal_cents,
    platform_fee_cents,
    total_cents,
    organizer_net_cents,
    fee_payer,
    settlement_mode,
    public_access_token,
    reserved_until
  )
  values (
    p_event_id,
    v_event.organizer_id,
    'pending',
    v_buyer_email,
    nullif(btrim(coalesce(p_buyer_name, '')), ''),
    nullif(btrim(coalesce(p_buyer_phone, '')), ''),
    v_event.currency,
    v_subtotal_cents,
    v_platform_fee_cents,
    v_total_cents,
    v_organizer_net_cents,
    'buyer',
    'platform',
    v_public_access_token,
    v_reserved_until
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
    p_ticket_type_id,
    p_quantity,
    v_ticket_type.price_cents,
    v_subtotal_cents,
    v_ticket_type.name
  );

  return jsonb_build_object(
    'order_id', v_order_id,
    'public_access_token', v_public_access_token,
    'status', 'pending',
    'subtotal_cents', v_subtotal_cents,
    'platform_fee_cents', v_platform_fee_cents,
    'total_cents', v_total_cents,
    'organizer_net_cents', v_organizer_net_cents,
    'currency', v_event.currency,
    'reserved_until', v_reserved_until
  );
end;
$$;

revoke all on function public.create_pending_order(uuid, text, uuid, integer, text, text) from public;
grant execute on function public.create_pending_order(uuid, text, uuid, integer, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- expire_stale_orders: release abandoned reservations (backend/cron only)
-- ---------------------------------------------------------------------------
create or replace function public.expire_stale_orders()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expired_count integer;
begin
  with expired as (
    update public.orders
    set
      status = 'expired',
      updated_at = now()
    where status in ('pending', 'checkout_open')
      and reserved_until is not null
      and reserved_until < now()
    returning id
  )
  select count(*)::integer into v_expired_count from expired;

  return jsonb_build_object('expired_count', v_expired_count);
end;
$$;

revoke all on function public.expire_stale_orders() from public;
grant execute on function public.expire_stale_orders() to service_role;

-- ---------------------------------------------------------------------------
-- fulfill_paid_order: idempotent payment capture + pass minting
-- ---------------------------------------------------------------------------
create or replace function public.fulfill_paid_order(
  p_order_id uuid,
  p_amount_cents integer,
  p_currency text,
  p_stripe_checkout_session_id text default null,
  p_stripe_payment_intent_id text default null,
  p_stripe_charge_id text default null,
  p_processor_fee_cents integer default null,
  p_net_cents integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_item record;
  v_guest_name text;
  v_seq integer;
  v_pass_id uuid;
  v_pass_token text;
  v_passes jsonb := '[]'::jsonb;
  v_pass_count integer := 0;
  v_already_fulfilled boolean := false;
begin
  select *
  into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found'
      using errcode = 'P0002';
  end if;

  if v_order.status = 'paid' then
    v_already_fulfilled := true;
  elsif v_order.status not in ('pending', 'checkout_open') then
    raise exception 'Order cannot be fulfilled (status: %)', v_order.status
      using errcode = '22023';
  else
    if p_amount_cents is distinct from v_order.total_cents then
      raise exception 'Payment amount mismatch (expected %, got %)', v_order.total_cents, p_amount_cents
        using errcode = '22023';
    end if;

    if lower(btrim(coalesce(p_currency, ''))) is distinct from lower(v_order.currency) then
      raise exception 'Payment currency mismatch (expected %, got %)', v_order.currency, p_currency
        using errcode = '22023';
    end if;

    update public.orders
    set
      status = 'paid',
      paid_at = coalesce(paid_at, now()),
      stripe_checkout_session_id = coalesce(stripe_checkout_session_id, p_stripe_checkout_session_id),
      stripe_payment_intent_id = coalesce(stripe_payment_intent_id, p_stripe_payment_intent_id),
      updated_at = now()
    where id = p_order_id
    returning * into v_order;
  end if;

  insert into public.payments (
    order_id,
    status,
    amount_cents,
    currency,
    stripe_payment_intent_id,
    stripe_charge_id,
    processor_fee_cents,
    net_cents,
    paid_at
  )
  values (
    p_order_id,
    'succeeded',
    v_order.total_cents,
    v_order.currency,
    p_stripe_payment_intent_id,
    p_stripe_charge_id,
    p_processor_fee_cents,
    p_net_cents,
    coalesce(v_order.paid_at, now())
  )
  on conflict (order_id) do nothing;

  insert into public.organizer_payouts (
    organizer_id,
    order_id,
    amount_cents,
    currency,
    status
  )
  values (
    v_order.organizer_id,
    p_order_id,
    v_order.organizer_net_cents,
    v_order.currency,
    'pending'
  )
  on conflict (order_id) do nothing;

  v_guest_name := coalesce(nullif(btrim(coalesce(v_order.buyer_name, '')), ''), v_order.buyer_email);

  for v_item in
    select oi.*
    from public.order_items oi
    where oi.order_id = p_order_id
    order by oi.created_at, oi.id
  loop
    for v_seq in 1..v_item.quantity loop
      select p.id, p.secure_token
      into v_pass_id, v_pass_token
      from public.passes p
      where p.order_item_id = v_item.id
        and p.sequence = v_seq;

      if not found then
        insert into public.passes (
          event_id,
          guest_name,
          guest_email,
          guest_phone,
          pass_type,
          secure_token,
          source,
          order_id,
          order_item_id,
          ticket_type_id,
          sequence,
          price_paid_cents,
          status
        )
        values (
          v_order.event_id,
          v_guest_name,
          v_order.buyer_email,
          v_order.buyer_phone,
          v_item.pass_type_label,
          '',
          'paid',
          p_order_id,
          v_item.id,
          v_item.ticket_type_id,
          v_seq,
          v_item.unit_price_cents,
          'active'
        )
        returning id, secure_token into v_pass_id, v_pass_token;
      end if;

      v_passes := v_passes || jsonb_build_array(
        jsonb_build_object(
          'pass_id', v_pass_id,
          'secure_token', v_pass_token,
          'pass_type', v_item.pass_type_label,
          'guest_name', v_guest_name,
          'sequence', v_seq
        )
      );
      v_pass_count := v_pass_count + 1;
    end loop;
  end loop;

  return jsonb_build_object(
    'order_id', p_order_id,
    'status', 'paid',
    'already_fulfilled', v_already_fulfilled,
    'pass_count', v_pass_count,
    'passes', v_passes
  );
end;
$$;

revoke all on function public.fulfill_paid_order(uuid, integer, text, text, text, text, integer, integer) from public;
grant execute on function public.fulfill_paid_order(uuid, integer, text, text, text, text, integer, integer) to service_role;

-- ---------------------------------------------------------------------------
-- get_order_by_public_token: buyer-safe order status lookup (no unpaid tokens)
-- ---------------------------------------------------------------------------
create or replace function public.get_order_by_public_token(p_public_access_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
  v_order public.orders%rowtype;
  v_event_name text;
  v_ticket_count integer;
  v_tickets jsonb;
begin
  v_token := btrim(coalesce(p_public_access_token, ''));

  if v_token = '' then
    return null;
  end if;

  select o.*
  into v_order
  from public.orders o
  where o.public_access_token = v_token;

  if not found then
    return null;
  end if;

  select e.name
  into v_event_name
  from public.events e
  where e.id = v_order.event_id;

  select coalesce(sum(oi.quantity), 0)::integer
  into v_ticket_count
  from public.order_items oi
  where oi.order_id = v_order.id;

  v_tickets := null;

  if v_order.status = 'paid' then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'secure_token', p.secure_token,
          'pass_type', p.pass_type,
          'guest_name', p.guest_name
        )
        order by p.order_item_id, p.sequence
      ),
      '[]'::jsonb
    )
    into v_tickets
    from public.passes p
    where p.order_id = v_order.id
      and p.source = 'paid';
  end if;

  return jsonb_build_object(
    'status', v_order.status,
    'event_name', v_event_name,
    'ticket_count', v_ticket_count,
    'tickets', case when v_order.status = 'paid' then v_tickets else null end
  );
end;
$$;

revoke all on function public.get_order_by_public_token(text) from public;
grant execute on function public.get_order_by_public_token(text) to anon, authenticated;
