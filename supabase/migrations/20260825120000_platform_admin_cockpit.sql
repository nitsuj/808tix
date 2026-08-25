-- Platform admin cockpit: global/organizer fee config, order fee snapshots, admin list RPCs.
-- Fee precedence at checkout: event custom → organizer override → global default.
-- Existing paid orders are not recalculated.

-- ---------------------------------------------------------------------------
-- A. Global fee config (singleton)
-- ---------------------------------------------------------------------------
create table if not exists public.platform_fee_config (
  id integer primary key default 1 check (id = 1),
  platform_fee_bps integer not null default 250 check (platform_fee_bps >= 0),
  platform_fee_fixed_cents integer not null default 99 check (platform_fee_fixed_cents >= 0),
  processing_fee_bps integer not null default 290 check (processing_fee_bps >= 0),
  processing_fee_fixed_cents integer not null default 30 check (processing_fee_fixed_cents >= 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

comment on table public.platform_fee_config is
  'Singleton global fee defaults. Platform-admin only via RPCs.';

insert into public.platform_fee_config (id)
values (1)
on conflict (id) do nothing;

alter table public.platform_fee_config enable row level security;

-- ---------------------------------------------------------------------------
-- B. Organizer fee overrides
-- ---------------------------------------------------------------------------
create table if not exists public.organizer_fee_overrides (
  organizer_id uuid primary key references public.profiles (id) on delete cascade,
  platform_fee_bps integer not null check (platform_fee_bps >= 0),
  platform_fee_fixed_cents integer not null check (platform_fee_fixed_cents >= 0),
  processing_fee_bps integer not null check (processing_fee_bps >= 0),
  processing_fee_fixed_cents integer not null check (processing_fee_fixed_cents >= 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

comment on table public.organizer_fee_overrides is
  'Optional per-organizer fee overrides. Platform-admin only via RPCs.';

alter table public.organizer_fee_overrides enable row level security;

-- ---------------------------------------------------------------------------
-- C. Event custom-fee flag + order fee snapshots
-- ---------------------------------------------------------------------------
alter table public.events
  add column if not exists use_custom_fees boolean not null default false;

comment on column public.events.use_custom_fees is
  'When true, checkout uses this event fee columns (event override). When false, resolve organizer → global.';

alter table public.orders
  add column if not exists fee_config_source text,
  add column if not exists platform_fee_bps_used integer,
  add column if not exists platform_fee_fixed_cents_used integer,
  add column if not exists processing_fee_bps_used integer,
  add column if not exists processing_fee_fixed_cents_used integer;

alter table public.orders
  drop constraint if exists orders_fee_config_source_check;
alter table public.orders
  add constraint orders_fee_config_source_check
    check (
      fee_config_source is null
      or fee_config_source in ('global', 'organizer', 'event')
    );

-- Backfill historical paid/pending orders as event-sourced snapshots without recalculating cents.
update public.orders o
set
  fee_config_source = coalesce(o.fee_config_source, 'event'),
  platform_fee_bps_used = coalesce(
    o.platform_fee_bps_used,
    (select e.platform_fee_bps from public.events e where e.id = o.event_id)
  ),
  platform_fee_fixed_cents_used = coalesce(
    o.platform_fee_fixed_cents_used,
    (select e.platform_fee_fixed_cents from public.events e where e.id = o.event_id)
  ),
  processing_fee_bps_used = coalesce(
    o.processing_fee_bps_used,
    (select e.processing_fee_bps from public.events e where e.id = o.event_id)
  ),
  processing_fee_fixed_cents_used = coalesce(
    o.processing_fee_fixed_cents_used,
    (select e.processing_fee_fixed_cents from public.events e where e.id = o.event_id)
  )
where o.fee_config_source is null;

-- ---------------------------------------------------------------------------
-- D. resolve_effective_fee_config(event_id)
-- ---------------------------------------------------------------------------
create or replace function public.resolve_effective_fee_config(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_event public.events%rowtype;
  v_global public.platform_fee_config%rowtype;
  v_override public.organizer_fee_overrides%rowtype;
begin
  select * into v_event from public.events where id = p_event_id;
  if not found then
    raise exception 'Event not found' using errcode = 'P0002';
  end if;

  if coalesce(v_event.use_custom_fees, false) then
    return jsonb_build_object(
      'source', 'event',
      'platform_fee_bps', v_event.platform_fee_bps,
      'platform_fee_fixed_cents', v_event.platform_fee_fixed_cents,
      'processing_fee_bps', v_event.processing_fee_bps,
      'processing_fee_fixed_cents', v_event.processing_fee_fixed_cents
    );
  end if;

  select * into v_override
  from public.organizer_fee_overrides
  where organizer_id = v_event.organizer_id;

  if found then
    return jsonb_build_object(
      'source', 'organizer',
      'platform_fee_bps', v_override.platform_fee_bps,
      'platform_fee_fixed_cents', v_override.platform_fee_fixed_cents,
      'processing_fee_bps', v_override.processing_fee_bps,
      'processing_fee_fixed_cents', v_override.processing_fee_fixed_cents
    );
  end if;

  select * into v_global from public.platform_fee_config where id = 1;
  if not found then
    raise exception 'platform_fee_config missing' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'source', 'global',
    'platform_fee_bps', v_global.platform_fee_bps,
    'platform_fee_fixed_cents', v_global.platform_fee_fixed_cents,
    'processing_fee_bps', v_global.processing_fee_bps,
    'processing_fee_fixed_cents', v_global.processing_fee_fixed_cents
  );
end;
$$;

revoke all on function public.resolve_effective_fee_config(uuid) from public;
grant execute on function public.resolve_effective_fee_config(uuid) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- E. Fee lock: INSERT seeds from global; non-admins cannot mutate fees/flag
-- ---------------------------------------------------------------------------
create or replace function public.enforce_event_fee_lock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bypass boolean;
  v_global public.platform_fee_config%rowtype;
begin
  v_bypass :=
    current_user in ('postgres', 'supabase_admin')
    or coalesce(auth.jwt() ->> 'role', '') = 'service_role'
    or public.is_platform_admin();

  if v_bypass then
    return new;
  end if;

  if tg_op = 'INSERT' then
    select * into v_global from public.platform_fee_config where id = 1;
    new.platform_fee_bps := coalesce(v_global.platform_fee_bps, 250);
    new.platform_fee_fixed_cents := coalesce(v_global.platform_fee_fixed_cents, 99);
    new.processing_fee_bps := coalesce(v_global.processing_fee_bps, 290);
    new.processing_fee_fixed_cents := coalesce(v_global.processing_fee_fixed_cents, 30);
    new.use_custom_fees := false;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    new.platform_fee_bps := old.platform_fee_bps;
    new.platform_fee_fixed_cents := old.platform_fee_fixed_cents;
    new.processing_fee_bps := old.processing_fee_bps;
    new.processing_fee_fixed_cents := old.processing_fee_fixed_cents;
    new.use_custom_fees := old.use_custom_fees;
    return new;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- F. create_pending_order — resolve + snapshot fee config
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
  v_fee_cfg jsonb;
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
  v_source text;
  v_platform_fee_bps integer;
  v_platform_fee_fixed_cents integer;
  v_processing_fee_bps integer;
  v_processing_fee_fixed_cents integer;
begin
  v_buyer_email := btrim(coalesce(p_buyer_email, ''));

  if v_buyer_email = '' then
    raise exception 'buyer_email is required' using errcode = '22023';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'quantity must be greater than zero' using errcode = '22023';
  end if;

  select * into v_event from public.events where id = p_event_id for update;
  if not found then
    raise exception 'Event not found' using errcode = 'P0002';
  end if;

  if v_event.status <> 'published' then
    raise exception 'Event is not published' using errcode = '22023';
  end if;

  if not v_event.sales_enabled then
    raise exception 'Ticket sales are not enabled for this event' using errcode = '22023';
  end if;

  if v_event.ticketing_mode not in ('paid', 'mixed') then
    raise exception 'Event does not support paid ticketing' using errcode = '22023';
  end if;

  select * into v_ticket_type from public.ticket_types where id = p_ticket_type_id for update;
  if not found then
    raise exception 'Ticket type not found' using errcode = 'P0002';
  end if;

  if v_ticket_type.event_id is distinct from p_event_id then
    raise exception 'Ticket type does not belong to this event' using errcode = '22023';
  end if;

  if not v_ticket_type.is_active then
    raise exception 'Ticket type is not active' using errcode = '22023';
  end if;

  if v_ticket_type.sales_start_at is not null and v_ticket_type.sales_start_at > now() then
    raise exception 'Ticket sales have not started yet' using errcode = '22023';
  end if;

  if v_ticket_type.sales_end_at is not null and v_ticket_type.sales_end_at < now() then
    raise exception 'Ticket sales have ended' using errcode = '22023';
  end if;

  v_fee_cfg := public.resolve_effective_fee_config(p_event_id);
  v_source := v_fee_cfg ->> 'source';
  v_platform_fee_bps := (v_fee_cfg ->> 'platform_fee_bps')::integer;
  v_platform_fee_fixed_cents := (v_fee_cfg ->> 'platform_fee_fixed_cents')::integer;
  v_processing_fee_bps := (v_fee_cfg ->> 'processing_fee_bps')::integer;
  v_processing_fee_fixed_cents := (v_fee_cfg ->> 'processing_fee_fixed_cents')::integer;

  v_subtotal_cents := v_ticket_type.price_cents * p_quantity;
  v_fees := public.calculate_order_fees(
    v_subtotal_cents,
    p_quantity,
    v_platform_fee_bps,
    v_platform_fee_fixed_cents,
    v_processing_fee_bps,
    v_processing_fee_fixed_cents
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
    reserved_until,
    fee_config_source,
    platform_fee_bps_used,
    platform_fee_fixed_cents_used,
    processing_fee_bps_used,
    processing_fee_fixed_cents_used
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
    v_reserved_until,
    v_source,
    v_platform_fee_bps,
    v_platform_fee_fixed_cents,
    v_processing_fee_bps,
    v_processing_fee_fixed_cents
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
    'fee_config_source', v_source,
    'currency', v_event.currency,
    'reserved_until', v_reserved_until
  );
end;
$$;

revoke all on function public.create_pending_order(uuid, text, uuid, integer, text, text) from public;
grant execute on function public.create_pending_order(uuid, text, uuid, integer, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- G. get_public_event_purchase_options — effective fee rates + source (preserve shape)
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
  v_fee_cfg jsonb;
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

  v_fee_cfg := public.resolve_effective_fee_config(p_event_id);
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
      'platform_fee_bps', (v_fee_cfg ->> 'platform_fee_bps')::integer,
      'platform_fee_fixed_cents', (v_fee_cfg ->> 'platform_fee_fixed_cents')::integer,
      'processing_fee_bps', (v_fee_cfg ->> 'processing_fee_bps')::integer,
      'processing_fee_fixed_cents', (v_fee_cfg ->> 'processing_fee_fixed_cents')::integer,
      'fee_config_source', v_fee_cfg ->> 'source',
      'use_custom_fees', v_event.use_custom_fees
    ),
    'ticket_types', v_ticket_types
  );
end;
$$;

revoke all on function public.get_public_event_purchase_options(uuid) from public;
grant execute on function public.get_public_event_purchase_options(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- H. Admin dashboard + support list RPCs
-- ---------------------------------------------------------------------------
create or replace function public.admin_dashboard_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_paid_orders integer;
  v_subtotal bigint;
  v_platform bigint;
  v_processing bigint;
  v_organizer_net bigint;
  v_pending_payouts integer;
  v_tickets_issued integer;
  v_checked_in integer;
begin
  if not public.is_platform_admin() then
    raise exception 'Platform admin required' using errcode = '42501';
  end if;

  select
    count(*)::integer,
    coalesce(sum(subtotal_cents), 0),
    coalesce(sum(platform_fee_cents), 0),
    coalesce(sum(coalesce(processing_fee_cents, 0)), 0),
    coalesce(sum(organizer_net_cents), 0)
  into v_paid_orders, v_subtotal, v_platform, v_processing, v_organizer_net
  from public.orders
  where status = 'paid';

  select count(*)::integer into v_pending_payouts
  from public.organizer_payouts
  where status = 'pending';

  select count(*)::integer into v_tickets_issued
  from public.passes
  where source = 'paid';

  select count(*)::integer into v_checked_in
  from public.passes
  where status = 'checked_in';

  return jsonb_build_object(
    'paid_orders_count', v_paid_orders,
    'ticket_subtotal_cents', v_subtotal,
    'platform_fee_cents', v_platform,
    'processing_fee_cents', v_processing,
    'organizer_net_cents', v_organizer_net,
    'pending_payout_count', v_pending_payouts,
    'paid_tickets_issued_count', v_tickets_issued,
    'checked_in_count', v_checked_in
  );
end;
$$;

revoke all on function public.admin_dashboard_summary() from public;
grant execute on function public.admin_dashboard_summary() to authenticated, service_role;

create or replace function public.admin_list_events(p_limit integer default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 50), 200));
begin
  if not public.is_platform_admin() then
    raise exception 'Platform admin required' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(row_to_json(x)::jsonb order by x.sort_date desc nulls last, x.created_at desc)
    from (
      select
        e.id as event_id,
        e.name as event_name,
        e.slug as event_slug,
        e.status,
        e.sales_enabled,
        e.ticketing_mode,
        e.event_date,
        e.start_time,
        e.venue_name,
        e.organizer_id,
        p.email as organizer_email,
        p.full_name as organizer_name,
        e.use_custom_fees,
        (public.resolve_effective_fee_config(e.id) ->> 'source') as fee_config_source,
        e.created_at,
        coalesce(e.event_date::timestamptz, e.created_at) as sort_date,
        (
          select count(*)::integer from public.orders o
          where o.event_id = e.id and o.status = 'paid'
        ) as paid_order_count,
        (
          select count(*)::integer from public.passes ps
          where ps.event_id = e.id and ps.source = 'paid'
        ) as paid_ticket_count,
        (
          select count(*)::integer from public.passes ps
          where ps.event_id = e.id and ps.status = 'checked_in'
        ) as checked_in_count,
        (
          select coalesce(sum(o.subtotal_cents), 0)::bigint from public.orders o
          where o.event_id = e.id and o.status = 'paid'
        ) as ticket_subtotal_cents,
        (
          select coalesce(sum(o.platform_fee_cents), 0)::bigint from public.orders o
          where o.event_id = e.id and o.status = 'paid'
        ) as platform_fee_cents,
        (
          select coalesce(sum(coalesce(o.processing_fee_cents, 0)), 0)::bigint from public.orders o
          where o.event_id = e.id and o.status = 'paid'
        ) as processing_fee_cents,
        (
          select coalesce(sum(o.organizer_net_cents), 0)::bigint from public.orders o
          where o.event_id = e.id and o.status = 'paid'
        ) as organizer_net_cents,
        (
          select coalesce(
            jsonb_agg(distinct op.status),
            '[]'::jsonb
          )
          from public.organizer_payouts op
          join public.orders o on o.id = op.order_id
          where o.event_id = e.id
        ) as payout_statuses
      from public.events e
      join public.profiles p on p.id = e.organizer_id
      order by coalesce(e.event_date::timestamptz, e.created_at) desc nulls last
      limit v_limit
    ) x
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.admin_list_events(integer) from public;
grant execute on function public.admin_list_events(integer) to authenticated, service_role;

create or replace function public.admin_list_recent_orders(p_limit integer default 40)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 40), 200));
begin
  if not public.is_platform_admin() then
    raise exception 'Platform admin required' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(row_to_json(x)::jsonb order by x.created_at desc)
    from (
      select
        o.id as order_id,
        o.public_access_token,
        o.status,
        o.buyer_email,
        o.buyer_name,
        o.event_id,
        e.name as event_name,
        o.subtotal_cents,
        o.platform_fee_cents,
        o.processing_fee_cents,
        o.total_cents,
        o.organizer_net_cents,
        o.fee_config_source,
        o.platform_fee_bps_used,
        o.platform_fee_fixed_cents_used,
        o.processing_fee_bps_used,
        o.processing_fee_fixed_cents_used,
        o.currency,
        o.created_at,
        o.paid_at,
        (
          select count(*)::integer from public.passes ps where ps.order_id = o.id
        ) as ticket_count,
        (
          select coalesce(
            jsonb_agg(
              jsonb_build_object(
                'secure_token', ps.secure_token,
                'sequence', ps.sequence,
                'status', ps.status
              )
              order by ps.sequence nulls last, ps.created_at
            ),
            '[]'::jsonb
          )
          from public.passes ps
          where ps.order_id = o.id
        ) as tickets
      from public.orders o
      join public.events e on e.id = o.event_id
      order by o.created_at desc
      limit v_limit
    ) x
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.admin_list_recent_orders(integer) from public;
grant execute on function public.admin_list_recent_orders(integer) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- I. Monetization admin RPCs
-- ---------------------------------------------------------------------------
create or replace function public.admin_get_monetization_settings()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_global public.platform_fee_config%rowtype;
  v_overrides jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'Platform admin required' using errcode = '42501';
  end if;

  select * into v_global from public.platform_fee_config where id = 1;

  select coalesce(jsonb_agg(row_to_json(x)::jsonb order by x.organizer_email), '[]'::jsonb)
  into v_overrides
  from (
    select
      o.organizer_id,
      p.email as organizer_email,
      p.full_name as organizer_name,
      o.platform_fee_bps,
      o.platform_fee_fixed_cents,
      o.processing_fee_bps,
      o.processing_fee_fixed_cents,
      o.updated_at
    from public.organizer_fee_overrides o
    join public.profiles p on p.id = o.organizer_id
  ) x;

  return jsonb_build_object(
    'global', jsonb_build_object(
      'platform_fee_bps', v_global.platform_fee_bps,
      'platform_fee_fixed_cents', v_global.platform_fee_fixed_cents,
      'processing_fee_bps', v_global.processing_fee_bps,
      'processing_fee_fixed_cents', v_global.processing_fee_fixed_cents,
      'updated_at', v_global.updated_at
    ),
    'organizer_overrides', v_overrides,
    'precedence', jsonb_build_array('event', 'organizer', 'global'),
    'labels', jsonb_build_object(
      'service_fee', '808Tickets service fee',
      'processing_fee', 'Payment processing fee'
    )
  );
