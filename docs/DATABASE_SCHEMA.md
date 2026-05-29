# 808Tix June 10 MVP Database Schema

## Philosophy

Supabase/Postgres is the source of truth.

The June 10 MVP does not require payments, resale, transfers, or blockchain.

The database should support:

Create Event → Issue Pass → View Pass → Scan Pass → Check In

## Tables

## profiles

Stores app users such as organizers and scanners.

Fields:

* id uuid primary key references auth.users(id)
* full_name text
* email text
* role text check: organizer, scanner, guest
* created_at timestamptz default now()
* updated_at timestamptz default now()

## organizations

Stores promoter/band/event organizer entities.

Fields:

* id uuid primary key default gen_random_uuid()
* name text not null
* owner_user_id uuid references profiles(id)
* created_at timestamptz default now()
* updated_at timestamptz default now()

## organization_members

Connects users to organizations.

Fields:

* id uuid primary key default gen_random_uuid()
* organization_id uuid references organizations(id) on delete cascade
* user_id uuid references profiles(id) on delete cascade
* role text check: owner, admin, scanner
* created_at timestamptz default now()

Unique:

* organization_id, user_id

## events

Stores event records.

Fields:

* id uuid primary key default gen_random_uuid()
* organization_id uuid references organizations(id) on delete cascade
* name text not null
* venue_name text
* event_date date
* start_time time
* description text
* image_url text
* status text default 'draft' check: draft, published, completed, cancelled
* created_at timestamptz default now()
* updated_at timestamptz default now()

## pass_types

Stores ticket/pass categories such as GA, VIP, Guest List, Band Guest, Press.

Fields:

* id uuid primary key default gen_random_uuid()
* event_id uuid references events(id) on delete cascade
* name text not null
* quantity integer
* created_at timestamptz default now()

## passes

Stores individual issued mobile passes.

Fields:

* id uuid primary key default gen_random_uuid()
* event_id uuid references events(id) on delete cascade
* pass_type_id uuid references pass_types(id)
* guest_name text not null
* guest_email text
* guest_phone text
* secure_token text unique not null
* status text default 'active' check: active, checked_in, voided
* checked_in_at timestamptz
* checked_in_by uuid references profiles(id)
* created_at timestamptz default now()
* updated_at timestamptz default now()

Important:

* secure_token is used for guest pass links and QR validation.
* Do not expose raw sequential IDs in public URLs.

## checkins

Stores scan/check-in history.

Fields:

* id uuid primary key default gen_random_uuid()
* pass_id uuid references passes(id) on delete cascade
* event_id uuid references events(id) on delete cascade
* scanner_user_id uuid references profiles(id)
* result text check: valid, already_used, invalid, wrong_event, voided
* scanned_at timestamptz default now()

## Validation Logic

When scanner scans QR:

1. Look up pass by secure_token.
2. Confirm pass exists.
3. Confirm pass belongs to selected event.
4. Confirm pass status is active.
5. If active:

   * update pass status to checked_in
   * set checked_in_at
   * set checked_in_by
   * insert checkins row with result valid
6. If already checked in:

   * insert checkins row with result already_used
7. If missing/invalid:

   * insert checkins row with result invalid if possible
8. If wrong event:

   * insert checkins row with result wrong_event

## Important Constraint

Check-in should be atomic.

Two rapid scans should not both validate the same pass.

Preferred implementation:

* Supabase RPC function for validate_pass
* Function updates pass only when status = active
* If update count is 0, return already_used/invalid

## Deferred Tables

Do not create yet unless requested:

* orders
* payments
* transfers
* resale_listings
* payouts
* blockchain_assets
* loyalty_profiles
