# Manual verification (local dev)

Production `validate_pass` requires a real authenticated session (`auth.uid()` is non-null). The Supabase SQL Editor runs as a database superuser, **not** as a logged-in app user, so JWT claims and PostgreSQL role must be set explicitly before calling the RPC.

## Cause of the failure

1. **`auth.uid()` reads JWT claims, not your SQL variable.**  
   Supabase defines `auth.uid()` from `request.jwt.claim.sub`. Setting a PL/pgSQL variable is not enough; you must call `set_config('request.jwt.claim.sub', …)`.

2. **`validate_pass` is granted to `authenticated` only.**  
   The old script called `set_config('role', 'anon', true)` for the guest RPC test but never restored `authenticated`. The session stayed `anon`, so RPC behavior and RLS visibility diverged from a real client.

3. **RLS hides `checkins` from the verifier.**  
   Even when `validate_pass` (SECURITY DEFINER) inserted rows, the follow-up `SELECT count(*)` ran under a role/`auth.uid()` context that could not see them → `valid=0, already_used=0`.

4. **Separate production bug (fixed in migration 007):** `if found` ran after `set_config()`, not after `UPDATE`, which could mis-report race losers as `valid`.

## Option A — SQL verification (recommended local)

```bash
supabase start
supabase db reset
```

1. Create a test user in **Authentication → Users** (or sign up via the app later).
2. Copy the user UUID.
3. In SQL Editor, run **once per session**:

```sql
\i supabase/dev/auth_simulation.sql
```

Or paste the contents of `supabase/dev/auth_simulation.sql` into the editor.

4. Run `supabase/verification.sql` after replacing `v_organizer_id`.

The script uses `dev.set_auth_as()` before every `validate_pass` call and `dev.checkin_counts_for_pass()` for audit assertions.

## Option B — Supabase client (closest to production)

After you have `src/lib/supabase.ts` (not generated yet), from a logged-in organizer session:

```typescript
const { data, error } = await supabase.rpc('validate_pass', {
  p_secure_token: token,
  p_event_id: eventId,
});
// data.result: 'valid' | 'already_used' | ...
```

Call twice with the same token to confirm duplicate prevention.

Guest pass (no login):

```typescript
const { data } = await supabase.rpc('get_pass_by_token', {
  p_secure_token: token,
});
```

## What we deliberately did NOT do

- Re-add `p_scanned_by` to the RPC
- Remove `auth.uid()` ownership checks
- Add dev helpers to migrations (they stay in `supabase/dev/` only)
