# Native Phase 0 — EAS readiness

Phase 0 prepares 808Tix for native organizer/scanner builds **without** UI changes, route groups, or new screens.

**Guest experience stays web-first:** `/pass/{token}` on Vercel, Apple Wallet, SMS links.

---

## 1. EAS profiles

| Profile | Purpose | Command |
|---------|---------|---------|
| **development** | Dev client on physical device; local Metro | `eas build --profile development --platform ios` |
| **preview** | Internal TestFlight / APK dogfood; production guest link env | `eas build --profile preview --platform ios` |
| **production** | App Store / Play Store submit | `eas build --profile production --platform ios` |

Configured in [`eas.json`](../eas.json):

- **development** — `developmentClient: true`, internal distribution
- **preview** — internal distribution, `EXPO_PUBLIC_PASS_LINK_BASE_URL=https://808tix.vercel.app`
- **production** — store distribution, same guest pass base URL

### First-time setup (human steps)

1. Install EAS CLI: `npm install -g eas-cli`
2. Log in: `eas login`
3. Confirm project: `eas project:info` (project ID in `app.json` → `extra.eas.projectId`)
4. Configure iOS credentials: `eas credentials` (or let EAS manage on first build)
5. Create App Store Connect app record for bundle ID `com.howzitjustin.808Tix`

### Build commands

```bash
# Dev client (connect to `npx expo start --dev-client`)
eas build --profile development --platform ios

# Internal beta (TestFlight internal testing)
eas build --profile preview --platform ios

# Store release candidate
eas build --profile production --platform ios
```

Android (when ready):

```bash
eas build --profile preview --platform android
eas build --profile production --platform android
```

Package name: `com.howzitjustin.t808tix` (see `app.json`).

### Submit (after production build)

```bash
eas submit --profile production --platform ios
```

Configure App Store Connect API key or Apple ID in EAS when prompted (not stored in repo).

---

## 2. Environment variables

### Required for native builds

| Variable | Where to set | Notes |
|----------|--------------|-------|
| `EXPO_PUBLIC_SUPABASE_URL` | EAS env / `.env` | Hosted Supabase HTTPS URL for device builds |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | EAS env / `.env` | Anon key (public) |
| `EXPO_PUBLIC_PASS_LINK_BASE_URL` | `eas.json` preview/production + EAS | **Must be** `https://808tix.vercel.app` |

### Set EAS environment variables

```bash
eas env:create --name EXPO_PUBLIC_SUPABASE_URL --value "https://YOUR_PROJECT.supabase.co" --environment preview --environment production
eas env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "YOUR_ANON_KEY" --environment preview --environment production
```

`EXPO_PUBLIC_PASS_LINK_BASE_URL` is already set in `eas.json` for preview/production. Override only if staging guest web uses a different origin.

### Verify locally

```bash
npm run check:native-env
npm run check:native-eas
npm run check:native-phase0
```

Copy [`.env.example`](../.env.example) → `.env` for local dev. **Never commit `.env`.**

### Critical rule: guest links

On native, issued pass URLs must open **Vercel guest pass**, not the app scheme.

- Correct: `https://808tix.vercel.app/pass/{token}`
- Wrong: `808Tix://pass/...`

If `EXPO_PUBLIC_PASS_LINK_BASE_URL` is missing on a device build, `pass-link.ts` may fall back to the app linking origin — verify in smoke test below.

---

## 3. Native auth checklist (configuration only — Phase 1 implements app-side handling)

Sign **in** works on native today. Sign **up with email confirmation** currently redirects to **web** (Vercel). Complete this checklist before public TestFlight.

### A. App configuration (current)

- [x] URL scheme: `808Tix` (`app.json`)
- [x] iOS bundle ID: `com.howzitjustin.808Tix`
- [x] Android package: `com.howzitjustin.t808tix`
- [x] AsyncStorage auth persistence (`supabase-auth-storage.ts`)
- [ ] Native auth callback route (Phase 1 — not Phase 0)

### B. Supabase Dashboard → Authentication → URL Configuration

