# P0 Launch Acceptance

Source of truth for what must be true before claiming 808Tickets is launch-ready.

Cursor agents must follow [.cursor/rules/808tickets-release-gate.mdc](../.cursor/rules/808tickets-release-gate.mdc) so P0 proof is not re-stated in every prompt.

**Before any launch claim, run an explicit proof mode:**

```bash
# Prelaunch hosted QA (Stripe TEST keys allowed intentionally)
npm run release:proof -- --prelaunch

# Live launch gate (expects sk_live_* by default)
npm run release:proof -- --live
```

Then manually run hosted checkout smoke on `https://808tickets.com` (not automated by this repo).

`release:proof` without a mode prints usage and exits — choose `--prelaunch` or `--live`.

**Related:** [LAUNCH_STABILITY.md](./LAUNCH_STABILITY.md) · [EVENT_DAY_RUNBOOK.md](./EVENT_DAY_RUNBOOK.md) · [DOMAIN_CUTOVER.md](./DOMAIN_CUTOVER.md) · [AUTH_EMAIL_RESEND.md](./AUTH_EMAIL_RESEND.md) · [PAYOUT_RULES.md](./PAYOUT_RULES.md) · [qa/README.md](../qa/README.md)

---

## Product goal

Replace guest lists, clipboards, and Eventbrite-style check-in lists with mobile tickets and QR validation.

A launch claim means a real consumer can buy (or receive) a ticket on **808tickets.com**, open it on a phone, add it to Apple Wallet when available, and get scanned at the door — with duplicate scans rejected.

---

## P0 organizer journey

1. Create account and confirm email (inbox proof via Resend-backed Supabase Auth SMTP).
2. Reset password (inbox + update-password UI).
3. Create event.
4. Set date/time using working pickers (year visible; 12-hour AM/PM time UX).
5. Create ticket type with price and quantity (free tickets allowed when the organizer is giving them away).
6. Publish/list event publicly on 808tickets.com.
7. Issue a manual ticket.
8. Share/send that manual ticket clearly (Share Ticket; SMS only if Twilio is configured).
9. Scan tickets at the door.

---

## P0 consumer journey

1. Discover an event on `https://808tickets.com`.
2. View event details.
3. Select a priced ticket (or free ticket if the organizer is giving them away).
4. Complete Stripe Checkout (hosted).
5. Land on success page with ticket QR.
6. Receive order confirmation email with working ticket link.
7. Open ticket link on mobile.
8. Add ticket to Apple Wallet.
9. Have ticket scanned successfully.
10. Duplicate scan is rejected.

---

## P0 payment / email / ticket journey

| Step | Required proof |
|------|----------------|
| Public event + active ticket type | Live on 808tickets.com |
| Checkout session | Hosted `create-checkout-session` |
| Stripe payment | Hosted Checkout + working hosted webhook (`stripe-webhook` + `STRIPE_WEBHOOK_SECRET`) |
| Fulfillment | Remote RPCs `create_pending_order`, `fulfill_paid_order` |
| Success page QR | Browser proof on hosted success URL |
| Order confirmation email | Real inbox delivery (Resend send mode), not API smoke alone |
| Guest ticket open | `/pass/{token}` via `get_pass_by_token` |

---

## P0 Wallet / scanner journey

| Step | Required proof |
|------|----------------|
| Apple Wallet | Required for mobile-first launch — hosted `wallet-apple` + Apple cert secrets present |
| First scan | `validate_pass` returns valid / check-in recorded |
| Duplicate scan | Rejected (`already_used` or equivalent) |

Local `npm run smoke:checkin` proves backend scan behavior. Hosted door acceptance still requires a live scan on production tickets.

---

## P0 hosted infrastructure requirements

Verified by `npm run check:hosted` (presence/status only — never print secret values):

