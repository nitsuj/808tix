-- Platform admin identity, fee lock, transparent fee model, admin payout RPCs.
-- Stripe Connect and automated payouts remain deferred.

-- ---------------------------------------------------------------------------
-- A. Platform admin marker
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists is_platform_admin boolean not null default false;

comment on column public.profiles.is_platform_admin is
  '808Tickets platform operator. Promote only via SQL/service role — never client self-serve.';

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(auth.jwt() ->> 'role', '') = 'service_role'
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.is_platform_admin = true
    );
$$;

revoke all on function public.is_platform_admin() from public;
grant execute on function public.is_platform_admin() to authenticated, service_role;

create or replace function public.enforce_platform_admin_flag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
    and new.is_platform_admin is distinct from old.is_platform_admin
  then
    if current_user in ('postgres', 'supabase_admin')
      or coalesce(auth.jwt() ->> 'role', '') = 'service_role'
    then
      return new;
    end if;

    raise exception 'Only service role or database operator may change is_platform_admin'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_enforce_platform_admin_flag on public.profiles;
create trigger profiles_enforce_platform_admin_flag
  before update on public.profiles
  for each row
  execute function public.enforce_platform_admin_flag();

-- ---------------------------------------------------------------------------
-- B. Launch fee defaults + processing fee rate columns (admin-locked)
-- ---------------------------------------------------------------------------
alter table public.events
  alter column platform_fee_bps set default 250,
  alter column platform_fee_fixed_cents set default 99;

alter table public.events
  add column if not exists processing_fee_bps integer not null default 290,
  add column if not exists processing_fee_fixed_cents integer not null default 30;

alter table public.events
  drop constraint if exists events_processing_fee_bps_nonneg_check;
alter table public.events
  add constraint events_processing_fee_bps_nonneg_check
    check (processing_fee_bps >= 0);

alter table public.events
  drop constraint if exists events_processing_fee_fixed_cents_nonneg_check;
alter table public.events
  add constraint events_processing_fee_fixed_cents_nonneg_check
    check (processing_fee_fixed_cents >= 0);

-- Migrate untouched Phase 1.5 defaults only (do not overwrite custom overrides).
update public.events
set
  platform_fee_bps = 250,
  platform_fee_fixed_cents = 99
where platform_fee_bps = 300
  and platform_fee_fixed_cents = 50;

create or replace function public.enforce_event_fee_lock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bypass boolean;
begin
  v_bypass :=
    current_user in ('postgres', 'supabase_admin')
    or coalesce(auth.jwt() ->> 'role', '') = 'service_role'
    or public.is_platform_admin();

  if v_bypass then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.platform_fee_bps := 250;
    new.platform_fee_fixed_cents := 99;
    new.processing_fee_bps := 290;
    new.processing_fee_fixed_cents := 30;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    new.platform_fee_bps := old.platform_fee_bps;
    new.platform_fee_fixed_cents := old.platform_fee_fixed_cents;
    new.processing_fee_bps := old.processing_fee_bps;
    new.processing_fee_fixed_cents := old.processing_fee_fixed_cents;
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists events_enforce_fee_lock on public.events;
create trigger events_enforce_fee_lock
  before insert or update on public.events
  for each row
  execute function public.enforce_event_fee_lock();

-- ---------------------------------------------------------------------------
-- C. Transparent fee helper (service fee + processing estimate with gross-up)
-- ---------------------------------------------------------------------------
create or replace function public.calculate_order_fees(
  p_subtotal_cents integer,
  p_quantity integer,
  p_platform_fee_bps integer,
  p_platform_fee_fixed_cents integer,
  p_processing_fee_bps integer,
  p_processing_fee_fixed_cents integer
)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  v_platform_fee_cents integer := 0;
  v_processing_fee_cents integer := 0;
  v_base_cents integer;
  v_total_cents integer;
  v_divisor numeric;
begin
  if p_subtotal_cents is null or p_subtotal_cents <= 0 or p_quantity is null or p_quantity <= 0 then
    return jsonb_build_object(
      'platform_fee_cents', 0,
      'processing_fee_cents', 0,
      'total_cents', greatest(coalesce(p_subtotal_cents, 0), 0)
    );
  end if;

  -- 808Tickets service fee: percent of subtotal + fixed per paid ticket.
  v_platform_fee_cents :=
    round(p_subtotal_cents::numeric * p_platform_fee_bps / 10000)::integer
    + (p_platform_fee_fixed_cents * p_quantity);

  v_base_cents := p_subtotal_cents + v_platform_fee_cents;

  -- Gross-up so estimated Stripe cut (bps + fixed) is covered by processing line.
  v_divisor := 1 - (p_processing_fee_bps::numeric / 10000);
  if v_divisor <= 0 then
    raise exception 'processing_fee_bps must be less than 10000'
      using errcode = '22023';
  end if;

  v_total_cents := ceil(
    (v_base_cents + p_processing_fee_fixed_cents)::numeric / v_divisor
  )::integer;
  v_processing_fee_cents := v_total_cents - v_base_cents;

  if v_processing_fee_cents < 0 then
    v_processing_fee_cents := 0;
    v_total_cents := v_base_cents;
  end if;

  return jsonb_build_object(
    'platform_fee_cents', v_platform_fee_cents,
    'processing_fee_cents', v_processing_fee_cents,
    'total_cents', v_total_cents
  );
