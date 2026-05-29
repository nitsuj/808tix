-- LOCAL DEV ONLY — do not run on production.
-- Creates helpers in the `dev` schema for manual RPC verification.
-- These objects are NOT applied by `supabase db reset` (not in migrations/).

create schema if not exists dev;

-- Simulate a logged-in Supabase user for SQL Editor / psql testing.
-- Matches how PostgREST sets session state before calling RPCs:
--   request.jwt.claim.sub  -> auth.uid()
--   role                   -> authenticated (required for GRANT EXECUTE)
create or replace function dev.set_auth_as(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';
end;
$$;

-- Clear role override when finished testing in the same session.
create or replace function dev.reset_auth()
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', '', true);
  execute 'reset role';
end;
$$;

-- Read check-in audit rows without relying on RLS-visible session state.
-- Verification only; does not bypass validate_pass or weaken check-in rules.
create or replace function dev.checkin_counts_for_pass(p_pass_id uuid)
returns table(valid_count bigint, already_used_count bigint)
language sql
security definer
set search_path = public
as $$
  select
    count(*) filter (where result = 'valid'),
    count(*) filter (where result = 'already_used')
  from public.checkins
  where pass_id = p_pass_id;
$$;

revoke all on schema dev from public;
revoke all on all functions in schema dev from public;

-- Typical SQL Editor / postgres superuser can still call these locally.
