# Apple Wallet — Pass Type ID & Certificate Setup Checklist

**Purpose:** Prepare signing credentials for future 808Tix `.pkpass` generation.  
**No wallet code in this step** — portal + local export + secret inventory only.

**Prerequisite:** Active **Apple Developer Program** membership (you have this).

**Related:** [`WALLET_ARCHITECTURE.md`](./WALLET_ARCHITECTURE.md)

---

## Naming recommendation

| Item | Recommended value | Notes |
|------|-------------------|--------|
| **Pass Type ID** | `pass.com.808tix.pass` | Reverse-DNS; one ID for all event guest passes. |
| **Certificate name** (portal label) | `808Tix Event Pass Signing` | Human-readable only; not embedded in passes. |
| **Organization name** (in `pass.json`) | `808Tix` | Shown on pass; pick legal/marketing name you want guests to see. |

If you later ship multiple pass *styles* (e.g. VIP vs GA templates), still use **one** Pass Type ID unless Apple forces a split — differentiate with `pass.json` fields, not new Type IDs.

**Do not use** placeholder IDs like `pass.com.example.*` in production.

---

## Part 1 — Create a Pass Type ID

### Portal path

1. Sign in: [https://developer.apple.com/account](https://developer.apple.com/account)
2. Left sidebar: **Certificates, Identifiers & Profiles**
3. Top tabs: **Identifiers**
4. Click **+** (register a new identifier)

### Steps

5. Select **Pass Type IDs** → **Continue**
6. **Description:** `808Tix Event Pass` (internal label)
7. **Identifier:** `pass.com.808tix.pass` → **Continue**
8. **Register**

### Record for 808Tix (save in password manager / team doc)

| Field | Your value |
|-------|------------|
| Pass Type ID | `pass.com.808tix.pass` |
| Created date | __________ |

### Also record Team ID (needed later)

1. Same account → **Membership details** (or **Account** → membership)
2. Copy **Team ID** (10 characters, e.g. `AB12CD34EF`)

| Field | Your value |
|-------|------------|
| Team ID | __________ |

---

## Part 2 — Generate the Pass Type ID certificate

### Portal path

1. **Certificates, Identifiers & Profiles** → **Certificates**
2. Click **+**

### Steps

3. Under **Services**, select **Pass Type ID Certificate** → **Continue**
4. **Pass Type ID:** choose `pass.com.808tix.pass` → **Continue**
5. You must upload a **Certificate Signing Request (CSR)** from your Mac (next section)
6. **Continue** → **Download** the certificate (`.cer` file)

### Create CSR on Mac (one-time per cert)

1. Open **Keychain Access** (macOS)
2. Menu **Keychain Access** → **Certificate Assistant** → **Request a Certificate From a Certificate Authority…**
3. **User Email:** your Apple ID email  
4. **Common Name:** `808Tix Pass Signing` (or similar)  
5. **CA Email:** leave empty  
6. **Request is:** **Saved to disk**  
7. Save as e.g. `808Tix-PassTypeID.certSigningRequest`
8. Upload this `.certSigningRequest` file in the Apple portal step above

### After download

9. Locate `pass.cer` (or similar) in **Downloads**
10. Double-click to install into **Keychain Access** → should appear under **My Certificates** with a private key underneath

| Field | Your value |
|-------|------------|
| Certificate expiry | __________ |
| Keychain entry name | __________ |

---

## Part 3 — Export certificate as `.p12`

Signing on a server needs **certificate + private key** in one exportable bundle.

### Steps (Keychain Access)

1. Open **Keychain Access**
2. Select **login** keychain → category **My Certificates**
3. Find the entry for your **Pass Type ID** cert (expand triangle if nested)
4. Select **only the certificate** that shows the private key as child (the cert line, not “Apple Worldwide…”)
5. **File** → **Export Items…**
6. **File format:** **Personal Information Exchange (.p12)**
7. Save as: `808Tix-PassTypeID-signing.p12` (store outside git)
8. Set a **strong export password** — you will store this as a secret (`APPLE_PASS_CERT_PASSWORD`)

### Verify export (optional, Terminal)

```bash
openssl pkcs12 -in 808Tix-PassTypeID-signing.p12 -noout -info
```

Enter the export password when prompted. You should see certificate + private key info, no errors.

---

## Part 4 — Apple WWDR intermediate certificate

Pass signing requires **both** your Pass Type ID cert and Apple’s **WWDR** intermediate.

### Download (Apple PKI)

1. Open [https://www.apple.com/certificateauthority/](https://www.apple.com/certificateauthority/)
2. Download **Worldwide Developer Relations - G4** (Pass Type ID / Wallet use G4 chain as of current Apple guidance)
3. File is typically `AppleWWDRCAG4.cer`

### Convert to PEM for servers (Terminal)

```bash
openssl x509 -inform DER -in AppleWWDRCAG4.cer -out AppleWWDRCAG4.pem
```

Keep `AppleWWDRCAG4.pem` with your other wallet files (not in git).

---

## Exact files 808Tix will need

| File / material | Format | Used for |
|-----------------|--------|----------|
| Pass Type ID | string | `passTypeIdentifier` in `pass.json` |
| Team ID | string | `teamIdentifier` in `pass.json` |
| Organization name | string | `organizationName` in `pass.json` |
| Pass signing identity | `.p12` **or** `signerCert.pem` + `signerKey.pem` | PKCS#7 signature on `manifest.json` |
| P12 export password | string | Decrypt `.p12` at runtime |
| WWDR G4 | `.pem` | Chain validation when signing |

**Optional later (not required for basic issue-only passes):**

| Item | When |
|------|------|
| APNs key/cert for pass updates | Phase 2 — push updated pass after check-in |
| `webServiceURL` + `authenticationToken` | Phase 2 — Apple pass update web service |

---

## Where secrets should live

**Rule:** Never commit `.p12`, `.pem`, `.cer`, CSR, or passwords to git. Never put them in `EXPO_PUBLIC_*` env vars.

### Recommended layout

| Secret name | Value | Where to store |
|-------------|-------|----------------|
| `APPLE_PASS_TYPE_IDENTIFIER` | `pass.com.808tix.pass` | Supabase Edge Function secrets **and** Vercel (only if signer runs on Vercel) |
| `APPLE_TEAM_ID` | 10-char Team ID | Same |
| `APPLE_ORGANIZATION_NAME` | `808Tix` | Same |
| `APPLE_PASS_CERT_P12_BASE64` | Base64 of entire `.p12` file | Same (preferred single blob for Edge/Node) |
| `APPLE_PASS_CERT_PASSWORD` | P12 export password | Same |
| `APPLE_WWDR_CERT_PEM` | Full PEM text of `AppleWWDRCAG4.pem` | Same |

**Alternative to P12 base64** (some libraries prefer PEM):

| Secret name | Value |
|-------------|-------|
| `APPLE_PASS_SIGNER_CERT_PEM` | `openssl pkcs12 -in …p12 -clcerts -nokeys -out signer.pem` |
| `APPLE_PASS_SIGNER_KEY_PEM` | `openssl pkcs12 -in …p12 -nocerts -nodes -out key.pem` |
| `APPLE_PASS_CERT_PASSWORD` | Only if key PEM is still encrypted |

### Supabase (primary for 808Tix today)

When you implement `wallet-apple` Edge Function:

```bash
# Example — run from project root when ready (NOT during this prep task)
supabase secrets set APPLE_PASS_TYPE_IDENTIFIER=pass.com.808tix.pass
supabase secrets set APPLE_TEAM_ID=XXXXXXXXXX
supabase secrets set APPLE_ORGANIZATION_NAME=808Tix
supabase secrets set APPLE_PASS_CERT_PASSWORD='your-p12-password'
supabase secrets set APPLE_WWDR_CERT_PEM="$(cat AppleWWDRCAG4.pem)"
supabase secrets set APPLE_PASS_CERT_P12_BASE64="$(base64 -i 808Tix-PassTypeID-signing.p12 | tr -d '\n')"
```

Use **separate Supabase projects** for local/staging/production; duplicate secrets per project.

### Vercel

Only needed if the **signer runs on Vercel** (Node `passkit-generator` route). The static Expo web app on Vercel does **not** need Apple cert secrets.

- **Project → Settings → Environment Variables**
- Same names as above; scope **Production** (and Preview if you test there)
- Mark cert/password secrets **Sensitive**

### Local development

- Store files in a folder **outside** the repo, e.g. `~/808Tix-secrets/wallet/apple/`
- Load via `.env.local` only on a machine that generates test passes — **add `~/808Tix-secrets/` to global gitignore habits**, do not add to 808Tix repo

---

## How to verify setup *before* implementing Wallet

Complete this checklist. All should pass before writing `wallet-apple` code.

### A. Portal verification

- [ ] Pass Type ID `pass.com.808tix.pass` appears under **Identifiers → Pass Type IDs**
- [ ] **Certificates** lists a **Pass Type ID Certificate** for that identifier, status **Valid**
- [ ] Expiry date is noted; calendar reminder set **30 days before** expiry

### B. Keychain verification (Mac)

- [ ] **My Certificates** shows Pass Type ID cert with a **private key** underneath
- [ ] No warning icon on the certificate
- [ ] `.p12` export succeeds and `openssl pkcs12 -info` runs without error

### C. WWDR verification

- [ ] `AppleWWDRCAG4.pem` exists and starts with `-----BEGIN CERTIFICATE-----`

### D. Secret inventory verification (no code yet)

- [ ] Team ID, Pass Type ID, and Organization name written in team vault
- [ ] `.p12` + password stored in password manager / secrets vault
- [ ] PEM files backed up securely (encrypted disk or vault)
- [ ] Confirmed **no** wallet files committed: `git status` clean after moving certs out of repo

### E. Pre-implementation smoke test (optional, manual)

Allowed **before** 808Tix integration: use Apple’s docs or a **local throwaway** script on your machine (not committed to 808Tix) to generate one `.pkpass` with:

- `passTypeIdentifier` = your Pass Type ID  
- `teamIdentifier` = your Team ID  
- `serialNumber` = `test-001`  
- `barcode.message` = a test hex string  

Open the `.pkpass` on an iPhone → **Add to Wallet** succeeds.

If you skip this, minimum bar is sections **A–D** complete.

### F. 808Tix integration verification (later, when code exists)

Not part of this prep task; for reference:

- [ ] Edge Function returns `Content-Type: application/vnd.apple.pkpass`
- [ ] Real `secure_token` produces a pass that scans with existing 808Tix scanner
- [ ] Invalid token returns 404, not a signed pass

---

## Quick reference — portal URLs

| Task | URL |
|------|-----|
| Account home | https://developer.apple.com/account |
| Identifiers | https://developer.apple.com/account/resources/identifiers/list |
| Certificates | https://developer.apple.com/account/resources/certificates/list |
| Apple PKI (WWDR) | https://www.apple.com/certificateauthority/ |
| PassKit docs | https://developer.apple.com/documentation/walletpasses |

---

## Checklist summary (printable)

```
[ ] 1. Pass Type ID created: pass.com.808tix.pass
[ ] 2. Team ID recorded
[ ] 3. CSR created and Pass Type ID certificate downloaded
[ ] 4. Cert installed in Keychain with private key
[ ] 5. Exported 808Tix-PassTypeID-signing.p12 + strong password
[ ] 6. Downloaded WWDR G4 → AppleWWDRCAG4.pem
[ ] 7. Secrets inventory documented (not in git)
[ ] 8. Supabase/Vercel secret plan agreed (names above)
[ ] 9. Optional: manual .pkpass opens on iPhone
[ ] Ready for wallet-apple implementation
```