end;
$$;

revoke all on function public.calculate_order_fees(integer, integer, integer, integer, integer, integer) from public;
grant execute on function public.calculate_order_fees(integer, integer, integer, integer, integer, integer)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- D. create_pending_order — separate service + processing fees
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
  v_fees jsonb;
  v_platform_fee_cents integer;
  v_processing_fee_cents integer;
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
  v_fees := public.calculate_order_fees(
    v_subtotal_cents,
    p_quantity,
    v_event.platform_fee_bps,
    v_event.platform_fee_fixed_cents,
    v_event.processing_fee_bps,
    v_event.processing_fee_fixed_cents
  );
  v_platform_fee_cents := (v_fees ->> 'platform_fee_cents')::integer;
  v_processing_fee_cents := (v_fees ->> 'processing_fee_cents')::integer;
  v_total_cents := (v_fees ->> 'total_cents')::integer;
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
    processing_fee_cents,
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
    v_processing_fee_cents,
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
    'processing_fee_cents', v_processing_fee_cents,
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
-- E. Public purchase options + buyer order lookup fee fields
-- ---------------------------------------------------------------------------
create or replace function public.get_public_event_purchase_options(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_event public.events%rowtype;
  v_event_issued integer;
  v_event_reserved integer;
  v_ticket_types jsonb;
begin
  select *
  into v_event
  from public.events
  where id = p_event_id;

  if not found then
    return null;
  end if;

  if v_event.status <> 'published' then
    return null;
  end if;

  if not v_event.sales_enabled then
    return null;
  end if;

  if v_event.ticketing_mode not in ('paid', 'mixed') then
    return null;
  end if;

  v_event_issued := public.event_issued_pass_count(p_event_id);
  v_event_reserved := public.event_reserved_pass_count(p_event_id);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', x.id,
        'name', x.name,
        'description', x.description,
        'price_cents', x.price_cents,
        'currency', x.currency,
        'capacity', x.capacity,
        'quantity_available', x.quantity_available,
        'sales_start_at', x.sales_start_at,
        'sales_end_at', x.sales_end_at,
        'sort_order', x.sort_order
      )
      order by x.sort_order asc, x.created_at asc
    ),
    '[]'::jsonb
  )
  into v_ticket_types
  from (
    select
      tt.id,
      tt.name,
      tt.description,
      tt.price_cents,
      tt.currency,
      tt.capacity,
      case
        when v_event.capacity is not null and tt.capacity is not null then
          least(
            greatest(v_event.capacity - v_event_issued - v_event_reserved, 0),
            greatest(
              tt.capacity
              - public.ticket_type_issued_pass_count(tt.id)
              - public.ticket_type_reserved_pass_count(tt.id),
              0
            )
          )
        when v_event.capacity is not null then
          greatest(v_event.capacity - v_event_issued - v_event_reserved, 0)
        when tt.capacity is not null then
          greatest(
            tt.capacity
            - public.ticket_type_issued_pass_count(tt.id)
            - public.ticket_type_reserved_pass_count(tt.id),
            0
          )
        else null
      end as quantity_available,
      tt.sales_start_at,
      tt.sales_end_at,
      tt.sort_order,
      tt.created_at
    from public.ticket_types tt
    where tt.event_id = p_event_id
      and tt.is_active = true
      and (tt.sales_start_at is null or tt.sales_start_at <= now())
      and (tt.sales_end_at is null or tt.sales_end_at >= now())
  ) x;

  return jsonb_build_object(
    'event',
    jsonb_build_object(
      'id', v_event.id,
      'name', v_event.name,
      'venue_name', v_event.venue_name,
      'event_date', v_event.event_date,
      'start_time', v_event.start_time,
      'description', v_event.description,
      'image_url', v_event.image_url,
      'currency', v_event.currency,
      'capacity', v_event.capacity,
      'ticketing_mode', v_event.ticketing_mode,
      'sales_enabled', v_event.sales_enabled,
      'platform_fee_bps', v_event.platform_fee_bps,
      'platform_fee_fixed_cents', v_event.platform_fee_fixed_cents,
      'processing_fee_bps', v_event.processing_fee_bps,
      'processing_fee_fixed_cents', v_event.processing_fee_fixed_cents
    ),
    'ticket_types', v_ticket_types
  );
end;
$$;