**Keep existing web URLs.** Add native entries when starting Phase 1:

| Redirect URL | Purpose |
|--------------|---------|
| `https://808tix.vercel.app/**` | Web signup confirmation + guest (keep) |
| `http://localhost:8081/**` | Expo web dev (keep) |
| `808tix://**` | Native custom scheme (Phase 1) — consider lowercase alias |
| `808Tix://**` | Matches current `app.json` scheme |
| `exp+808tix://**` | Expo dev client (if used) |

**Site URL:** keep `https://808tix.vercel.app` for web.

### C. Sign-up redirect behavior (today)

`resolveAuthEmailRedirectUrl()` on native uses `EXPO_PUBLIC_PASS_LINK_BASE_URL` → confirmation emails open **Vercel**, not the app. Acceptable for Phase 0 smoke tests using **sign in** only.

Phase 1 will change `emailRedirectTo` to app scheme + add `Linking` handler.

### D. Pre-TestFlight auth tests

- [ ] Sign in on device → kill app → reopen → still signed in
- [ ] Sign out → sign in again
- [ ] (Phase 1) Sign up → email link → opens app → dashboard

---

## 4. Native smoke test instructions

Run on a **physical device** with a **development** or **preview** build. Use a **live (published)** test event.

### Prerequisites

- EAS build installed on device
- Organizer account with at least one **published** event
- `EXPO_PUBLIC_PASS_LINK_BASE_URL=https://808tix.vercel.app` in build env
- Hosted Supabase (not localhost) in build env for device

### A. Auth

| Step | Expected |
|------|----------|
| Open app | Login screen or dashboard if session exists |
| Sign in with email/password | Dashboard loads |
| Force-quit app, reopen | Still signed in |
| Sign out | Returns to login |

**Skip sign-up email confirmation** until Phase 1 unless testing on web.

### B. Command Center

| Step | Expected |
|------|----------|
| View event list | Draft/Live filters work |
| Open event | Event Detail loads |

### C. Event ops (live event)

| Step | Expected |
|------|----------|
| Publish draft (if needed) | Status → Live |
| Issue Pass | Pass created; success screen |
| Share / SMS (if configured) | Link is `https://808tix.vercel.app/pass/...` — **not** app scheme |
| Open Issued list | Pass appears; search/sort work |

### D. Scanner (native camera)

| Step | Expected |
|------|----------|
| Open Scan from Event Detail | Camera permission prompt (first time) |
| Scan valid pass QR | CONFIRMED |
| Scan same pass again | ALREADY CHECKED IN |
| Scan wrong-event or random QR | UNCONFIRMED |
| Footer count | Updates after valid scan |

Use **native camera** (`expo-camera`), not mobile Safari.

### E. Draft guard

| Step | Expected |
|------|----------|
| Open scanner on **draft** event | Blocked with publish message |

### F. Guest pass (web — separate device/browser)

| Step | Expected |
|------|----------|
| Open shared pass URL in Safari/Chrome | Guest pass renders |
| Add to Apple Wallet (iPhone) | `.pkpass` downloads/opens |

Guest flow must **not** require the organizer app.

---

## 5. Automated checks

```bash
npm run check:native-phase0
```

Runs:

- `check:native-eas` — `eas.json` profiles, `app.json` identifiers, plugins
- `check:native-env` — `.env.example` + local `.env` when present

Included in `check:preflight`.

---

## 6. What Phase 0 does not include

- Route groups, tabs, new screens
- Native auth deep link implementation
- UI redesign
- Google Wallet
- Retiring web organizer scanner

See prior native architecture plan for Phase 1+.

---

## 7. Quick reference

| Item | Value |
|------|-------|
| EAS project ID | `46ba198a-4f64-4e9d-a800-f48b51d5f463` |
| iOS bundle ID | `com.howzitjustin.808Tix` |
| Android package | `com.howzitjustin.t808tix` |
| URL scheme | `808Tix` |
| Guest pass origin | `https://808tix.vercel.app` |
