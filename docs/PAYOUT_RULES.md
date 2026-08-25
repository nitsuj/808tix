# 808Tickets payout & fee rules (launch)

Source of truth for platform fees, organizer net, and manual payouts.

**Related:** [P0_ACCEPTANCE.md](./P0_ACCEPTANCE.md) · [EVENT_DAY_RUNBOOK.md](./EVENT_DAY_RUNBOOK.md) · [STRIPE_PAYMENTS.md](./STRIPE_PAYMENTS.md)

Stripe Connect is **deferred**. Launch settlement is: platform Stripe account → app ledger (`organizer_payouts`) → manual off-app payout → admin marks status.

---

## Launch pricing model

| Line | Who pays | Formula |
|------|----------|---------|
| Ticket subtotal | Buyer | `price_cents × quantity` |
| **808Tickets service fee** | Buyer | `2.5% + $0.99` per paid ticket → `round(subtotal × 250 / 10000) + (99 × quantity)` |
| **Payment processing fee** | Buyer | Gross-up of estimated Stripe (2.9% + $0.30) on `(subtotal + service fee)` |
| Buyer total | Buyer | `subtotal + service fee + processing fee` |
| Organizer net | Platform owes organizer | `= ticket subtotal` (face value) |

Defaults on `events`:

- `platform_fee_bps = 250` (2.5%)
- `platform_fee_fixed_cents = 99` (**per paid ticket**)
- `processing_fee_bps = 290` (2.9%)
- `processing_fee_fixed_cents = 30` ($0.30)

Free/comp tickets (`price_cents = 0` or `passes.source = 'comp'`): **no** 808Tickets service fee and **no** payment processing fee.

Fee overrides (`platform_fee_*`, `processing_fee_*`) are **platform-admin only**. Organizers cannot change them (DB trigger + admin identity).

---

## Transparent labels (required)

Wherever fees are itemized for buyers or operators, use these exact labels:

- `808Tickets service fee`
- `Payment processing fee`

Do not collapse into a vague “Fees” line when both values are available.

Surfaces covered in-repo:

- Buyer purchase summary (`/events/{id}/buy`)
- Stripe Checkout line items
- Order confirmation email payment summary
- Purchase success fee summary
- Admin payout list fields (`platform_fee_cents`, `processing_fee_cents`)

---

## Processing fee handling

At checkout, the buyer is charged an **estimated** processing fee using the gross-up:

```
base = subtotal + service_fee
total = ceil((base + processing_fee_fixed) / (1 - processing_fee_bps/10000))
processing_fee = total - base
```

This is stored on `orders.processing_fee_cents`.

`payments.processor_fee_cents` may later store Stripe’s actual processor fee when available. Actual Stripe fee capture is optional for this slice; estimated buyer-facing processing fee is authoritative for checkout totals.

Do **not** deduct processing fee from organizer net.

---

## Payout timing

Manual / off-app after event completion.

**Target:** event date + **3 business days** (operator discretion for holds).

Statuses on `organizer_payouts`:

| Status | Meaning |
|--------|---------|
| `pending` | Owed, not yet paid |
| `paid` | Manual payout completed; `paid_at` set |
| `withheld` | Held (dispute/refund risk, cancelled event, etc.); `paid_at` cleared |

Amounts are **not** changed by status RPCs. Adjustments require a separate process (future).

---

## Manual payout process

1. After the event (or on the T+3 target), run `admin_list_payouts` (or future `/admin` UI) filtered to `pending`.
2. Pay the organizer outside the app (ACH/wire/Venmo/check — operator choice).
3. Call `admin_set_payout_status(payout_id, 'paid', notes)` with a short note (reference #, date).
4. Use `withheld` when funds must be held for refunds/chargebacks/cancelled events.

RPCs:

- `admin_list_payouts(p_status?, p_event_id?, p_organizer_id?)`
- `admin_set_payout_status(p_payout_id, p_status, p_notes?)`

Platform-admin only (or service role).

---

## Refunds (launch)

Manual / support-only.

1. Refund in Stripe Dashboard (or support tooling).
2. Update order status / notes as needed (automated refund webhooks are **not** built yet).
3. Adjust or withhold related `organizer_payouts` before paying the organizer.
4. If already `paid`, claw back via next payout or invoice outside the app.

---

## Chargebacks / disputes (launch)

Organizer/client responsibility unless 808Tickets decides otherwise for a specific case.

1. Mark related payouts `withheld`.
2. Resolve with the client.
3. Platform may deduct chargeback fees from future payouts (manual).

---

## Comp / manual tickets

`passes.source = 'comp'` are not sold; they do not create payment or payout rows. Excluded from GMV and organizer net.

---

## Taxes

Organizers are responsible for their own tax obligations. 808Tickets does not collect sales tax in-app for launch.

---

## Promote a platform admin (hosted)

Do **not** self-promote from the client. Run in Supabase SQL as an operator:

```sql
-- By email
update public.profiles
set is_platform_admin = true
where lower(email) = lower('justin@example.com');

-- Or by auth user id
update public.profiles
set is_platform_admin = true
where id = '00000000-0000-4000-8000-000000000000';
```

Verify:

```sql
select id, email, is_platform_admin from public.profiles where is_platform_admin;
```

Normal users cannot set `is_platform_admin` (trigger blocks non–service-role / non-postgres changes).

---

## Explicit deferrals

- Stripe Connect automation
- Automated bank payouts
- In-app refund/chargeback webhooks
- Full platform admin UI (RPCs first; UI later)