revoke all on function public.get_public_event_purchase_options(uuid) from public;
grant execute on function public.get_public_event_purchase_options(uuid) to anon, authenticated;

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
  v_venue_name text;
  v_event_date date;
  v_start_time time;
  v_image_url text;
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

  select
    e.name,
    e.venue_name,
    e.event_date,
    e.start_time,
    e.image_url
  into
    v_event_name,
    v_venue_name,
    v_event_date,
    v_start_time,
    v_image_url
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
    'venue_name', v_venue_name,
    'event_date', v_event_date,
    'start_time', v_start_time,
    'image_url', v_image_url,
    'ticket_count', v_ticket_count,
    'currency', v_order.currency,
    'subtotal_cents', v_order.subtotal_cents,
    'platform_fee_cents', v_order.platform_fee_cents,
    'processing_fee_cents', coalesce(v_order.processing_fee_cents, 0),
    'total_cents', v_order.total_cents,
    'tickets', case when v_order.status = 'paid' then v_tickets else null end
  );
end;
$$;

revoke all on function public.get_order_by_public_token(text) from public;
grant execute on function public.get_order_by_public_token(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- F. Admin payout RPCs
-- ---------------------------------------------------------------------------
create or replace function public.admin_list_payouts(
  p_status text default null,
  p_event_id uuid default null,
  p_organizer_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_rows jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'Platform admin required'
      using errcode = '42501';
  end if;

  v_status := nullif(btrim(coalesce(p_status, '')), '');
  if v_status is not null and v_status not in ('pending', 'paid', 'withheld') then
    raise exception 'Invalid payout status filter'
      using errcode = '22023';
  end if;

  select coalesce(
    jsonb_agg(row_to_json(x)::jsonb order by x.created_at desc, x.payout_id),
    '[]'::jsonb
  )
  into v_rows
  from (
    select
      op.id as payout_id,
      op.status,
      op.amount_cents,
      op.currency,
      op.organizer_id,
      pr.full_name as organizer_name,
      pr.email as organizer_email,
      o.event_id,
      e.name as event_name,
      e.event_date,
      e.start_time,
      op.order_id,
      pay.id as payment_id,
      op.created_at,
      op.paid_at,
      op.notes,
      o.subtotal_cents,
      o.platform_fee_cents,
      coalesce(o.processing_fee_cents, 0) as processing_fee_cents,
      o.total_cents,
      o.organizer_net_cents
    from public.organizer_payouts op
    inner join public.orders o on o.id = op.order_id
    inner join public.events e on e.id = o.event_id
    left join public.profiles pr on pr.id = op.organizer_id
    left join public.payments pay on pay.order_id = o.id
    where (v_status is null or op.status = v_status)
      and (p_event_id is null or o.event_id = p_event_id)
      and (p_organizer_id is null or op.organizer_id = p_organizer_id)
  ) x;

  return v_rows;
end;
$$;

revoke all on function public.admin_list_payouts(text, uuid, uuid) from public;
grant execute on function public.admin_list_payouts(text, uuid, uuid) to authenticated, service_role;

create or replace function public.admin_set_payout_status(
  p_payout_id uuid,
  p_status text,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_notes text;
  v_row public.organizer_payouts%rowtype;
begin
  if not public.is_platform_admin() then
    raise exception 'Platform admin required'
      using errcode = '42501';
  end if;

  v_status := btrim(coalesce(p_status, ''));
  if v_status not in ('pending', 'paid', 'withheld') then
    raise exception 'Invalid payout status'
      using errcode = '22023';
  end if;

  v_notes := nullif(btrim(coalesce(p_notes, '')), '');

  select *
  into v_row
  from public.organizer_payouts
  where id = p_payout_id
  for update;

  if not found then
    raise exception 'Payout not found'
      using errcode = 'P0002';
  end if;

  if v_row.status = v_status
    and (v_notes is null or v_notes is not distinct from v_row.notes)
  then
    return jsonb_build_object(
      'payout_id', v_row.id,
      'status', v_row.status,
      'paid_at', v_row.paid_at,
      'notes', v_row.notes,
      'amount_cents', v_row.amount_cents,
      'unchanged', true
    );
  end if;

  update public.organizer_payouts
  set
    status = v_status,
    paid_at = case
      when v_status = 'paid' then coalesce(paid_at, now())
      else null
    end,
    notes = coalesce(v_notes, notes),
    updated_at = now()
  where id = p_payout_id
  returning * into v_row;

  return jsonb_build_object(
    'payout_id', v_row.id,
    'status', v_row.status,
    'paid_at', v_row.paid_at,
    'notes', v_row.notes,
    'amount_cents', v_row.amount_cents,
    'unchanged', false
  );
end;
$$;

revoke all on function public.admin_set_payout_status(uuid, text, text) from public;
grant execute on function public.admin_set_payout_status(uuid, text, text) to authenticated, service_role;
