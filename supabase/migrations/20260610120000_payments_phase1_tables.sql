-- 808Tix Phase 1.5: paid ticketing schema foundation (tables + columns only).
-- No Stripe checkout, webhook fulfillment, or runtime behavior changes.

-- ---------------------------------------------------------------------------
-- events: ticketing configuration (defaults preserve comp-only behavior)
-- ---------------------------------------------------------------------------
alter table public.events
  add column ticketing_mode text not null default 'comp_only',
  add column currency text not null default 'usd',
  add column platform_fee_bps integer not null default 300,
  add column platform_fee_fixed_cents integer not null default 50,
  add column sales_enabled boolean not null default false;

alter table public.events
  add constraint events_ticketing_mode_check
    check (ticketing_mode in ('comp_only', 'paid', 'mixed'));

alter table public.events
  add constraint events_platform_fee_bps_nonneg_check
    check (platform_fee_bps >= 0);

alter table public.events
  add constraint events_platform_fee_fixed_cents_nonneg_check
    check (platform_fee_fixed_cents >= 0);

-- ---------------------------------------------------------------------------
-- profiles: future Stripe Connect fields (no Connect behavior yet)
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column default_settlement_mode text not null default 'platform',
  add column stripe_connect_account_id text,
  add column stripe_connect_onboarding_complete boolean not null default false,
  add column stripe_connect_payouts_enabled boolean not null default false;

alter table public.profiles
  add constraint profiles_default_settlement_mode_check
    check (default_settlement_mode in ('platform', 'connect'));

-- ---------------------------------------------------------------------------
-- ticket_types: sellable options per event
-- ---------------------------------------------------------------------------
create table public.ticket_types (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  name text not null,
  description text,
  price_cents integer not null,
  currency text not null default 'usd',
  capacity integer,
  sales_start_at timestamptz,
  sales_end_at timestamptz,
  is_active boolean not null default true,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ticket_types_price_cents_nonneg_check check (price_cents >= 0),
  constraint ticket_types_capacity_nonneg_check check (capacity is null or capacity >= 0)
);

create index ticket_types_event_id_is_active_idx
  on public.ticket_types (event_id, is_active);

create index ticket_types_event_id_sort_order_idx
  on public.ticket_types (event_id, sort_order);

create trigger ticket_types_set_updated_at
  before update on public.ticket_types
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- orders: buyer purchase lifecycle
-- ---------------------------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  organizer_id uuid not null references public.profiles (id) on delete restrict,
  status text not null default 'pending',
  buyer_email text not null,
  buyer_name text,
  buyer_phone text,
  currency text not null default 'usd',
  subtotal_cents integer not null default 0,
  platform_fee_cents integer not null default 0,
  processing_fee_cents integer,
  total_cents integer not null default 0,
  organizer_net_cents integer not null default 0,
  fee_payer text not null default 'buyer',
  settlement_mode text not null default 'platform',
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  public_access_token text not null,
  reserved_until timestamptz,
  paid_at timestamptz,
  canceled_at timestamptz,
  refunded_at timestamptz,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_status_check check (
    status in (
      'pending',
      'checkout_open',
      'paid',
      'expired',
      'canceled',
      'failed',
      'refunded',
      'partially_refunded',
      'disputed'
    )
  ),
  constraint orders_fee_payer_check check (fee_payer in ('buyer', 'organizer')),
  constraint orders_settlement_mode_check check (settlement_mode in ('platform', 'connect')),
  constraint orders_subtotal_cents_nonneg_check check (subtotal_cents >= 0),
  constraint orders_platform_fee_cents_nonneg_check check (platform_fee_cents >= 0),
  constraint orders_processing_fee_cents_nonneg_check
    check (processing_fee_cents is null or processing_fee_cents >= 0),
  constraint orders_total_cents_nonneg_check check (total_cents >= 0),
  constraint orders_organizer_net_cents_nonneg_check check (organizer_net_cents >= 0),
  constraint orders_public_access_token_unique unique (public_access_token)
);

