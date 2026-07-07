# Stripe Payments (Phase 1.5)

Server-side Stripe Checkout and webhook handling for paid ticketing. Ticket minting happens only in the database via `fulfill_paid_order`.

## Edge Functions

| Function | Purpose | JWT required |
|----------|---------|--------------|
| `create-checkout-session` | Reserve order + start Stripe Checkout | No (`verify_jwt = false`) |
| `stripe-webhook` | Verify Stripe events + fulfill orders | No |

## Required secrets

Set in Supabase Dashboard → Edge Functions → Secrets, or locally in `supabase/functions/.env` (gitignored):

| Variable | Used by | Notes |
|----------|---------|-------|
| `STRIPE_SECRET_KEY` | Both | Stripe test or live secret key (`sk_test_...` / `sk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | `stripe-webhook` only | From Stripe webhook endpoint (`whsec_...`) |
| `SUPABASE_URL` | Both | Auto-injected locally when serving functions |
| `SUPABASE_SERVICE_ROLE_KEY` | Both | Service role only — never in Expo `.env` |
| `PUBLIC_SITE_URL` | Optional | Buyer site origin for docs/examples (e.g. `https://808tix.vercel.app`) |

Do **not** put Stripe secrets in `EXPO_PUBLIC_*` or any `src/` file.

## Validation after code changes

After code changes, run:

```bash
npm run check:all
```

Targeted modes:

```bash
npm run check:all -- --fast      # preflight + lint only
npm run check:all -- --payments  # payment-related checks only (no lint)
```

After payment changes that require a real Stripe checkout, also run:

```bash
npm run smoke:payments:local
```

## Local smoke test (automated)

Three terminals:

**Terminal A — Edge Functions**

```bash
supabase functions serve create-checkout-session stripe-webhook --env-file supabase/functions/.env
```

**Terminal B — Stripe webhook forwarding**

```bash
stripe listen --forward-to http://127.0.0.1:54321/functions/v1/stripe-webhook
```

Copy the `whsec_...` signing secret from `stripe listen` into `supabase/functions/.env` as `STRIPE_WEBHOOK_SECRET`.

**Terminal C — smoke automation**

The smoke script bootstraps its own organizer/event/ticket type after `db reset` and parses `supabase db query` output in both table and JSON formats (no `psql` required).

```bash
npm run smoke:payments:local
```

The smoke script:

- Verifies local Supabase, DB access, and function reachability
- Bootstraps a smoke organizer (`auth.users` + `profiles`), paid event, and ticket type after `db reset`
- Calls `create-checkout-session` with the local publishable/anon key
- Verifies pre-payment `get_order_by_public_token` does not expose ticket tokens
- Pauses for you to complete Stripe test payment (`4242 4242 4242 4242`)
- Polls the database and asserts order paid, payment row, 2 paid passes, payout row, and buyer-safe lookup
- Tracks the exact `order_public_access_token` from the current `create-checkout-session` response for all post-payment SQL (older `checkout_open` orders are ignored)

**Re-verify an already-paid order** (skip bootstrap/checkout/manual payment):

```bash
SMOKE_VERIFY_TOKEN=<order_public_access_token> npm run smoke:payments:local
```

### `supabase/functions/.env` (local only)

Use **test mode** Stripe keys only. Do not commit real secrets.

```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

Local Supabase may reserve `SUPABASE_*` env names inside the Edge runtime — the functions server injects `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` automatically. Your `.env` file only needs Stripe-specific secrets unless serving outside `supabase functions serve`.

Do **not** use live mode keys (`sk_live_...`) for local smoke tests.

## Local setup

1. Apply migrations (includes lifecycle RPCs + service_role grant):

   ```bash
   supabase db reset
   ```

2. Copy env template:

   ```bash
   cp supabase/functions/.env.example supabase/functions/.env
   ```

3. Fill in Stripe test keys and service role key in `supabase/functions/.env`.

4. Serve functions:

   ```bash
   supabase functions serve create-checkout-session stripe-webhook --env-file supabase/functions/.env
   ```

5. Forward Stripe webhooks to local function:

   ```bash
   stripe listen --forward-to http://127.0.0.1:54321/functions/v1/stripe-webhook
   ```

   Use the `whsec_...` signing secret from `stripe listen` as `STRIPE_WEBHOOK_SECRET` locally.

## Test checkout flow

Prerequisites:

- Published event with `sales_enabled = true` and `ticketing_mode` in (`paid`, `mixed`)
- Active `ticket_types` row for the event

1. Create checkout session (replace IDs and URLs):

   ```bash
   curl -s -X POST 'http://127.0.0.1:54321/functions/v1/create-checkout-session' \
     -H 'Content-Type: application/json' \
     -H 'apikey: YOUR_ANON_KEY' \
     -d '{
       "event_id": "EVENT_UUID",
       "ticket_type_id": "TICKET_TYPE_UUID",
       "quantity": 2,
       "buyer_email": "buyer@example.com",
       "buyer_name": "Test Buyer",
       "success_url": "https://808tix.vercel.app/checkout/success",
       "cancel_url": "https://808tix.vercel.app/checkout/cancel"
     }'
   ```

2. Open returned `checkout_url` in a browser.

3. Pay with Stripe test card `4242 4242 4242 4242`, any future expiry, any CVC.

4. Stripe sends `checkout.session.completed` → `stripe-webhook` → `fulfill_paid_order`.

## Expected DB state after successful checkout

| Table / RPC | Expected |
|-------------|----------|
| `orders` | `status = paid`, `stripe_checkout_session_id` set, `paid_at` set |
| `payments` | One row, `status = succeeded`, `amount_cents = orders.total_cents` |
| `passes` | `N` rows where `N = order_items.quantity`, `source = paid` |
| `organizer_payouts` | One `pending` row for `organizer_net_cents` |
| `payment_events` | Webhook row `processing_status = processed` |

Poll buyer-safe status (no Stripe secrets):

```sql
select public.get_order_by_public_token('ORDER_PUBLIC_ACCESS_TOKEN');
```

Paid orders return `tickets` with `secure_token` values. Pending/checkout orders return `tickets = null`.

## Expected DB state after expired checkout

When Stripe Checkout expires (`checkout.session.expired`) or `expire_stale_orders` runs:

| Table | Expected |
|-------|----------|
| `orders` | `status = expired` |
| `passes` | No rows for that order |
| `payments` | No row for that order |

## Security notes

- `create-checkout-session` uses service role server-side only.
- `stripe-webhook` verifies `Stripe-Signature` before processing.
- Neither function inserts into `passes` directly.
- All ticket minting goes through `fulfill_paid_order`.
- Success URLs receive `order_token` query param only — they do not mint tickets.

## Public purchase read RPC

Buyer purchase UI loads display data via:

```sql
select public.get_public_event_purchase_options('EVENT_UUID');
```

Callable by `anon` and `authenticated`. Returns `null` when the event is not published, `sales_enabled` is false, or `ticketing_mode` is `comp_only`.

Returns safe event fields (name, venue, date, fees) and active in-window ticket types with `quantity_available`. Does not expose organizer IDs, Stripe IDs, orders, or payments. Table RLS remains unchanged — no broad anon `SELECT` on `events` / `ticket_types`.

## Buyer purchase UI

Public Expo Router screens (no auth required):

| Route | Purpose |
|-------|---------|
| `/events/{eventId}/buy?ticket_type_id={ticketTypeId}` | Purchase page — loads options RPC, quantity + email, starts checkout |
| `/purchase/success?order_token={publicAccessToken}` | Post-payment confirmation — polls `get_order_by_public_token` |
| `/purchase/cancel?order_token={publicAccessToken}` | Checkout canceled — optional retry when `event_id` + `ticket_type_id` are present |

The UI never mints passes. Checkout uses `create-checkout-session`; tickets appear only after `stripe-webhook` → `fulfill_paid_order`.

### Local buyer UI test (three terminals)

**Terminal A — Edge Functions**

```bash
supabase functions serve create-checkout-session stripe-webhook --env-file supabase/functions/.env
```

**Terminal B — Stripe webhook forwarding**

```bash
stripe listen --forward-to http://127.0.0.1:54321/functions/v1/stripe-webhook
```

Copy `whsec_...` from `stripe listen` into `supabase/functions/.env` as `STRIPE_WEBHOOK_SECRET`.

**Terminal C — Expo web + manual checkout**

```bash
npx expo start --web
```

1. Ensure a published event with `sales_enabled = true`, `ticketing_mode` in (`paid`, `mixed`), and an active `ticket_types` row.
2. Open:

   ```
   http://localhost:8081/events/{eventId}/buy?ticket_type_id={ticketTypeId}
   ```

3. Enter email, choose quantity, tap **Continue to payment**.
4. Pay with Stripe test card `4242 4242 4242 4242`.
5. Confirm redirect to `/purchase/success?order_token=...` with inline QR tickets per purchase (**Add to Apple Wallet** on iOS, **Share** with clipboard fallback).
6. Open each ticket and confirm QR works at `/pass/{secure_token}`.

Paid success shows each ticket inline with a scannable QR code (same payload as `/pass/{token}`). Share copies the pass URL when native share is unavailable. On web, share URLs use `window.location.origin` (local QA: `http://localhost:8081/pass/{token}`). Add to Apple Wallet reuses the same client component as `/pass/{token}`.

