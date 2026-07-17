# Launch Stability — Auth, Pickers, Ticket Delivery

Hosted/domain testing blockers and explicit launch expectations.

## Auth: email confirmation (dashboard config)

App signup already uses `supabase.auth.signUp` with `emailRedirectTo` from `resolveAuthEmailRedirectUrl()`. It does **not** admin-create users or auto-confirm in application code.

If new users appear immediately confirmed and receive **no** verification email:

**Supabase Dashboard → Authentication → Providers → Email → Confirm Email must be ON.**

With Confirm Email OFF, Supabase returns a session on signup and skips the confirmation email. The app correctly treats that as a signed-in user (`needsEmailConfirmation` is false when a session is returned).

Also verify Auth URL allow list includes the app callback (local + `https://808tickets.com` auth callback).

## Password recovery

Supported in-app:

1. Sign In → **Forgot password?**
2. Request reset email via `supabase.auth.resetPasswordForEmail` + `resolveAuthEmailRedirectUrl()`
3. Reset link opens auth callback → password recovery pending → **Update Password** via `supabase.auth.updateUser({ password })`

## Create Event date / time pickers

- Date: `EventDateFormField` — tap trigger opens native/web date picker; display includes year.
- Time: `EventStartTimeField` — tap trigger opens time picker; **12-hour AM/PM** display (`is24Hour={false}` on native). Stored value remains `HH:MM` 24-hour for the backend.

## Manual Issue Ticket notifications

| Channel | Launch behavior |
|---------|-----------------|
| Email | **Not automatic.** Guest email is stored for contact. Copy tells organizers to use **Share Ticket**. Paid order confirmation email is separate and unchanged. |
| SMS | Optional after issue when a phone is present. Calls Edge Function `send-pass-sms` (Twilio). See `docs/SMS_DELIVERY.md`. |
| Share link | Primary delivery path for manual issues. |

**Launch blocker note:** Do not claim automatic ticket email for manual Issue Ticket until a dedicated send path exists. Share + optional SMS is the designed launch path.

## SMS readiness

- Wired in Issue Pass success UI when `guest_phone` is present.
- Launch-ready only when Twilio secrets are set and `send-pass-sms` is deployed (see `docs/SMS_DELIVERY.md`).
- Without Twilio config, SMS is **not** launch-ready; Share Ticket still works.
