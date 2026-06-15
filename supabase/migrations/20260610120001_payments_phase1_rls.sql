-- 808Tix Phase 1.5: RLS for paid ticketing tables.
-- Public buyer purchase will use Edge Functions + RPC later (no broad anon table access).

alter table public.ticket_types enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.payment_events enable row level security;
alter table public.organizer_payouts enable row level security;

-- ---------------------------------------------------------------------------
-- ticket_types — organizer CRUD on own events; no anon policy (public RPC later)
-- ---------------------------------------------------------------------------
create policy ticket_types_select_own_events
  on public.ticket_types
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.events e
      where e.id = ticket_types.event_id
        and e.organizer_id = auth.uid()
    )
  );

create policy ticket_types_insert_own_events
  on public.ticket_types
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.events e
      where e.id = ticket_types.event_id
        and e.organizer_id = auth.uid()
    )
  );

create policy ticket_types_update_own_events
  on public.ticket_types
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.events e
      where e.id = ticket_types.event_id
        and e.organizer_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.events e
      where e.id = ticket_types.event_id
        and e.organizer_id = auth.uid()
    )
  );

create policy ticket_types_delete_own_events
  on public.ticket_types
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.events e
      where e.id = ticket_types.event_id
        and e.organizer_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- orders — organizer read only on own events
-- ---------------------------------------------------------------------------
create policy orders_select_own_events
  on public.orders
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.events e
      where e.id = orders.event_id
        and e.organizer_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- order_items — organizer read via parent order
-- ---------------------------------------------------------------------------
create policy order_items_select_own_events
  on public.order_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.orders o
      inner join public.events e on e.id = o.event_id
      where o.id = order_items.order_id
        and e.organizer_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- payments — organizer read via parent order
-- ---------------------------------------------------------------------------
create policy payments_select_own_events
  on public.payments
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.orders o
      inner join public.events e on e.id = o.event_id
      where o.id = payments.order_id
        and e.organizer_id = auth.uid()
    )
  );

-- payment_events, organizer_payouts: RLS enabled, no authenticated policies.
-- Service role (Edge Functions) bypasses RLS for webhook writes and admin ops.
