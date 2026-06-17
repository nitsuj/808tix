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
