# 808Tix local web QA (Phase A)

Playwright-based browser checks for buyer purchase and ticket UI. Captures mobile-width screenshots for human review and runs light DOM assertions. No Stripe payment or real email required.

## Prerequisites

1. **Local Supabase**

   ```bash
   supabase start
   ```

2. **Expo env points at local Supabase**

   Copy `.env.example` → `.env` and set keys from `supabase status -o env`:

   - `EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key>`

3. **Playwright Chromium (one-time)**

   ```bash
   npx playwright install chromium
   ```

4. **Fixture values from a paid order**

   Phase A does not seed data. Use output from a prior smoke run:

   ```bash
   npm run smoke:payments:local
   ```

   Or re-verify an existing paid order without a new checkout:

   ```bash
   SMOKE_VERIFY_TOKEN=<order_public_access_token> npm run smoke:payments:local
   ```

   The smoke script prints `event_id`, `ticket_type_id`, `current_run_order_public_access_token`, and paid `ticket URL` tokens.

   **Optional DB queries** (local SQL editor or `supabase db query --local`):

   ```sql
   -- Paid order token
   select public_access_token, status
   from public.orders
   where status = 'paid'
   order by created_at desc
   limit 1;

   -- Pass secure token for a paid order
   select secure_token
   from public.passes
   where source = 'paid'
   order by created_at desc
   limit 1;

   -- Pending/cancel fixture (optional)
   select public_access_token, status
   from public.orders
   where status in ('checkout_open', 'pending')
   order by created_at desc
   limit 1;
   ```

## Required env vars

| Variable | Source |
|----------|--------|
| `QA_EVENT_ID` | Smoke output `event_id` |
| `QA_TICKET_TYPE_ID` | Smoke output `ticket_type_id` |
| `QA_PAID_ORDER_TOKEN` | Smoke output `current_run_order_public_access_token` |
| `QA_PASS_TOKEN` | Secure token from `ticket URL: http://127.0.0.1:8081/pass/{token}` |

**Optional:** `QA_PENDING_ORDER_TOKEN` — `checkout_open` or `pending` order for the cancel-page test. If omitted, that test is skipped.

Export before running, or add to `.env` (the runner hydrates missing QA vars from `.env` when present).

## Run

```bash
npm run qa:web
```

Subset (purchase flows only):

```bash
npm run qa:purchase
```

Playwright starts or reuses Expo web at `http://localhost:8081` (`npm run web -- --port 8081`).

## Screenshots

Saved to:

```
qa/artifacts/screenshots/latest/
  01-purchase-buy.png
  02-purchase-success-paid.png
  03-pass-ticket.png
  04-purchase-cancel.png      (when QA_PENDING_ORDER_TOKEN is set)
  05-pass-invalid.png
```

The directory is cleared before each run. Artifacts are gitignored.

## What remains manual

- Stripe hosted Checkout card entry
- Apple Wallet on real iOS Safari
- Real Resend email delivery and domain verification
- SMS / Twilio
- Scanner camera behavior on physical devices

## Related commands

- `npm run check:all` — static validation suite (does not include `qa:web`)
- `npm run smoke:payments:local` — Stripe API + DB integration smoke (manual card payment)
