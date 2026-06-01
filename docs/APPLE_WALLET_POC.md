# Apple Wallet PoC

Proof-of-concept only: one guest pass → signed `.pkpass` → Apple Wallet → door scan with existing `validate_pass`.

Not production Wallet support. No updates, APNs, Google Wallet, or schema changes.

---

## Architecture

```
Guest Pass (/pass/{secure_token})
        │
        ▼  "Add to Apple Wallet" (iOS / iPhone Safari only)
        │
GET {SUPABASE_URL}/functions/v1/wallet-apple?token={secure_token}&apikey={anon_key}
        │
        ▼
Supabase Edge Function `wallet-apple`
  • get_pass_by_token (anon RPC)
  • Load APPLE_* secrets
  • Build eventTicket pass.json + embedded icon/logo/strip
  • Sign with Pass Type ID cert + WWDR (passkit-generator)
        │
        ▼
application/vnd.apple.pkpass
        │
        ▼
Apple Wallet (barcode message === secure_token, raw hex)
        │
        ▼
Existing scanner → parseScannedSecureToken → validate_pass (unchanged)
```

| Layer | Responsibility |
|-------|----------------|
| `src/lib/wallet-apple-url.ts` | Build public function URL (Supabase URL + anon key + token) |
| `src/components/pass/add-to-apple-wallet.tsx` | Single button on guest pass |
| `supabase/functions/wallet-apple/` | Sign and return `.pkpass` |
| `supabase/config.toml` | `verify_jwt = false` for direct Safari GET |

---

## Pass style (Wallet Visual v1)

| Item | Value |
|------|--------|
| **Pass type** | `eventTicket` (Apple Wallet event ticket layout) |
| **Not used** | `generic`, `coupon`, `storeCard` |

### Visual fields (front)

| PassKit area | Content |
|--------------|---------|
| **Header** (right) | Compact date/time (`WHEN`) |
| **Primary** (on strip) | Event name |
| **Secondary** | Venue |
| **Auxiliary** | Guest name, pass type |
| **Strip image** | Purple → pink gradient banner behind primary |
| **Logo** | 808Tix gradient wordmark image + `logoText` |
| **Icon** | App icon slot (808-style mark) |

### Back of pass

Event, venue, full date/time, guest, pass type, optional description snippet, 808Tix entry copy.

### Colors

| Key | Value | Notes |
|-----|--------|--------|
| `backgroundColor` | `rgb(8, 6, 18)` | Dark event-ticket base |
| `foregroundColor` | `rgb(255, 255, 255)` | Primary text |
| `labelColor` | `rgb(226, 204, 255)` | Field labels (fan badge tone) |

### QR / barcode (unchanged)

| Property | Value |
|----------|--------|
| Format | `PKBarcodeFormatQR` |
| `message` | Raw `secure_token` (64-char hex) — **no URL, no prefix** |
| Scanner | `parseScannedSecureToken` → `validate_pass` (unchanged) |

Apple Wallet controls QR size on screen; `eventTicket` layout uses the full-width barcode region. Prominence comes from field layout + strip, not a custom QR dimension.

### Assets (embedded)

Generated into `wallet-assets.ts` via `python3 scripts/generate-wallet-assets.py`:

- `icon.png` / `@2x` / `@3x`
- `logo.png` / `@2x` / `@3x`
- `strip.png` / `@2x` / `@3x`

**Deferred:** per-event `image_url` artwork (fetch/resize on Edge adds failure modes for v1).

### Remaining visual polish (later)

- Real 808Tix vector logo and strip art
- Per-event hero/strip from `image_url` when stable
- Localized field labels
- Status-aware Wallet copy (checked in / voided)

---

## Secrets (Supabase only)

