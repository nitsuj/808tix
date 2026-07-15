# 808Tickets Event-Day Runbook

Field manual for operating **one real event** with the current 808Tickets MVP. This document is for organizers, door staff, and the technical operator—not marketing copy.

**Related docs:** [STRIPE_PAYMENTS.md](./STRIPE_PAYMENTS.md) · [qa/README.md](../qa/README.md) · [DOMAIN_CUTOVER.md](./DOMAIN_CUTOVER.md)

---

## 1. Purpose

808Tickets MVP replaces clipboards and guest lists with **mobile tickets**, **QR validation**, and **recorded check-ins**.

This runbook covers:

- Pre-event technical verification (local/staging before go-live)
- Event setup in the organizer app
- Buyer purchase and ticket display
- Comp/manual ticket issuance
- Door scanning and expected validation states
- Recovery when something goes wrong
- Launch rehearsal and go/no-go criteria

Use it the week before and the day of your event. Do not treat optional checks as optional on event day if paid tickets are on sale.

---

## 2. Pre-event technical checklist

Run these from the project root on a machine with local Supabase, Stripe test keys, and Expo web available.

### One-time shell setup (local QA)

```bash
eval "$(npm run -s qa:env -- --exports-only)"
```

**When required:** Before any local command that reads `EXPO_PUBLIC_SUPABASE_*`. npm cannot modify your parent shell; paste or eval in the same terminal session.

### Command reference

| Command | When required | What it proves |
|---------|---------------|----------------|
| `npm run check:env` | **Before every local rehearsal** and before starting payment smoke | Supabase local/hosted env, schema/RPC presence, Stripe/email/wallet env (secrets masked), fixture compatibility |
| `npm run check:all` | **Before merge/deploy** and before event-week rehearsal | Static guards, lint, payment schema, UI contract checks |
| `npm run qa:seed` | Before `qa:web` and `smoke:checkin` | Deterministic local paid event, orders, and tickets |
| `npm run qa:web` | **Before event** (browser QA) | Buyer buy/success/ticket/cancel pages render at mobile width |
| `npm run smoke:payments:preview` | **If selling paid tickets** | Stripe Checkout → webhook → `fulfill_paid_order` → tickets minted → email preview row in `outbound_messages` |
| `npm run qa:seed` | **Again before `smoke:checkin`** | Resets tickets to `active` after payment smoke checked them in |
| `npm run smoke:checkin` | **Before event** | Backend `validate_pass`: valid, duplicate, invalid, wrong-event |

### Recommended local rehearsal sequence

```bash
eval "$(npm run -s qa:env -- --exports-only)"
npm run check:env
npm run check:all
npm run qa:seed
npm run qa:web
npm run smoke:payments:preview    # manual Stripe Checkout card entry required
npm run qa:seed                   # reset tickets after payment smoke
npm run smoke:checkin
npm run rehearsal:local          # phone URLs + scanner login (after qa:seed)
```

**Phone rehearsal:** After `qa:seed`, run `npm run rehearsal:local`.

- Phone: open ticket on `http://LAN_IP:8081/pass/...`
- Laptop: open scanner on `http://localhost:8081/events/{event_id}/scan` (camera works on localhost)
- QA login: `qa@808tix.test` / `qa`
- Phone-as-scanner camera on iPhone/Safari needs deployed HTTPS or native/dev build — LAN HTTP camera failure is expected, not a product bug

