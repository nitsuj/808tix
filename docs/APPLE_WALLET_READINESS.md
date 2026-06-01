# Apple Wallet — Implementation Readiness Report

**Date:** 2026-05-31  
**Type:** Readiness check only (no wallet code, no new dependencies).  
**Inputs:** [`WALLET_ARCHITECTURE.md`](./WALLET_ARCHITECTURE.md), [`APPLE_WALLET_SETUP.md`](./APPLE_WALLET_SETUP.md), current 808Tix codebase.

---

## Go / No-Go recommendation

### **Conditional GO — ready to implement after administrative prerequisites are confirmed**

| Dimension | Status |
|-----------|--------|
| **Technical / architecture** | **GO** — scanner, data model, public token flow, and Edge Function pattern are sufficient for MVP PoC |
| **Administrative / Apple credentials** | **NOT VERIFIABLE from repo** — must complete [`APPLE_WALLET_SETUP.md`](./APPLE_WALLET_SETUP.md) sections A–D (and ideally E) before writing signing code |
| **Product / assets** | **GO with small build task** — static PassKit image templates still need to be created (not a blocker to start backend spike) |

**Do not start production Wallet UI** until:

1. Pass Type ID certificate + `.p12` + WWDR PEM exist and are loaded into **Supabase secrets** (staging first).
2. A throwaway `.pkpass` opens on a physical iPhone (setup doc section E, optional but strongly recommended).

**Safe to start now:** isolated `wallet-apple` Edge Function spike on **staging**, using local secrets, **without** guest-pass UI button.

---

## 1. Apple prerequisites (what 808Tix needs)

| Requirement | Spec (from setup doc) | Repo / system evidence |
|-------------|----------------------|-------------------------|
| **Apple Developer Program** | Paid membership | User confirmed account exists; not verifiable in git |
| **Pass Type ID** | `pass.com.808tix.pass` | Documented; **not** stored in repo (correct) |
| **Team ID** | 10-character ID in `pass.json` | Template blank in setup doc — **human must confirm** |
| **Pass Type ID certificate** | Valid cert in portal, private key in Keychain | **Human must confirm** |
| **`.p12` export** | `808Tix-PassTypeID-signing.p12` + export password | **Human must confirm**; never in repo |
| **WWDR G4** | `AppleWWDRCAG4.pem` from Apple PKI | **Human must confirm** |
| **Organization name** | e.g. `808Tix` for `organizationName` | Product decision only |

**Certificate requirements (signing):**

- PKCS#7 detached signature over `manifest.json` using Pass Type ID cert + private key.
- WWDR intermediate included in trust chain when Apple validates the pass.
- `pass.json` must match cert: `passTypeIdentifier` = Pass Type ID, `teamIdentifier` = Team ID.

**Not required for MVP PoC:**

- iOS host app or App ID for Wallet.
- APNs / `webServiceURL` (pass updates after check-in).
- Database schema changes.

---

## 2. Runtime assessment

### Supabase Edge Functions — viable?

**Yes.** 808Tix already ships Edge Functions (`supabase/functions/send-pass-sms/`) using Deno, `esm.sh` imports, service-role Supabase client, and secrets via `Deno.env.get`. A `wallet-apple` function fits the same model.

| Concern | Assessment |
|---------|------------|
| **Secrets** | Supabase `secrets set` supports P12 base64, PEM, passwords (documented in setup doc) |
| **Public invoke** | Same as SMS function — CORS + token gate; use `get_pass_by_token` or service-role lookup |
| **Binary response** | Return `application/vnd.apple.pkpass` body from Edge Function (supported) |
| **Cold start / size** | Pass template images + signing lib increase bundle; acceptable for PoC |

### Deno library options (no install in repo yet — evaluate at implementation)

| Option | Pros | Cons |
|--------|------|------|
| **`npm:passkit-generator`** via Deno npm specifier | Battle-tested; matches most Node tutorials | Must verify compatibility on Supabase Edge runtime; bundle size |
| **`node-forge` + manual manifest/sign** | Pure JS crypto; works in Deno | More code; easy to get PassKit details wrong |
| **`@walletpass/pass-js`** (if used via npm:) | Pass-focused | Less common; verify maintenance |
| **OpenSSL subprocess** | Known-good signatures | Often **blocked** or fragile on Edge |

**Recommendation for PoC decision gate:**

1. **Spike Day 1:** `wallet-apple` with `npm:passkit-generator@3` on Supabase Edge (staging).
2. If deploy/sign fails: **fallback** to Vercel Node serverless route with same secrets (no Expo secrets exposure).

### Node alternative (Vercel)

Use only if Edge Deno signing fails. Static Expo app on Vercel must **not** receive Apple cert env vars. A separate `api/wallet-apple.ts` (or similar) could hold `passkit-generator` — adds deployment surface but lowest friction for PKCS#7.

**808Tix does not need to choose until after a 0.5–1 day Edge spike.**

---

## 3. Security — secrets inventory

### Required secrets (Apple MVP)

| Secret | Purpose | Store here | Never in Expo web |
|--------|---------|------------|-------------------|
| `APPLE_PASS_TYPE_IDENTIFIER` | `passTypeIdentifier` | Supabase Edge secrets | Yes — never `EXPO_PUBLIC_*` |
| `APPLE_TEAM_ID` | `teamIdentifier` | Supabase Edge secrets | Yes |
| `APPLE_ORGANIZATION_NAME` | `organizationName` | Supabase Edge secrets | Yes |
| `APPLE_PASS_CERT_P12_BASE64` | Signing identity | Supabase Edge secrets | Yes |
| `APPLE_PASS_CERT_PASSWORD` | Decrypt P12 | Supabase Edge secrets | Yes |
| `APPLE_WWDR_CERT_PEM` | Chain | Supabase Edge secrets | Yes |