`get_order_by_public_token` also returns event `venue_name`, `event_date`, `start_time`, and `image_url` for inline ticket artwork and details.

### Automated smoke test (API + DB, no UI)

```bash
npm run smoke:payments:local
```

Bootstraps organizer/event/ticket type, calls `create-checkout-session`, pauses for manual Stripe payment, then verifies paid order + passes in the database. Use `SMOKE_VERIFY_TOKEN=...` to re-verify an already-paid order without a new checkout.

## Email delivery (Phase 1.6 + webhook)

After Stripe payment fulfillment, buyers can receive an order confirmation email. Ticket minting via `fulfill_paid_order` remains the source of truth.

| Piece | Status |
|-------|--------|
| `public.outbound_messages` | Idempotency + audit log for email and future SMS |
| `_shared/order-email.ts` | Email builder + Resend wrapper + outbound claim/update |
| `_shared/pass-link-server.ts` | Server-side `PUBLIC_SITE_URL` pass/success links |
| `send-order-confirmation-email` | Manual/local test (service role required) |
| `stripe-webhook` integration | **Implemented** — non-blocking after `fulfill_paid_order` |

**Webhook flow (`checkout.session.completed`, `payment_status=paid`):**

1. Verify Stripe signature
2. Claim `payment_events` (idempotent)
3. Call `fulfill_paid_order`
4. Trigger `sendOrderConfirmationEmail` (errors caught/logged; webhook still returns success)
5. Mark webhook processed