See [qa/README.md](../qa/README.md#physical-device-rehearsal-npm-run-rehearsallocal).

**Notes:**

- `smoke:payments:preview` starts Stripe listen, Edge Functions, and Expo web on port 8081. Complete Checkout in the browser when prompted.
- `smoke:checkin` mutates ticket status. Always reseed before rerunning.
- For **hosted/production** env checks: `npm run check:env -- --mode preview` or `--mode production` (env-only; no remote DB mutation).

---

## 3. Event setup checklist

Complete in the **organizer** app before doors open.

### Create and verify event

- [ ] Create event (name, date/time, venue, capacity)
- [ ] Verify **slug** is correct (buy links use it)
- [ ] Upload/review **artwork** (fan-facing event page)
- [ ] Confirm **capacity** matches venue reality
- [ ] Confirm **date/time** and timezone display look correct on phone

### Paid tickets (if applicable)

- [ ] Create ticket type (name, price, capacity)
- [ ] Confirm ticket type is **active**
- [ ] **Publish** event (draft events cannot be scanned)
- [ ] Enable sales if your event uses paid checkout
- [ ] Open buy page on phone; confirm price and ticket name

### Internal test ticket (required)

- [ ] Complete **one internal test purchase** (paid) or issue **one comp ticket**
- [ ] Open ticket on phone—QR visible, guest name correct
- [ ] Open event **scanner** as organizer
- [ ] Scan test ticket → expect **valid** check-in
- [ ] Do **not** use the same ticket for rehearsal duplicate test until you intend to test `already_used`

---

## 4. Buyer flow

What fans should experience:

1. **Open event buy page** (shared link or event slug URL).
2. **Select ticket** and start checkout.
3. **Complete Stripe Checkout** (card entry on Stripe-hosted page).
4. **Land on success page** with inline QR ticket(s) for paid orders.
5. **Open ticket page** (`/pass/{token}`) for full-screen ticket + QR.
6. **Share or save** ticket link (SMS/share if configured; otherwise copy link).

### Apple Wallet

- **Add to Wallet** appears only on supported **iOS Safari** with Wallet env configured server-side.
- Android/desktop: ticket page QR is the primary path.
- Do not promise Wallet to all guests.

### Staff talking points

- “Your ticket is the QR on this page—brightness up at the door.”
- “One QR per ticket; screenshots usually work if the QR is sharp.”

---

## 5. Comp / manual ticket flow

For guests not going through Stripe Checkout:

1. Organizer opens **Issue ticket** for the event.
2. Enter guest name (and phone if sending SMS—see limitations).
3. Issue ticket; copy **ticket link** or share via available channel.
4. Guest opens link on phone; confirm QR loads.
5. **Scan test** comp ticket before event if possible.

**Before doors:** Issue at least one comp ticket and scan it once to verify the comp path matches paid tickets at the door.

---

## 6. Door / scanner flow

### Opening scanner

1. Organizer (or delegated staff on organizer account) opens event.
2. Tap **Scan** / open scanner for **this event only**.
3. Grant **camera permission** when prompted (**HTTPS or localhost required on web**; phone-as-scanner on LAN `http://` will not provide camera on iOS Safari — use laptop localhost for local camera rehearsal)

### Expected validation states

| Scan result | Meaning | Staff action |
|-------------|---------|--------------|
| **Valid** | First check-in for this ticket at this event | Admit guest; show success state briefly |
| **Already used** | Ticket was checked in earlier | **Do not admit** without organizer confirmation |
| **Invalid** | Token not found or not valid | Ask guest to open original ticket link; escalate |
| **Wrong event** | Ticket belongs to another event | Direct guest to correct event line; escalate |
| **Voided** | Ticket was voided | Do not admit; escalate to organizer |
| **Event not live** | Event not published | Stop scanning; escalate to organizer |

### Staff rules

- **Do not override duplicate (`already_used`)** unless the organizer explicitly confirms re-entry (e.g. left and returned, duplicate scan mistake).
- Scan the **QR on the ticket page**, not screenshots of confirmation email unless QR is clear.
- One scan per guest per entry unless organizer policy says otherwise.
- If validation is slow, ask guest to wait—do not wave through while spinner is active.

---

## 7. Recovery playbook

### Guest has no phone

**Check:** Did they complete purchase? Can they log into email on another device?

**Do:** Look up order in organizer tools if available; re-send ticket link; issue comp ticket as last resort with organizer approval.

**Do not:** Admit without a scannable QR or organizer-issued replacement ticket.

**Escalate:** Organizer on-site.

---

### QR will not scan

**Check:** Screen brightness, cracked screen, cropped screenshot, wrong QR (order confirmation without ticket QR).

**Do:** Ask guest to open full **ticket page** link; try manual link from email/SMS; try another device.

**Do not:** Admit based on payment receipt alone.

**Escalate:** Organizer—may issue replacement ticket or comp.

---

### Buyer says they paid but has no ticket

**Check:**

1. Stripe Dashboard → payment succeeded?
2. Order status in database/organizer view (paid vs pending)?
3. Success page URL with `order_token`?
4. Webhook delivery (Stripe → `stripe-webhook`) if delay suspected?

**Do:** Send ticket link if order is paid and tickets exist; if stuck in `checkout_open`/`pending`, complete support flow per [STRIPE_PAYMENTS.md](./STRIPE_PAYMENTS.md).

**Do not:** Manually mark paid in DB; do not issue duplicate paid tickets without checking existing tickets.

**Escalate:** Technical operator + organizer.

---

### Scanner camera fails

**Check:** Browser permissions, HTTPS, another browser (Safari on iOS), device restart.

**Do:** Switch to backup phone logged in as organizer; use mobile data if Wi-Fi blocks camera.

**Do not:** Switch to unauthenticated tools or bypass `validate_pass`.

**Escalate:** Technical operator.

---

### Internet / Wi-Fi issue

**Check:** Can organizer app load event stats? Can guest load ticket page?

**Do:** Mobile hotspot for scanner device; pre-load scanner page before peak entry.

**Do not:** Assume offline scanning works—MVP requires network for validation.

**Escalate:** Venue IT + technical operator.

---

### Duplicate / already-used warning

**Check:** Same guest re-scanning? Two guests sharing one ticket? Earlier accidental check-in?

**Do:** Organizer confirms identity; if legitimate re-entry policy exists, document decision (MVP may not have formal override—default is **deny**).

**Do not:** Staff unilateral override.

**Escalate:** Organizer.

---

### Wrong event warning

**Check:** Guest at correct door? Pass for different night/event?

**Do:** Direct to correct entrance; if ticket is valid for tonight but wrong event slug, escalate.

**Do not:** Force scan on wrong event.

**Escalate:** Organizer.

---

### Apple Wallet unavailable

**Check:** iOS Safari? Wallet secrets configured? Guest on Android?

**Do:** Use ticket page QR; add to home screen as fallback.

**Do not:** Promise Wallet fix at the door.

**Escalate:** N/A for event night unless pre-event config issue.

---

### Email not received

**Check:**

- `EMAIL_DELIVERY_MODE` (preview vs send)
- Resend domain verification (send mode)
- Spam folder; `EMAIL_OVERRIDE_TO` in test env

**Do:** Copy ticket link from success page or organizer issue flow; verify `outbound_messages` row for order.

**Do not:** Assume email is the only delivery channel—ticket URL is authoritative.

**Escalate:** Technical operator for send-mode/config.

---

### Stripe paid but webhook delay suspected

**Check:** Stripe Dashboard event log; `stripe listen` / webhook endpoint logs; order still `checkout_open`?

**Do:** Wait 30–60s and refresh success page; verify webhook secret matches environment.

**Do not:** Run duplicate Checkout for same cart without checking order state.

**Escalate:** Technical operator ([STRIPE_PAYMENTS.md](./STRIPE_PAYMENTS.md) smoke path).

---

## 8. Known limitations (MVP)

Be honest with staff and guests:

- **SMS:** Not automated unless Twilio/`send-pass-sms` is separately configured and tested.
- **Email:** Real delivery requires `EMAIL_DELIVERY_MODE=send`, verified `EMAIL_FROM`, and Resend API key/domain. Local preview does not send real mail.
- **Apple Wallet:** Device/browser dependent; requires server-side Apple cert secrets. Not guaranteed for every guest.
- **Scanner:** Requires camera permission and supported mobile browser; web scanner is not identical to native camera apps.
- **Payments:** Refunds, resale, transfers, and advanced dispute workflows are not a full production feature set unless explicitly built and tested.
- **Manual overrides:** No rich “manager override” UI—duplicate admission is an organizer policy decision, not a built-in bypass.
- **Offline:** Check-in requires network; no offline queue in MVP.
- **Multi-org / multi-venue:** Single-organizer event scope per deployment assumption.

---

## 9. Launch rehearsal checklist

Run **once** in the target environment (staging or production) before selling real tickets.

| Step | Action | Pass? |
|------|--------|-------|
| 1 | Create **test event** (published, correct slug/artwork) | ☐ |
| 2 | Complete **one paid test Checkout** (real card or test card per env) | ☐ |
| 3 | Confirm **success page** shows inline QR ticket(s) | ☐ |
| 4 | Confirm **email** preview row (local) or real send (staging/prod) | ☐ |
| 5 | Open **ticket page** on physical phone (`npm run rehearsal:local` LAN URL) | ☐ |
| 5b | Scan phone QR from **laptop localhost** scanner (`qa@808tix.test` / `qa`) | ☐ |
| 5c | **Phone-as-scanner** camera on HTTPS deploy or native build (LAN HTTP iOS Safari not supported) | ☐ |
| 6 | **Add to Wallet** if available on test iPhone | ☐ |
| 7 | **Scan / check in** test paid ticket → valid | ☐ |
| 8 | **Rescan** same ticket → already used | ☐ |
| 9 | **Issue comp ticket** | ☐ |
| 10 | **Scan comp ticket** → valid | ☐ |
| 11 | Review **ticket/check-in counts** in organizer event view | ☐ |

Record test event ID, order token (masked), and ticket tokens in your operator notes—do not share secure tokens publicly.

---

## 10. Go / no-go checklist

**Go** only if all required items pass.

| Check | Required for paid tickets? | Pass? |
|-------|---------------------------|-------|
| `npm run check:env` PASS (correct mode) | Yes | ☐ |
| `npm run check:all` PASS | Yes | ☐ |
| `npm run qa:web` PASS (or staging UI review) | Recommended | ☐ |
| `npm run smoke:payments:preview` PASS | **Yes** if paid checkout | ☐ |
| `npm run smoke:checkin` PASS | Yes | ☐ |
| **One physical scan test** on venue Wi-Fi | **Yes** | ☐ |
| `npm run rehearsal:local` run (phone LAN ticket + laptop localhost scanner) | Recommended local | ☐ |
| Physical **camera** scan: laptop localhost local path, or HTTPS/native for phone-as-scanner | **Yes** for door ops | ☐ |
| Event page reviewed on phone | Yes | ☐ |
| Operator has printed/shared this recovery playbook | Yes | ☐ |
| Stripe live vs test keys verified for environment | Yes | ☐ |
| Door staff briefed on duplicate/invalid states | Yes | ☐ |

**No-go triggers:** draft event with sales enabled, scanner untested on venue network, paid tickets without successful test Checkout, or `check:env` / `check:all` failures in release path.

---

## 11. Open launch blockers

Track release blockers here. Update during event week.

| Blocker | Severity | Owner | Status | Notes |
|---------|----------|-------|--------|-------|
| | | | | |
| | | | | |
| | | | | |

---

## 12. Links

- [STRIPE_PAYMENTS.md](./STRIPE_PAYMENTS.md) — Stripe Checkout, webhooks, email preview, `smoke:payments:preview`
- [qa/README.md](../qa/README.md) — `qa:env`, `qa:seed`, `qa:web`, `smoke:checkin`