**Vercel:** only if signer runs on Vercel (duplicate secrets). **Not needed** for static `dist/` hosting alone.

**Expo / guest pass client may only use:**

- Public URL to Edge Function, e.g. `https://<project>.supabase.co/functions/v1/wallet-apple?token=<secure_token>`  
  OR a thin proxy route added later — still no cert material on client.

**Service role key:** Edge Function only (already pattern for SMS); never ship to client.

### Token security model (unchanged)

`secure_token` is already a capability for `/pass/{token}`. Wallet download uses the same model — acceptable for MVP; add rate limiting in production.

---

## 4. Data & scanner compatibility (verified in codebase)

| Need | Status |
|------|--------|
| Event name, date, time, venue | `get_pass_by_token` returns these |
| Guest name, pass type, status | Same |
| `secure_token` for barcode | Same; QR encodes raw token (`src/components/pass/pass-qr-code.tsx`) |
| Scanner parses token | `parseScannedSecureToken` accepts hex + `/pass/{token}` URL (`src/lib/scan-payload.ts`) |
| Validation | `validate_pass` RPC unchanged |

**PoC gaps (non-blocking):**

- PassKit **icon/logo** image set not in repo yet — create minimal 808Tix template assets in function bundle.
- `pass.id` not in public RPC — use `secure_token` as `serialNumber` (unique).

---

## 5. MVP Wallet PoC — success criteria

```
Guest Pass (/pass/{token})
        ↓
Tap "Add to Apple Wallet" (feature-flagged link to wallet-apple)
        ↓
Browser downloads signed .pkpass (Content-Type: application/vnd.apple.pkpass)
        ↓
iOS opens Add to Wallet
        ↓
Pass appears in Apple Wallet with event/guest fields
        ↓
Barcode/QR message === existing secure_token (raw hex)
        ↓
808Tix scanner at door → validate_pass → same outcomes as web pass
```

**Explicit PoC exclusions:**

- Pass updates after check-in.
- Google Wallet.
- SMS body including wallet link.
- Desktop/Android wallet buttons (hide on non-iOS).

---

## 6. Implementation plan (ordered steps)

| Step | Work | Complexity | Est. |
|------|------|------------|------|
| **1** | Human: complete APPLE_WALLET_SETUP checklist A–D (+ optional E) | Admin | 1–2 hrs |
| **2** | Load secrets into **staging** Supabase project | Admin/Ops | 30 min |
| **3** | Create `supabase/functions/wallet-apple/` — health check only, no signing | Low | 2 hrs |
| **4** | Add minimal PassKit template (`pass.json` + icon/logo PNGs) in function | Medium | 3–4 hrs |
| **5** | Implement pass load via `get_pass_by_token` (service role) + 404 if missing/voided | Low | 2 hrs |
| **6** | Integrate signing (`passkit-generator` or fallback); return `.pkpass` bytes | High | 1–2 days |
| **7** | Manual test: iPhone Safari download → Add to Wallet → scan at door | QA | 2 hrs |
| **8** | Add guest-pass button linking to function URL (feature flag env) | Low | 2 hrs |
| **9** | Rate limit + logging + staging/prod secret split | Medium | 1 day |
| **10** | Production hardening + runbook (cert expiry) | Medium | 2–3 days |

**PoC complete = steps 1–7.**  
**Guest-facing launch = through step 9.**

---

## 7. Blockers

### Administrative blockers (must clear before real signing)

| Blocker | Owner | How to clear |
|---------|-------|--------------|
| Pass Type ID registered | You | Portal → Identifiers |
| Pass Type ID certificate valid | You | Portal → Certificates |
| `.p12` + password secured | You | Keychain export |
| WWDR G4 PEM obtained | You | Apple PKI download |
| Secrets in Supabase staging | Eng/Ops | `supabase secrets set` |
| Team ID recorded | You | Membership details |

*Setup doc checklist fields are still blank in the template — indicates this may not be done yet.*

### Technical blockers (manageable)

| Blocker | Severity | Mitigation |
|---------|----------|------------|
| Deno `passkit-generator` on Edge unproven | Medium | 1-day spike; Vercel Node fallback |
| PassKit image assets missing | Low | Ship default template in function |
| No `wallet-apple` route yet | Expected | New function only |
| CORS / function URL exposure | Low | Same pattern as SMS function |

### Unknowns (resolve during spike)

| Unknown | Resolution |
|---------|------------|
| Max Edge Function bundle size with template + lib | Deploy staging function |
| Whether uploaded `image_url` can be fetched and embedded in PoC | Try one event with art in step 6 |
| Apple cert expiry date | Record from portal when creating cert |
| Legal copy on Wallet pass (organization name, terms) | Product sign-off |

---

## 8. What this readiness check did **not** verify

- Apple portal state (certificates installed, expiry).
- Physical iPhone Add to Wallet test.
- Supabase secrets actually set in any environment.
- Deno signing library on production Edge runtime.

---

## 9. Preflight (application health)

`npm run check:preflight` — **passed** (exit 0) at time of this report.  
No application code was modified for this readiness check.

---

## Related documents

- [`WALLET_ARCHITECTURE.md`](./WALLET_ARCHITECTURE.md) — full platform architecture
- [`APPLE_WALLET_SETUP.md`](./APPLE_WALLET_SETUP.md) — portal + certificate checklist
