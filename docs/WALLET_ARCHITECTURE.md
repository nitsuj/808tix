# Apple Wallet / Google Wallet — Architecture Spike

**Status:** Research only (no implementation).  
**Date:** 2026-05-31  
**Scope:** Guest flow — SMS/Share → mobile web pass → Add to Wallet → door scan (existing `validate_pass`).

---

## Executive summary

**Yes — 808Tix can realistically support this flow** without a consumer app or 808Tix accounts, **if** wallet pass generation is added as a **backend-only** feature behind the existing `secure_token` and mobile web pass remains the primary experience.

The scanner, `validate_pass`, and QR payload (`secure_token` hex) **do not need to change**. Wallet passes should encode the **same** `secure_token` in their barcode/QR field.

**Recommended path:** Ship **Apple Wallet (.pkpass)** first (best fit for iOS guests + existing QR model), then **Google Wallet** (JWT save link; Android guests need a Google account to save, not an 808Tix account).

---

## Product flow (target)

```
Organizer issues pass (existing)
        ↓
SMS and/or Share link (existing)
        ↓
Guest opens /pass/{secure_token} (existing mobile web — source of truth)
        ↓
[NEW] "Add to Apple Wallet" / "Add to Google Wallet" on pass screen
        ↓
Guest presents Wallet pass at door
        ↓
Scanner reads barcode → secure_token → validate_pass (unchanged)
```

---

## 1. Apple Wallet

### Account & identifiers

| Requirement | Detail |
|-------------|--------|
| **Developer account** | **Apple Developer Program** membership (paid, org or individual). Wallet passes are not available on a free Apple ID alone. |
| **Pass Type ID** | Register in Certificates, Identifiers & Profiles → **Pass Type IDs** (reverse-DNS, e.g. `pass.com.808tix.pass`). One ID can cover all event tickets for the app. |
| **Team ID** | 10-character Apple Developer Team ID (used in `pass.json`). |
| **Certificates** | **Pass Type ID certificate** (signing) + **Apple WWDR** intermediate certificate (G4). Export signing cert as `.p12` or PEM + private key for server signing. |
| **App ID** | Not required for web-only issuance; no iOS host app required to *generate* passes. |

### Generation model

