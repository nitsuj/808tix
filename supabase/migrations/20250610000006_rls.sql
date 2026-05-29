-- 808Tix MVP: row level security

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.passes enable row level security;
alter table public.checkins enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- events
-- ---------------------------------------------------------------------------
create policy events_select_own
  on public.events
  for select
  to authenticated
  using (organizer_id = auth.uid());

create policy events_insert_own
  on public.events
  for insert
  to authenticated
  with check (organizer_id = auth.uid());

create policy events_update_own
  on public.events
  for update
  to authenticated
  using (organizer_id = auth.uid())
  with check (organizer_id = auth.uid());

create policy events_delete_own
  on public.events
  for delete
  to authenticated
  using (organizer_id = auth.uid());

-- ---------------------------------------------------------------------------
-- passes
-- ---------------------------------------------------------------------------
create policy passes_select_own_events
  on public.passes
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.events e
      where e.id = passes.event_id
        and e.organizer_id = auth.uid()
    )
  );

create policy passes_insert_own_events
  on public.passes
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.events e
      where e.id = passes.event_id
        and e.organizer_id = auth.uid()
    )
  );

create policy passes_update_own_events
  on public.passes
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.events e
      where e.id = passes.event_id
        and e.organizer_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.events e
      where e.id = passes.event_id
        and e.organizer_id = auth.uid()
    )
  );

create policy passes_delete_own_events
  on public.passes
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.events e
      where e.id = passes.event_id
        and e.organizer_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- checkins (read-only for clients; writes only via validate_pass RPC)
-- ---------------------------------------------------------------------------
create policy checkins_select_own_events
  on public.checkins
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.events e
      where e.id = checkins.event_id
        and e.organizer_id = auth.uid()
    )
  );