create unique index orders_stripe_checkout_session_id_unique_idx
  on public.orders (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create unique index orders_stripe_payment_intent_id_unique_idx
  on public.orders (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

create index orders_event_id_created_at_idx
  on public.orders (event_id, created_at desc);

create index orders_organizer_id_created_at_idx
  on public.orders (organizer_id, created_at desc);

create index orders_status_reserved_until_idx
  on public.orders (status, reserved_until);

create trigger orders_set_updated_at
  before update on public.orders
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- order_items: line items (quantity > 1)
-- ---------------------------------------------------------------------------
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  ticket_type_id uuid not null references public.ticket_types (id) on delete restrict,
  quantity integer not null,
  unit_price_cents integer not null,
  line_subtotal_cents integer not null,
  pass_type_label text not null,
  created_at timestamptz not null default now(),
  constraint order_items_quantity_positive_check check (quantity > 0),
  constraint order_items_unit_price_cents_nonneg_check check (unit_price_cents >= 0),
  constraint order_items_line_subtotal_cents_nonneg_check check (line_subtotal_cents >= 0)
);

create index order_items_order_id_idx
  on public.order_items (order_id);

create index order_items_ticket_type_id_idx
  on public.order_items (ticket_type_id);

-- ---------------------------------------------------------------------------
-- payments: one ledger row per successful charge (Phase 1.5)
-- ---------------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  status text not null default 'pending',
  amount_cents integer not null,
  currency text not null default 'usd',
  stripe_payment_intent_id text,
  stripe_charge_id text,
  stripe_balance_transaction_id text,
  processor_fee_cents integer,
  net_cents integer,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  constraint payments_status_check check (
    status in ('pending', 'succeeded', 'failed', 'refunded', 'partially_refunded', 'disputed')
  ),
  constraint payments_amount_cents_nonneg_check check (amount_cents >= 0),
  constraint payments_processor_fee_cents_nonneg_check
    check (processor_fee_cents is null or processor_fee_cents >= 0),
  constraint payments_net_cents_nonneg_check check (net_cents is null or net_cents >= 0),
  constraint payments_order_id_unique unique (order_id)
);

create unique index payments_stripe_payment_intent_id_unique_idx
  on public.payments (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

create unique index payments_stripe_charge_id_unique_idx
  on public.payments (stripe_charge_id)
  where stripe_charge_id is not null;

create index payments_order_id_idx
  on public.payments (order_id);

-- ---------------------------------------------------------------------------
-- payment_events: Stripe webhook idempotency + audit
-- ---------------------------------------------------------------------------
create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null,
  type text not null,
  payload jsonb not null,
  order_id uuid references public.orders (id) on delete set null,
  processing_status text not null default 'received',
  error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  constraint payment_events_stripe_event_id_unique unique (stripe_event_id),
  constraint payment_events_processing_status_check
    check (processing_status in ('received', 'processed', 'failed'))
);

create index payment_events_type_received_at_idx
  on public.payment_events (type, received_at desc);

create index payment_events_order_id_idx
  on public.payment_events (order_id);

-- ---------------------------------------------------------------------------
-- organizer_payouts: manual platform settlement tracking (Phase 1.5 alpha)
-- ---------------------------------------------------------------------------
create table public.organizer_payouts (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.profiles (id) on delete restrict,
  order_id uuid not null references public.orders (id) on delete cascade,
  amount_cents integer not null,
  currency text not null default 'usd',
  status text not null default 'pending',
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizer_payouts_amount_cents_nonneg_check check (amount_cents >= 0),
  constraint organizer_payouts_status_check check (status in ('pending', 'paid', 'withheld'))
);

create index organizer_payouts_organizer_id_created_at_idx
  on public.organizer_payouts (organizer_id, created_at desc);

create index organizer_payouts_status_created_at_idx
  on public.organizer_payouts (status, created_at desc);

create trigger organizer_payouts_set_updated_at
  before update on public.organizer_payouts
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- passes: paid-ticket provenance (comp flow unchanged via defaults)
-- ---------------------------------------------------------------------------
alter table public.passes
  add column source text not null default 'comp',
  add column order_id uuid references public.orders (id) on delete set null,
  add column order_item_id uuid references public.order_items (id) on delete set null,
  add column ticket_type_id uuid references public.ticket_types (id) on delete set null,
  add column sequence smallint,
  add column price_paid_cents integer;

alter table public.passes
  add constraint passes_source_check check (source in ('comp', 'paid'));

alter table public.passes
  add constraint passes_source_order_check check (
    (source = 'comp' and order_id is null)
    or (source = 'paid' and order_id is not null)
  );

alter table public.passes
  add constraint passes_sequence_positive_check check (sequence is null or sequence > 0);

alter table public.passes
  add constraint passes_price_paid_cents_nonneg_check
    check (price_paid_cents is null or price_paid_cents >= 0);

create index passes_order_id_idx
  on public.passes (order_id);

create index passes_order_item_id_idx
  on public.passes (order_item_id);

create index passes_ticket_type_id_idx
  on public.passes (ticket_type_id);

create unique index passes_order_item_id_sequence_unique_idx
  on public.passes (order_item_id, sequence)
  where order_item_id is not null;

-- ---------------------------------------------------------------------------
-- Helper: unguessable public order token (for future RPC / Edge Functions)
-- ---------------------------------------------------------------------------
create or replace function public.generate_public_access_token()
returns text
language sql
volatile
as $$
  select encode(extensions.gen_random_bytes(32), 'hex');
$$;

revoke all on function public.generate_public_access_token() from public;