- Migrations: no local-only pending vs remote (`supabase migration list`; remediate with `supabase db push` when appropriate).
- Remote RPCs: `create_pending_order`, `fulfill_paid_order`, `get_order_by_public_token`, `get_pass_by_token`, `validate_pass`.
- Edge Functions deployed: `create-checkout-session`, `stripe-webhook`, `send-order-confirmation-email`, `wallet-apple`.
- Optional / warn: `send-pass-sms` + Twilio secrets.
- Hosted secrets present (names only): `PUBLIC_SITE_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `EMAIL_DELIVERY_MODE`, `EMAIL_FROM`, `RESEND_API_KEY`, Apple Wallet cert suite.
- Domains: `https://808tickets.com` responds; `https://www.808tickets.com` redirects/responds.
- Clean URLs (no `.html`): `/login`, `/privacy`, `/terms`, `/home`, `/profile`, `/events/create` return HTTP 200 (see `vercel.json` + `docs/DOMAIN_CUTOVER.md`).
- Legacy `808tix.vercel.app` redirect is a transition note only — not the launch canonical origin.

---

## What counts as proof

| Proof | Counts for |
|-------|------------|
| `npm run release:proof -- --prelaunch` green | Hosted readiness + static/UI + local browser/check-in proof (Stripe test allowed) |
| `npm run release:proof -- --live` green | Same gates with live Stripe key expectations |
| Playwright screenshots under `qa/artifacts/screenshots/latest/` | UI acceptance for covered auth/buyer states |
| Hosted logs / function status / migration list / secrets **names** | Hosted infrastructure acceptance |
| Real inbox message (confirm / reset / order email) | Email delivery acceptance |
| Real Stripe Checkout purchase on 808tickets.com | Hosted payment acceptance |
| Live Apple Wallet add + door scan on production ticket | Wallet/scanner launch acceptance |

---

## What does not count as proof

- **Static checks alone do not prove UI readiness.**
- **Local smoke alone does not prove hosted readiness.**
- **Resend API smoke alone does not prove Supabase Auth email** unless auth SMTP inbox proof is confirmed (`docs/AUTH_EMAIL_RESEND.md` + `AUTH_SMTP_OPERATOR_CONFIRMED`).
- Passing `check:all` without screenshots / journeys / hosted status is insufficient for a launch claim.
- Deploying code without a public priced (or intentionally free) buyable event does not prove checkout.

---

## Manual launch blockers

These remain **external** until proven manually on hosted:

1. Supabase Auth **Confirm Email ON** + Resend SMTP inbox proof (signup + password reset).
2. Public checkout on `https://808tickets.com` for a real published event with a ticket type.
3. Hosted Stripe webhook delivering `checkout.session.completed` → fulfillment → tickets.
4. Order confirmation email arriving in a real inbox with correct `808tickets.com` links.
5. Apple Wallet add on a production ticket.
6. Door scan + duplicate rejection on a production ticket.
7. Platform admin can open `https://808tickets.com/admin` (no public nav), open event detail at `/admin/events/:eventId`, and answer event/order/payout/fee questions without raw DB queries. Promote via SQL/`service_role` only (`profiles.is_platform_admin`). See [PAYOUT_RULES.md](./PAYOUT_RULES.md).

**Public checkout is not launch-ready unless a public event with a priced ticket (or intentional free ticket) can be bought on 808tickets.com.**

**Hosted checkout is not valid unless the Stripe hosted webhook is configured and working.**

**Apple Wallet is required for mobile-first launch.**

---

## Definition of Done

Launch may be claimed only when **all** are true:

1. `npm run release:proof -- --prelaunch` (prelaunch) or `npm run release:proof -- --live` (live) passes.
2. Hosted readiness table from `npm run check:hosted` has no required FAILs.
3. Auth UI journeys are screenshot-proven (`qa:web` auth artifacts).
4. Manual hosted checkout smoke succeeds on 808tickets.com (QR on success page).
5. Order confirmation email inbox proof succeeded.
6. Auth confirmation + password reset inbox proof succeeded (or explicitly deferred with operator sign-off).
7. Apple Wallet add works on a production ticket.
8. Scanner accepts a valid ticket and rejects a duplicate.

Until then: **no proof, no progress — no journey, no launch.**
