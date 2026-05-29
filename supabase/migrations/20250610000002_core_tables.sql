-- 808Tix MVP: core tables (profiles, events, passes, checkins)

-- ---------------------------------------------------------------------------
-- Shared: updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- events
-- ---------------------------------------------------------------------------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.profiles (id) on delete restrict,
  slug text not null,
  name text not null,
  venue_name text,
  event_date date,
  start_time time,
  description text,
  image_url text,
  status text not null default 'published'
    check (status in ('draft', 'published', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_slug_format_check
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint events_slug_unique unique (slug)
);

create index events_organizer_id_created_at_idx
  on public.events (organizer_id, created_at desc);

create trigger events_set_updated_at
  before update on public.events
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- passes
-- ---------------------------------------------------------------------------
create table public.passes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  guest_name text not null,
  guest_email text,
  guest_phone text,
  pass_type text not null,
  secure_token text not null,
  status text not null default 'active'
    check (status in ('active', 'checked_in', 'voided')),
  checked_in_at timestamptz,
  checked_in_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint passes_secure_token_unique unique (secure_token)
);

create index passes_event_id_status_idx
  on public.passes (event_id, status);

create index passes_event_id_created_at_idx
  on public.passes (event_id, created_at desc);

create trigger passes_set_updated_at
  before update on public.passes
  for each row
  execute function public.set_updated_at();

-- Server-side secure_token when not supplied on insert
create or replace function public.set_pass_secure_token()
returns trigger
language plpgsql
as $$
begin
  if new.secure_token is null or btrim(new.secure_token) = '' then
    new.secure_token := encode(extensions.gen_random_bytes(32), 'hex');
  end if;
  return new;
end;
$$;

create trigger passes_set_secure_token
  before insert on public.passes
  for each row
  execute function public.set_pass_secure_token();

-- Block client-side status changes (only validate_pass may change status)
create or replace function public.prevent_pass_status_client_update()
returns trigger
language plpgsql
as $$
begin
  if old.status is distinct from new.status then
    if current_setting('app.allow_pass_status_update', true) is distinct from 'true' then
      raise exception 'Pass status can only be changed via validate_pass'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger passes_prevent_status_client_update
  before update on public.passes
  for each row
  execute function public.prevent_pass_status_client_update();

-- ---------------------------------------------------------------------------
-- checkins (append-only audit log)
-- ---------------------------------------------------------------------------
create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  pass_id uuid references public.passes (id) on delete set null,
  event_id uuid not null references public.events (id) on delete cascade,
  scanned_by uuid not null references public.profiles (id) on delete restrict,
  result text not null
    check (result in ('valid', 'already_used', 'invalid', 'wrong_event', 'voided')),
  scanned_at timestamptz not null default now()
);

create index checkins_event_id_scanned_at_idx
  on public.checkins (event_id, scanned_at desc);

create index checkins_pass_id_scanned_at_idx
  on public.checkins (pass_id, scanned_at desc);