end;
$$;

revoke all on function public.admin_get_monetization_settings() from public;
grant execute on function public.admin_get_monetization_settings() to authenticated, service_role;

create or replace function public.admin_update_global_fee_config(
  p_platform_fee_bps integer,
  p_platform_fee_fixed_cents integer,
  p_processing_fee_bps integer,
  p_processing_fee_fixed_cents integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Platform admin required' using errcode = '42501';
  end if;

  if p_platform_fee_bps is null or p_platform_fee_bps < 0
    or p_platform_fee_fixed_cents is null or p_platform_fee_fixed_cents < 0
    or p_processing_fee_bps is null or p_processing_fee_bps < 0 or p_processing_fee_bps >= 10000
    or p_processing_fee_fixed_cents is null or p_processing_fee_fixed_cents < 0
  then
    raise exception 'Invalid fee configuration' using errcode = '22023';
  end if;

  update public.platform_fee_config
  set
    platform_fee_bps = p_platform_fee_bps,
    platform_fee_fixed_cents = p_platform_fee_fixed_cents,
    processing_fee_bps = p_processing_fee_bps,
    processing_fee_fixed_cents = p_processing_fee_fixed_cents,
    updated_at = now(),
    updated_by = auth.uid()
  where id = 1;

  return public.admin_get_monetization_settings();
end;
$$;

revoke all on function public.admin_update_global_fee_config(integer, integer, integer, integer) from public;
grant execute on function public.admin_update_global_fee_config(integer, integer, integer, integer)
  to authenticated, service_role;

create or replace function public.admin_upsert_organizer_fee_override(
  p_organizer_id uuid,
  p_platform_fee_bps integer,
  p_platform_fee_fixed_cents integer,
  p_processing_fee_bps integer,
  p_processing_fee_fixed_cents integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Platform admin required' using errcode = '42501';
  end if;

  if p_organizer_id is null then
    raise exception 'organizer_id required' using errcode = '22023';
  end if;

  if p_platform_fee_bps is null or p_platform_fee_bps < 0
    or p_platform_fee_fixed_cents is null or p_platform_fee_fixed_cents < 0
    or p_processing_fee_bps is null or p_processing_fee_bps < 0 or p_processing_fee_bps >= 10000
    or p_processing_fee_fixed_cents is null or p_processing_fee_fixed_cents < 0
  then
    raise exception 'Invalid fee configuration' using errcode = '22023';
  end if;

  insert into public.organizer_fee_overrides (
    organizer_id,
    platform_fee_bps,
    platform_fee_fixed_cents,
    processing_fee_bps,
    processing_fee_fixed_cents,
    updated_at,
    updated_by
  )
  values (
    p_organizer_id,
    p_platform_fee_bps,
    p_platform_fee_fixed_cents,
    p_processing_fee_bps,
    p_processing_fee_fixed_cents,
    now(),
    auth.uid()
  )
  on conflict (organizer_id) do update set
    platform_fee_bps = excluded.platform_fee_bps,
    platform_fee_fixed_cents = excluded.platform_fee_fixed_cents,
    processing_fee_bps = excluded.processing_fee_bps,
    processing_fee_fixed_cents = excluded.processing_fee_fixed_cents,
    updated_at = now(),
    updated_by = auth.uid();

  return public.admin_get_monetization_settings();
end;
$$;

revoke all on function public.admin_upsert_organizer_fee_override(uuid, integer, integer, integer, integer) from public;
grant execute on function public.admin_upsert_organizer_fee_override(uuid, integer, integer, integer, integer)
  to authenticated, service_role;

create or replace function public.admin_set_event_custom_fees(
  p_event_id uuid,
  p_use_custom_fees boolean,
  p_platform_fee_bps integer default null,
  p_platform_fee_fixed_cents integer default null,
  p_processing_fee_bps integer default null,
  p_processing_fee_fixed_cents integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Platform admin required' using errcode = '42501';
  end if;

  if not exists (select 1 from public.events where id = p_event_id) then
    raise exception 'Event not found' using errcode = 'P0002';
  end if;

  if p_use_custom_fees then
    if p_platform_fee_bps is null or p_platform_fee_fixed_cents is null
      or p_processing_fee_bps is null or p_processing_fee_fixed_cents is null
    then
      raise exception 'Custom event fees require all rate fields' using errcode = '22023';
    end if;

    update public.events
    set
      use_custom_fees = true,
      platform_fee_bps = p_platform_fee_bps,
      platform_fee_fixed_cents = p_platform_fee_fixed_cents,
      processing_fee_bps = p_processing_fee_bps,
      processing_fee_fixed_cents = p_processing_fee_fixed_cents,
      updated_at = now()
    where id = p_event_id;
  else
    update public.events
    set
      use_custom_fees = false,
      updated_at = now()
    where id = p_event_id;
  end if;

  return public.resolve_effective_fee_config(p_event_id);
end;
$$;

revoke all on function public.admin_set_event_custom_fees(uuid, boolean, integer, integer, integer, integer) from public;
grant execute on function public.admin_set_event_custom_fees(uuid, boolean, integer, integer, integer, integer)
  to authenticated, service_role;