**Email failure is non-blocking:** if fulfillment succeeds but email fails, Stripe still receives `200` from `stripe-webhook`. Failures are recorded in `outbound_messages` and function logs. Paid passes are already minted.

**Idempotency key:** `order_confirmation:{order_id}` — duplicate webhook/email attempts do not resend when already `sent`/`skipped`.

**Env vars** (Edge Functions / `supabase/functions/.env` only — never `EXPO_PUBLIC_*`):

| Variable | Purpose |
|----------|---------|
| `PUBLIC_SITE_URL` | Absolute `/pass/{token}` and success-page links in email |
| `RESEND_API_KEY` | Transactional email provider (send mode) |
| `EMAIL_FROM` | Verified sender address (send mode) |
| `EMAIL_DELIVERY_MODE` | `preview` (log only) or `send` |
| `EMAIL_OVERRIDE_TO` | Local QA — redirect all mail to one inbox |

Serve **both** payment functions with the same env file when testing email via webhook:

```bash
supabase functions serve create-checkout-session stripe-webhook --env-file supabase/functions/.env
```

### Preview / manual email test

#### Option A — manual function (no Stripe payment)

1. Apply migrations and complete a paid order (or use an existing paid `order_public_access_token`).
2. Serve functions with email env vars:

```bash
supabase functions serve send-order-confirmation-email --env-file supabase/functions/.env
```