- A pass is a signed ZIP bundle (`.pkpass`): `pass.json`, images, `manifest.json` (SHA-1 hashes), `signature` (PKCS#7).
- MIME type for download: `application/vnd.apple.pkpass`.
- On iPhone Safari, serving `.pkpass` triggers **Add to Wallet**.

### Supabase Edge Functions?

**Feasible, with caveats.**

| Factor | Assessment |
|--------|------------|
| Crypto/signing | Edge Functions (Deno) can sign manifests if you use a maintained library (e.g. port of `passkit-generator` logic) or invoke OpenSSL via subprocess (limited on Edge). |
| Certificates | Store in **Supabase secrets** (PEM/P12 + passphrase). Never in repo. |
| Bundle size / cold start | Pass templates + images increase deploy size; acceptable for MVP if templates are minimal. |
| Alternative | Small **Node** serverless route (e.g. Vercel function) with `passkit-generator` is often easier to debug than Deno-first signing. |

**Recommendation:** Start wallet signing in a **dedicated Edge Function** (`wallet-apple`) *or* a single Vercel serverless route colocated with static export—pick one runtime for PoC and stay consistent. Edge is fine if signing library works in Deno; otherwise Vercel Node is lower risk.

### Reuse existing QR/token?

**Yes.** Apple Wallet `barcode` format `PKBarcodeFormatQR` (or PDF417) should set `message` to the **raw `secure_token`** (same as `PassQrCode` today). Scanner already accepts hex token and `/pass/{token}` URLs.

### Event artwork?

**Partially.**

- **Strip / background / thumbnail:** Can use event `image_url` if downloaded, resized, and embedded per Apple’s required dimensions.
- **Required assets:** Apple expects fixed icon/logo assets (e.g. `icon.png`, `logo.png`, `logo@2x.png`) — not only a hero photo. Plan a small **808Tix-branded template** + optional event art as `background` or `thumbnail`.
- Remote-only images in `pass.json` are supported for some fields but offline/Wallet caching favors bundled assets at generation time.

### Pass updates?

**Supported** via Apple Wallet **web service** + **APNs push**:

- `pass.json` includes `webServiceURL` + `authenticationToken`.
- After check-in, server can issue an update (e.g. void barcode, “Checked in” on pass).
- Requires hosting update endpoints and APNs cert for pass updates.

**MVP:** Static pass at issue time (no push updates). **V2:** Update pass when `status` → `checked_in` so staff/guest see state (optional; scanner already enforces entry).

---

## 2. Google Wallet

### Account & API

| Requirement | Detail |
|-------------|--------|
| **Issuer account** | [Google Wallet API Issuer](https://pay.google.com/business/console/) (business onboarding; can take review time). |
| **Google Cloud** | GCP project linked to issuer; **service account** with Wallet API access. |
| **Pass type** | **Event ticket** (`eventTicketObjects` / `eventTicketClasses`) — best match for 808Tix. |
| **Credentials** | Service account JSON key (signing JWTs). Store in Supabase secrets. |

### Guest accounts?

- Guests **do not need an 808Tix account**.
- Saving to Google Wallet **does require the guest to be signed into a Google account** on the device when tapping **Add to Google Wallet** (Google identity for Wallet storage).
- Distribution: `https://pay.google.com/gp/v/save/<signed_JWT>` in web, SMS, or email — same surfaces as today.

### Supabase Edge Functions?

**Yes — good fit.** JWT signing with `jose` or similar in Deno is straightforward. Edge Function:

1. Validates `secure_token` (service role + `get_pass_by_token` or internal query).
2. Builds `eventTicketClass` + `eventTicketObject` (or embeds class/object in JWT for JIT creation).
3. Signs JWT with service account private key.
4. Returns save URL or redirects.

### Reuse existing QR/token?

**Yes.** `barcode` on the object uses `type: QR_CODE` with `value` = `secure_token`. Scanner unchanged.

### Event artwork?

**Yes, with constraints.**

- `heroImage`, `wideLogo`, `logo` URIs on class/object (HTTPS, publicly reachable).
- Google caches images; use stable URLs (Supabase storage public URLs or CDN).
- Same gap as Apple: may want default 808Tix branding + event art.

### Pass updates?

**Supported** via Wallet API **PATCH** on `eventTicketObject` (e.g. after check-in: update barcode state, text modules, validity).

**MVP:** One-time save link at view time. **V2:** PATCH object when pass checked in (optional).

---

## 3. Existing 808Tix data

### Already available (`get_pass_by_token` / `PublicPassView`)

| Field | Wallet use |
|-------|------------|
| `event_name` | Title / event name |
| `event_date`, `start_time` | Date/time on pass |
| `venue_name` | Location |
| `guest_name` | Attendee |
| `pass_type` | Ticket type / admission level |
| `secure_token` | **Barcode / QR (critical)** |
| `status` | Validity, dimming, updates |
| `image_url` | Hero/background (with resize pipeline) |
| `event_slug` | Deep links / metadata (optional) |
| `description` | Secondary text (optional) |

### Genuine gaps (not blockers for PoC, needed for production)

| Gap | Why it matters | MVP workaround |
|-----|----------------|----------------|
| **`pass.id` not in public RPC** | Apple `serialNumber` / Google `objectId` should be stable & unique | Use `secure_token` as serial/object id (already unique) |
| **Wallet asset pipeline** | Apple needs icon/logo sizes; Google needs HTTPS image URLs | Template assets in repo + resize job at generate time |
| **No wallet issuance audit** | Ops/debug (“which .pkpass was issued?”) | Log generation requests; optional `wallet_issued_at` column later |
| **Check-in → wallet sync** | Pass still shows “valid” in Wallet after scan | Phase 2 API update; scanner truth remains DB |
| **Issuer onboarding lead time** | Google issuer approval; Apple cert setup | Start accounts early in parallel with PoC |

**No schema change required for PoC** if `secure_token` is the wallet object identifier and pass data is read at generation time via existing RPC (Edge Function uses service role for full row if needed).

---

## 4. Recommended architecture

### A. Apple Wallet

```
Guest (Safari) → GET /wallet/apple?token={secure_token}
                      ↓
              Supabase Edge Function (or Vercel Node)
                      ↓
         Load pass row + event (service role / RPC)
                      ↓
         Build pass.json (eventTicket style)
         Bundle images (template + event art)
         Sign manifest → .pkpass bytes
                      ↓
         Response: application/vnd.apple.pkpass
                      ↓
         iOS: Add to Wallet
```

- **Link from:** `src/app/pass/[token].tsx` only (disabled until ready; no change to QR component logic).
- **Auth:** Public endpoint gated by knowledge of `secure_token` (same security model as public pass page).

### B. Google Wallet

```
Guest (browser) → GET /wallet/google?token={secure_token}
                      ↓
              Supabase Edge Function
                      ↓
         Load pass + event data
                      ↓
         Sign JWT (eventTicket class + object)
                      ↓
         Redirect to https://pay.google.com/gp/v/save/{jwt}
```

- Or return JWT to client for official **Add to Google Wallet** button widget.

### C. Required backend changes (future — not in this spike)

| Change | Purpose |
|--------|---------|
| New Edge Functions `wallet-apple`, `wallet-google` | Generate pass artifacts |
| Supabase secrets | Apple cert PEM, passphrase, team ID, pass type ID; Google SA JSON |
| Optional RPC `get_pass_for_wallet(token)` | Include `pass.id`, `event_id` if needed without exposing extra PII |
| Optional `wallet_assets` bucket | Preprocessed icons per event |
| Phase 2: update hooks after `validate_pass` | PATCH Google object; Apple web service + push |

**Explicitly unchanged:** `issuePass`, `validate_pass`, SMS body format (only add wallet URL optionally later), scanner components.

### D. External accounts & certificates

| Platform | Item |
|----------|------|
| **Apple** | Developer Program, Pass Type ID, Pass Type ID cert, WWDR G4 cert |
| **Google** | Wallet Issuer account, GCP project, Wallet API enabled, service account key |

### E. Security considerations

- **Token = capability:** Anyone with `secure_token` can fetch web pass and (once built) wallet pass — same as today’s public pass URL. Do not put PII in URLs beyond opaque token.
- **Certificates in secrets only;** rotate before expiry; separate dev/staging pass type IDs.
- **Rate-limit** wallet generation endpoints (per token / per IP) to prevent abuse.
- **Do not embed service role** in client; generation stays server-side.
- **Voided/checked-in:** Wallet pass may still *display* valid until updated — scanner must remain source of truth at door (already true).

### F. Operational considerations

- Apple cert **expires annually** — calendar reminder to renew.
- Google issuer **review** may delay launch.
- Support: “Add to Wallet” only on **iPhone** (Apple) and **Android with Google account** (Google).
- Test matrix: Safari iOS, Chrome Android, desktop (wallet buttons hidden or “open on phone” copy).
- Keep **mobile web pass** as fallback when Wallet unsupported.

---

## 5. Complexity assessment

| Area | Difficulty (1–5) | Notes |
|------|------------------|-------|
| **Apple Wallet** | **4** | Signing, assets, cert ops; libraries help |
| **Google Wallet** | **3** | JWT + REST is well documented; issuer onboarding friction |

| Phase | Apple | Google |
|-------|-------|--------|
| **Proof of concept** | 3–5 days | 2–4 days |
| **Production-ready** | 2–3 weeks | 1–2 weeks |

Production includes: asset pipeline, error handling, monitoring, cert/secret rotation runbooks, both platforms, QA on real devices, optional check-in updates (add 1–2 weeks if in scope).

*Estimates assume one experienced developer familiar with Node/Deno and pass docs.*

---

## 6. Recommendation

### Can we do SMS → Open Pass → Add to Wallet → Scan?

**Yes**, with these conditions:

1. **Wallet is additive** — web pass at `/pass/{token}` remains canonical.
2. **Barcode = `secure_token`** — no scanner changes.
3. **Backend-only issuance** — new Edge Functions + secrets; no consumer app.
4. **Accept platform limits** — Apple = iPhone; Google = Google account for save; no 808Tix account either way.

### Suggested implementation order

1. **Apple Developer + Pass Type ID + certificates** (parallel, non-code).
2. **Google Wallet Issuer + GCP service account** (parallel).
3. **PoC: Apple** — Edge Function returns `.pkpass` for one test event; manual Add to Wallet; scan at door.
4. **PoC: Google** — Edge Function returns save link; scan at door.
5. **UI** — Add wallet buttons on guest pass only (feature-flagged); primary CTA remains view/QR on web.
6. **Production hardening** — rate limits, logging, asset templates, error states, docs for organizers.
7. **Optional V2** — update wallet pass on check-in; optional SMS line “Add to Wallet: …”.

### Blockers (decision gates)

| Blocker | Owner |
|---------|--------|
| Apple Developer Program enrollment | Business |
| Pass Type ID certificate created & stored securely | Business + eng |
| Google Wallet Issuer approval | Business |
| Choice of runtime (Deno Edge vs Vercel Node for Apple signing) | Eng |
| Legal/branding review for Wallet pass appearance | Product |

---

## References

- [Apple — Building a Pass](https://developer.apple.com/documentation/walletpasses/building-a-pass)
- [Apple — Pass Type ID certificates](https://developer.apple.com/help/account/capabilities/create-wallet-identifiers-and-certificates/)
- [Google Wallet — Event tickets (web/SMS)](https://developers.google.com/wallet/tickets/events/web)
- [Google Wallet — JWT](https://developers.google.com/wallet/tickets/events/use-cases/jwt)
- 808Tix: `src/lib/scan-payload.ts`, `supabase/migrations/20250610000005_get_pass_by_token.sql`, `src/lib/validate-pass-scan.ts`
