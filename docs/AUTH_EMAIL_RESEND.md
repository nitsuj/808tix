# Auth Email via Resend SMTP (Supabase Auth)

Auth confirmation and password-reset emails are sent by **Supabase Auth**, not by Expo app code.
Delivery requires hosted dashboard SMTP configuration. App/static checks cannot prove inbox delivery.

## Required dashboard setup

**Supabase Dashboard → Authentication → SMTP settings** (custom SMTP / Email):

| Setting | Value |
|---------|--------|
| Provider | Resend SMTP |
| Host | `smtp.resend.com` |
| Port | `587` |
| Username | `resend` |
| Password | Resend API key (`RESEND_API_KEY`) |
| Sender | `808Tickets <tickets@808tickets.com>` (or another verified Resend sender) |

**Supabase Dashboard → Authentication → Providers → Email:**

- **Confirm Email: ON**

**Supabase Dashboard → Authentication → URL Configuration:**

- **Site URL:** `https://808tickets.com`
- **Redirect URLs** include:
  - `https://808tickets.com/**`
  - `http://localhost:8081/**`

Also review Auth email templates (Confirm signup / Reset password) so copy says 808Tickets, not default Supabase branding.

## Operator confirmation (launch gate)

SMTP and Confirm Email cannot be verified from this repository.

After you complete the dashboard setup and a successful inbox test:

1. Set in the operator environment (not committed):
   ```bash
   export AUTH_SMTP_OPERATOR_CONFIRMED=true
   ```
2. Or document confirmation in your launch runbook / incident notes.

Until then, treat **production auth email delivery as an external launch blocker**.

`npm run check:auth-launch-stability` prints a clear warning when `AUTH_SMTP_OPERATOR_CONFIRMED` is not `true`.
With `REQUIRE_AUTH_SMTP_CONFIRMATION=true`, that check **fails** until the operator confirms.

## Manual inbox verification checklist

Do this on production (`https://808tickets.com`) after SMTP is configured:

1. Create a **new** organizer account with a real inbox you control.
2. Confirm a verification email arrives from the Resend-backed sender (`tickets@808tickets.com` or verified sender).
3. Click the confirmation link.
4. Confirm you can sign in.
5. Use **Forgot password?** and request a reset.
6. Confirm the reset email arrives.
7. Open the reset link and set a new password.
8. Confirm sign-in with the new password.

Optional provider proof: Resend dashboard → Emails / events for the same message IDs.

## What the app verifies (not inbox)

App/QA prove:

- Signup uses `supabase.auth.signUp` + `emailRedirectTo` (no admin create / no app-side auto-confirm).
- Check-email UI when confirmation is required.
- Forgot password is visible on the auth page.
- Reset request → reset-sent UI.
- Update password UI when a recovery session is present.
- Playwright screenshots under `qa/artifacts/screenshots/latest/`:
  - `06-auth-default.png`
  - `07-auth-forgot-password.png`
  - `08-auth-reset-sent.png`
  - `09-auth-check-email.png`

Optional response-shape smoke (does **not** prove delivery):

```bash
npm run smoke:auth:response
```

## Related

- App redirect helper: `src/lib/auth-redirect-url.ts` → production fallback `https://808tickets.com`
- Launch notes: `docs/LAUNCH_STABILITY.md`
