# Launch Stability — Auth, Pickers, Ticket Delivery

Hosted/domain testing blockers and explicit launch expectations.

**P0 source of truth:** [P0_ACCEPTANCE.md](./P0_ACCEPTANCE.md)

Before any launch claim:

```bash
# Prelaunch hosted QA (Stripe TEST allowed)
npm run release:proof -- --prelaunch

# Live Stripe expectations
npm run release:proof -- --live
```

Then manually run hosted checkout smoke on `https://808tickets.com`.

`release:proof -- --prelaunch` proves readiness gates but does **not** run hosted checkout.

## Auth: email confirmation (dashboard config)

App signup already uses `supabase.auth.signUp` with `emailRedirectTo` from `resolveAuthEmailRedirectUrl()`. It does **not** admin-create users or auto-confirm in application code.

If new users appear immediately confirmed and receive **no** verification email:

**Supabase Dashboard → Authentication → Providers → Email → Confirm Email must be ON.**

With Confirm Email OFF, Supabase returns a session on signup and skips the confirmation email. The app correctly treats that as a signed-in user (`needsEmailConfirmation` is false when a session is returned).

Also verify Auth URL allow list includes the app callback (local + `https://808tickets.com` auth callback).

### Resend SMTP (production auth mail)

Auth emails must go through **Resend-backed Supabase Auth SMTP**. Full checklist:

See **`docs/AUTH_EMAIL_RESEND.md`**.

Exact settings:

- Host: `smtp.resend.com`
- Port: `587`
- Username: `resend`
- Password: Resend API key
- Sender: `808Tickets <tickets@808tickets.com>` (or verified Resend sender)
- Site URL: `https://808tickets.com`
- Redirect URLs: `https://808tickets.com/**`, `http://localhost:8081/**`

Inbox delivery is an **external** verification step. App QA proves UI only.

## Password recovery

Supported in-app:

1. Sign In → **Forgot password?** (visible on the default auth page)
2. Request reset email via `supabase.auth.resetPasswordForEmail` + `resolveAuthEmailRedirectUrl()`
3. Reset link opens auth callback → password recovery pending → **Update Password** via `supabase.auth.updateUser({ password })`

Browser proof (Playwright `qa:web`):

- `06-auth-default.png` — Forgot password visible
- `07-auth-forgot-password.png` — reset request UI
- `08-auth-reset-sent.png` — reset-sent message
- `09-auth-check-email.png` — signup check-email UI

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