Recommended local `.env` values:

```bash
PUBLIC_SITE_URL=http://localhost:8081
EMAIL_DELIVERY_MODE=preview
EMAIL_OVERRIDE_TO=you@yourdomain.com
# RESEND_API_KEY=   # omit for preview
# EMAIL_FROM=Tickets <tickets@your-verified-domain>
```

3. Call the manual test function with **service role** auth:

```bash
curl -sS -X POST "http://127.0.0.1:54321/functions/v1/send-order-confirmation-email" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"order_public_access_token":"YOUR_PAID_ORDER_TOKEN"}'
```

#### Option B — preview via Stripe webhook (full checkout path)

**One command (recommended):**

```bash
npm run check:env
npm run smoke:payments:preview
```

`check:env` verifies local Supabase, Expo env, schema/RPC readiness, Stripe/email env (secrets masked), and fixture compatibility before you start services.

```bash
npm run smoke:payments:preview
```

This orchestrator (local only):

- Verifies local Supabase and Stripe CLI
- Starts or reuses Expo web at `http://localhost:8081` (Stripe success/cancel redirects require this)
- Starts `stripe listen` and captures the `whsec_...` signing secret for `stripe-webhook`
- Serves `create-checkout-session` and `stripe-webhook` with preview email env (`PUBLIC_SITE_URL=http://localhost:8081`, `EMAIL_DELIVERY_MODE=preview`, default `EMAIL_OVERRIDE_TO=preview@example.test`)
- Runs `npm run smoke:payments:local`
- Queries `outbound_messages` for a preview `order_confirmation` row (`provider='preview'`, `status='sent'`)
- Writes prefixed logs to `qa/artifacts/smoke-preview/latest.log` (`[stripe]`, `[functions]`, `[web]`, `[smoke]`)

**Card entry stays manual:** complete Stripe Checkout in the browser when the smoke script prints the URL. The command automates local services, not provider-hosted card entry.

If Expo web is already running on port 8081, the orchestrator reuses it and does not stop it on exit.

Safety defaults: refuses non-local Supabase unless `SMOKE_ALLOW_REMOTE=true`; refuses `sk_live_...` unless `SMOKE_ALLOW_LIVE_STRIPE=true`; forces preview email unless `SMOKE_EMAIL_SEND=true`.

**Three-terminal fallback (debug):**

1. Set email env vars in `supabase/functions/.env` (preview recommended locally):

```bash
PUBLIC_SITE_URL=http://localhost:8081
EMAIL_DELIVERY_MODE=preview
EMAIL_OVERRIDE_TO=you@yourdomain.com
```

2. Serve payment functions:

```bash
supabase functions serve create-checkout-session stripe-webhook --env-file supabase/functions/.env
```

3. In another terminal, forward Stripe webhooks:

```bash
stripe listen --forward-to http://127.0.0.1:54321/functions/v1/stripe-webhook
```

4. Run the payments smoke test and complete Checkout manually:

```bash
npm run smoke:payments:local
```

5. Inspect delivery log:

```sql
select status, provider, recipient, message_type, attempt_count, error, payload_snapshot, created_at
from public.outbound_messages
where message_type = 'order_confirmation'
order by created_at desc
limit 5;
```

Preview mode logs subject/pass count to the function console and writes `outbound_messages` with `provider='preview'`. It does **not** call Resend.

**Send mode** requires `EMAIL_DELIVERY_MODE=send`, verified `EMAIL_FROM`, and `RESEND_API_KEY` with a verified Resend domain. Real delivery is separate from local preview/webhook testing.

Verify the table locally after `supabase db reset`:

```bash
# SQL Editor or psql
\i supabase/verification-outbound-messages.sql
```

**Stripe smoke:** `npm run smoke:payments:preview` is the one-command local preview path (checkout + webhook + email preview). `npm run smoke:payments:local` remains the lower-level smoke script when you run services yourself.