| Secret | Purpose |
|--------|---------|
| `APPLE_PASS_TYPE_IDENTIFIER` | `pass.com.808tix.pass` |
| `APPLE_TEAM_ID` | Apple Team ID |
| `APPLE_ORGANIZATION_NAME` | e.g. `808Tix` |
| `APPLE_PASS_CERT_P12_BASE64` | Signing `.p12` (base64, no newlines) |
| `APPLE_PASS_CERT_PASSWORD` | P12 export password |
| `APPLE_WWDR_CERT_PEM` | Apple WWDR G4 PEM |

Auto-injected by Supabase: `SUPABASE_URL`, `SUPABASE_ANON_KEY`.

**Never** in Expo `.env` as Apple material. The client only uses existing `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` to call the function.

---

## Deploy

From repo root (linked project):

```bash
supabase functions deploy wallet-apple
```

Confirm secrets:

```bash
supabase secrets list
```

Local serve (optional):

```bash
# Copy supabase/functions/.env.example → supabase/functions/.env with real APPLE_* values
supabase functions serve wallet-apple --env-file supabase/functions/.env --no-verify-jwt
```

---

## Test steps

### A. Generate `.pkpass`

1. Issue a pass (phone or email) for a published event.
2. Open guest pass on **iPhone Safari** (or deployed web on device).
3. Tap **Add to Apple Wallet** (shown only when pass status is `active`).
4. Expect download / Add to Wallet sheet — not a JSON error page.

**Direct URL (replace token):**

```text
https://YOUR_PROJECT.supabase.co/functions/v1/wallet-apple?token=SECURE_TOKEN&apikey=ANON_KEY
```

### B. Wallet accepts pass

1. Complete Add to Wallet on device.
2. Pass appears with event name, guest, venue/date fields.
3. Barcode is QR; message must equal the **same hex** as the web pass QR (no URL wrapper).

### C. Scanner

1. Open event scanner (unchanged).
2. Scan Wallet barcode.
3. Expect same result as scanning the web pass QR (`valid` / `already_used` / etc.).

### D. Regression

1. Guest pass web QR still loads and scans.
2. SMS / issue / auth / routing unchanged.

### E. Preflight (repo)

```bash
npm run check:preflight
```

---

## Limitations (PoC)

- iOS / iPhone Safari only (button hidden elsewhere).
- Wallet Visual v1 uses generated gradient icon/logo/strip (not final brand assets); no per-event artwork yet.
- No pass updates after check-in; Wallet may show stale status.
- Anyone with `secure_token` can request a `.pkpass` (same capability as guest pass URL).
- `apikey` (anon) required on function URL for Supabase gateway.
- Edge runtime must support `passkit-generator` + `node-forge` npm imports.

---

## Known gaps before production

- Final vector PassKit asset pack (replace generated gradients).
- Per-event strip/background from `image_url`.
- Rate limiting and abuse monitoring on `wallet-apple`.
- Hide or disable Wallet button for `voided` / `checked_in` with clear UX.
- Cert expiry monitoring and rotation runbook.
- Optional: drop `apikey` from URL via custom domain / proxy.
- Google Wallet, APNs, `webServiceURL` updates — out of scope.

---

## Troubleshooting

| Symptom | Check |
|---------|--------|
| JSON `APPLE_CONFIG_MISSING` | All six `APPLE_*` secrets on deployed project |
| JSON `PKPASS_BUILD_FAILED` | P12 password, WWDR PEM, cert matches `pass.com.808tix.pass`; asset `path not found` → icons must be embedded (see `wallet-assets.ts`) |
| Wallet won’t add pass | Team ID / Pass Type ID in `pass.json` match portal; cert not expired |
| Scanner invalid | Barcode must be raw hex token only — compare to web QR value |
| 401 on function | Redeploy with `verify_jwt = false` or include `apikey` query param |

---

## Related docs

- [`APPLE_WALLET_SETUP.md`](./APPLE_WALLET_SETUP.md)
- [`APPLE_WALLET_READINESS.md`](./APPLE_WALLET_READINESS.md)
- [`WALLET_ARCHITECTURE.md`](./WALLET_ARCHITECTURE.md)
