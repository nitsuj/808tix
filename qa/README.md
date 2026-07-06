# 808Tix local web QA

Playwright-based browser checks for buyer purchase and ticket UI. Captures mobile-width screenshots for human review and runs light DOM assertions. No Stripe payment or real email required.

## Quick start

```bash
supabase start
npx playwright install chromium   # one-time
```

Point Expo web at **local** Supabase in your shell (see below), then:

```bash
npm run qa:env
# copy/paste the printed exports into your terminal, then:
npm run qa:seed
npm run qa:web
```

`qa:env` reads `supabase status -o env` and prints copy-pasteable `export` commands. npm cannot modify your parent shell — paste or eval the output in the terminal where you run QA.

`qa:seed` writes `qa/fixtures.json` (gitignored). `qa:web` loads those fixtures automatically.

## Local Supabase env (required)

`qa:seed` writes fixture data to **local** Supabase (`http://127.0.0.1:54321`). `qa:web` runs Expo web in the browser, which reads `EXPO_PUBLIC_SUPABASE_URL` from your environment (often via `.env`).

If Expo web points at hosted Supabase while fixtures are local, browser tests will fail. **`qa:web` now refuses that mismatch** and exits before Playwright starts.

### `npm run qa:env`

Prints local Expo Supabase exports from `supabase status -o env` (fails if Supabase is not running). Does **not** print the service role key.

```bash
npm run qa:env
```

Copy/paste the printed `unset` / `export` lines into your current terminal, then run `npm run qa:seed` and `npm run qa:web`.

One-liner (eval-safe):

```bash
eval "$(npm run -s qa:env -- --exports-only)"
```

Or print eval instructions only:

```bash
npm run qa:env -- --eval
```

### Manual exports (fallback)

In the same terminal session where you run QA:

```bash
unset EXPO_PUBLIC_SUPABASE_URL
unset EXPO_PUBLIC_SUPABASE_ANON_KEY

export EXPO_PUBLIC_SUPABASE_URL="$(supabase status -o env | sed -n 's/^API_URL=//p' | tr -d '"')"
export EXPO_PUBLIC_SUPABASE_ANON_KEY="$(supabase status -o env | sed -n 's/^ANON_KEY=//p' | tr -d '"')"

npm run qa:seed
npm run qa:web
```

Notes:

- Shell `export` overrides `.env` for that session — use this when `.env` still points at production/hosted Supabase.
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` is required when the URL is local.
- Remote QA against hosted Supabase is **opt-in only**: `QA_WEB_ALLOW_REMOTE=true` (not recommended for default local fixture flow).

## Prerequisites

1. **Local Supabase** — `supabase start`
2. **Local Expo env in your shell** — see [Local Supabase env](#local-supabase-env-required) above
3. **Playwright Chromium (one-time)** — `npx playwright install chromium`

## Seed fixtures (`npm run qa:seed`)

Creates deterministic local QA data (local Supabase only):

- Organizer + profile
- Published paid event: **QA Paid Event** (`event_id` `a1000001-0000-4000-8000-000000000002`)
- Active ticket type: **General Admission** @ $25.00
- One `checkout_open` order (cancel/unpaid UI)
- One paid order with **two** paid passes via `fulfill_paid_order` (no Stripe)

Output: `qa/fixtures.json`

```json
{
  "event_id": "...",
  "ticket_type_id": "...",
  "pending_order_token": "...",
  "paid_order_token": "...",
  "pass_tokens": ["...", "..."],
  "created_at": "..."
}
```

See `qa/fixtures.example.json` for shape. Safe to rerun — replaces prior QA orders for the same event.

**Safety:** refuses non-local Supabase unless `QA_SEED_ALLOW_REMOTE=true` (not recommended).

## Run web QA (`npm run qa:web`)

Fixture resolution order:

1. **Explicit env vars** (if all required vars are set) — useful for debugging
2. **`qa/fixtures.json`** — default after `npm run qa:seed`

| Env var | Maps to |
|---------|---------|
| `QA_EVENT_ID` | Purchase page event |
| `QA_TICKET_TYPE_ID` | Purchase page ticket type |
| `QA_PAID_ORDER_TOKEN` | Success page paid order |
| `QA_PASS_TOKEN` | Pass page (`pass_tokens[0]` from fixtures) |
| `QA_PENDING_ORDER_TOKEN` | Cancel page (optional; seeded automatically) |

Subset:

```bash
npm run qa:purchase
```

Playwright starts or reuses Expo web at `http://localhost:8081`.

**Preflight checks before Playwright:**

- Local fixtures require local `EXPO_PUBLIC_SUPABASE_URL` (unless `QA_WEB_ALLOW_REMOTE=true`)
- Missing `EXPO_PUBLIC_SUPABASE_ANON_KEY` fails fast when URL is local
- Missing Playwright Chromium prints install instructions and exits

## Screenshots

```
qa/artifacts/screenshots/latest/
  01-purchase-buy.png
  02-purchase-success-paid.png
  03-pass-ticket.png
  04-purchase-cancel.png
  05-pass-invalid.png
```

Cleared before each `qa:web` run. Gitignored.

## Manual / alternate fixture sources

- `npm run smoke:payments:local` — Stripe integration smoke (manual card payment)
- Export `QA_*` env vars from smoke output to override fixtures

## What remains manual

- Stripe hosted Checkout card entry
- Apple Wallet on real iOS Safari
- Real Resend email delivery and domain verification
- SMS / Twilio
- Scanner camera behavior on physical devices

## Related commands

- `npm run check:all` — static validation (does not include `qa:seed` or `qa:web`)
- `npm run smoke:payments:local` — Stripe API + DB integration smoke
