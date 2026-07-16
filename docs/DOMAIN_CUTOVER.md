# 808Tickets domain cutover

Production launch origin: **`https://808tickets.com`**

**Repo status (implemented):** `eas.json`, auth redirect fallback (`auth-redirect-url.core.ts`), and static guards now default to `https://808tickets.com`. Local QA remains localhost/LAN.

**Operator status (still required outside repo):** Hosted Supabase Edge `PUBLIC_SITE_URL`, Supabase Auth redirect allow-list, Vercel production env, and **Resend** (not configured yet) must be set in dashboards — see §5 and §10.

**Related:** [STRIPE_PAYMENTS.md](./STRIPE_PAYMENTS.md) · [EVENT_DAY_RUNBOOK.md](./EVENT_DAY_RUNBOOK.md) · [qa/README.md](../qa/README.md) · [NATIVE_PHASE_0.md](./NATIVE_PHASE_0.md) · [MVP_ROADMAP.md](./MVP_ROADMAP.md)

### Canonical domain policy

| Host | Role |
|------|------|
| `https://808tickets.com` | **Launch canonical** buyer/guest web origin |
| `https://www.808tickets.com` | Redirects to apex (`808tickets.com`) |
| `https://808tix.vercel.app` | **Legacy transition** — Vercel redirect to launch domain; keep in Auth allow-list during transition if needed |
| `/pass/{token}` | Internal route unchanged (ticket page path) |

Resend email sending domain is **pending** — URL cutover does not configure Resend.

---

## 1. Target launch values

| Concern | Launch value |
|---------|--------------|
| Public brand | 808Tickets |
| Buyer / guest web origin | `https://808tickets.com` |
| `PUBLIC_SITE_URL` (Edge email / absolute ticket links) | `https://808tickets.com` |
| `EXPO_PUBLIC_PASS_LINK_BASE_URL` (native share/SMS + auth email fallback) | `https://808tickets.com` |
| Stripe Checkout `success_url` / `cancel_url` base | `https://808tickets.com` → `/purchase/success` and `/purchase/cancel` |
| Email ticket links | `https://808tickets.com/pass/{token}` |
| Buyer event buy links | `https://808tickets.com/events/{id}/buy?...` |

### Local QA (keep)

| Concern | Local value |
|---------|-------------|
| Expo web | `http://localhost:8081` (or LAN IP for phone ticket pages) |
| Local Supabase | `http://127.0.0.1:54321` (phone LAN: `http://{LAN_IP}:54321` when needed) |
| Local Edge `PUBLIC_SITE_URL` | `http://localhost:8081` |
| Smoke payment return URLs | `http://127.0.0.1:8081/purchase/...` |

Do **not** hardcode `808tickets.com` into local QA orchestration.

---

## 2. How origins are chosen today (runtime)

| Surface | Source of origin | Notes |
|---------|------------------|-------|
| Guest ticket share / SMS (web) | `window.location.origin` via `pass-link.ts` | Local host stays local; production host stays production. |
| Guest ticket share / SMS (native) | `EXPO_PUBLIC_PASS_LINK_BASE_URL` then Linking / localhost | Baked at EAS build time from `eas.json` (`https://808tickets.com`). |
| Stripe success/cancel (buyer web) | `window.location.origin` via `app-base-url.ts` → `purchase-urls.ts` | Paths are `/purchase/success` and `/purchase/cancel` (not `/checkout/...`). |
| Order confirmation email links | Edge `PUBLIC_SITE_URL` via `pass-link-server.ts` | Independent of the buyer browser; wrong production secret = wrong email links. |
| Auth email `emailRedirectTo` (web) | Current browser origin | Confirming on `808tickets.com` requires that host to serve the app. |
| Auth email redirect (native / missing env) | Env pass-link base, else `https://808tickets.com` in `auth-redirect-url.core.ts` | Repo fallback updated; rebuild native after EAS env change. |
| SMS Edge Function | Client-supplied absolute `pass_url` | Domain is whatever the app already built. |
| Apple Wallet `.pkpass` | Pass Type ID `pass.com.808tix.pass` | Not the web domain. `webServiceURL` is future / not MVP cutover-blocking. |
| Vercel routing | `vercel.json` rewrites only | No domain string in repo; custom domain is project settings + DNS. |

---

## 3. Reference classification table

| Reference | File | Current value | Type | Recommendation | Risk |
|-----------|------|---------------|------|----------------|------|
| Guest pass link base (preview EAS) | `eas.json` → `build.preview.env` | `https://808tickets.com` | native deep/web link fallback | **Done in repo** — rebuild preview binaries | Low after DNS live |
| Guest pass link base (production EAS) | `eas.json` → `build.production.env` | `https://808tickets.com` | production buyer-facing URL | **Done in repo** — rebuild store binaries | Low after DNS live |
| Display / example production origin | `.env.example` | `EXPO_PUBLIC_PASS_LINK_BASE_URL=https://808tickets.com` | docs-only (example) | Keep as launch docs target; do not force into local `.env` | Low — already documents launch intent |
| Local Supabase example | `.env.example` | `http://127.0.0.1:54321` | local QA URL | Keep | Low |
| Edge email site origin example | `supabase/functions/.env.example` | `# PUBLIC_SITE_URL=http://localhost:8081` | local QA URL | Keep localhost example; add commented production line in a later env-docs pass | Low |
| Auth email production fallback | `src/lib/auth-redirect-url.core.ts` | `PRODUCTION_FALLBACK_ORIGIN = https://808tickets.com` | native deep/web link fallback | **Done in repo** | Low |
| Pass / success / cancel builders (web) | `src/lib/pass-link.ts`, `src/lib/app-base-url.ts`, `src/lib/purchase-urls.ts` | Uses live origin or env | production buyer-facing URL / local QA URL | No hardcode change required; origin follows host | Low if Vercel serves custom domain |
| Stripe Checkout body URLs | `src/app/events/[eventId]/buy.tsx` → `create-checkout-session` | Caller-built absolute URLs | Stripe success/cancel URL | No path change; ensure buyers open buy page on launch domain | Medium if buy page still opened on old Vercel host |
| Edge create-checkout-session | `supabase/functions/create-checkout-session/index.ts` | Accepts client `success_url` / `cancel_url` | Stripe success/cancel URL | Do not bake domain into function; keep client-supplied | Low |
| Email ticket + success URLs | `supabase/functions/_shared/pass-link-server.ts`, `order-email.ts` | `PUBLIC_SITE_URL` | email ticket URL | Set hosted Edge secret to `https://808tickets.com` at cutover | High if left on old domain or unset |
| SMS ticket URL | `supabase/functions/send-pass-sms` + client builders | Absolute URL from client | production buyer-facing URL | Follows app origin / EAS env | Medium until EAS updated |
| Hosted guest rewrites | `vercel.json` | Path rewrites only | production buyer-facing URL | No domain edit; attach custom domain in Vercel UI | Low |
| EAS readiness asserts | `scripts/check-native-eas-readiness.mjs` | Expects `eas.json` == `https://808tickets.com` | internal/test-only | **Done in repo** | Low |
| Native env reminder / warn | `scripts/check-native-env.mjs` | `GUEST_PASS_ORIGIN = https://808tickets.com` | internal/test-only | **Done in repo** | Low |
| Pass-link unit fixtures | `scripts/check-pass-links.ts` | Uses `808tickets.com` as sample host | internal/test-only | **Done in repo** | Low |
| Auth redirect checks | `scripts/check-auth-redirect-url.ts`, `check-auth-callback-url.ts` | `808tickets.com` fixtures | internal/test-only | **Done in repo** | Low |
| Purchase UI forbidden hosts | `scripts/check-purchase-ui.ts` | Forbids hardcoding `808tix.vercel.app` (and localhost) in UI | internal/test-only | Keep forbid-list; optionally add `808tickets.com` if guarding against hardcodes | Low |
| Local smoke return URLs | `scripts/smoke-payments-local.ts` | `http://127.0.0.1:8081/purchase/...` | local QA URL | Keep | Low |
| Preview smoke / email smoke | `scripts/smoke-payments-preview.ts`, `smoke-email-send.ts` | Prefer env / localhost | local QA URL | Keep | Low |
| Local rehearsal banners | `scripts/rehearsal-local.ts` | localhost + LAN | local QA URL | Keep | Low |
| Playwright base | `playwright.config.ts`, `qa/README.md` | `http://localhost:8081` | local QA URL | Keep | Low |
| Stripe docs production examples | `docs/STRIPE_PAYMENTS.md` | `https://808tickets.com/...` | docs-only | Keep launch examples; note actual paths are `/purchase/*` | Low (docs show `/checkout/*` in one JSON sample — outdated path text) |
| Native / auth docs | `docs/NATIVE_PHASE_0.md`, `docs/MVP_ROADMAP.md` | Document `808tix.vercel.app` | docs-only | Update in implementation prompt after cutover | Low |
| SMS docs | `docs/SMS_DELIVERY.md` | Generic `your-domain.com` | docs-only | Point example at `808tickets.com` later | Low |
| Apple Pass Type ID | Wallet docs + secrets examples | `pass.com.808tix.pass` | Apple Wallet/pass URL source | Leave ID; unrelated to web hostname | Low for domain cutover |
| Apple `webServiceURL` | Wallet architecture / readiness | Future / not wired for MVP cutover | Apple Wallet/pass URL source | Revisit only if live pass updates are enabled | Low now |
| Internal slug / scheme | `app.json` | slug `808Tix`, scheme `tix808` | internal/test-only | Do not rename for domain cutover | — |
| No hits | repo search | `808tix.com`, `808tix.co` | — | None in tree | — |

---

## 4. Cutover strategy

### Principles

1. **DNS and Vercel first** — serve the same Expo web build on `808tickets.com` before changing link-builders that guests cannot open.
2. **Keep Vercel hostname temporarily** — `808tix.vercel.app` may remain as a redirect alias during transition (configured in Vercel, not in repo).
3. **Split client vs Edge secrets** — browser ticket links follow the host the buyer opened; emails require hosted `PUBLIC_SITE_URL`.
4. **Rebuild native** after `eas.json` / EAS env change — Expo public env is compile-time for device builds.
5. **Update static guards in the same change** as `eas.json` / hardcoded fallback so `check:all` stays green.
6. **Never replace localhost QA paths** with the launch domain.

### Recommended production env (hosted)

```bash
# Expo / Vercel web production
EXPO_PUBLIC_PASS_LINK_BASE_URL=https://808tickets.com
# plus hosted EXPO_PUBLIC_SUPABASE_URL / ANON_KEY (unchanged concern)

# Supabase Edge (hosted secrets)
PUBLIC_SITE_URL=https://808tickets.com
```

Local Edge / smokes continue to use `PUBLIC_SITE_URL=http://localhost:8081`.

### Stripe note

Checkout return URLs are **not** fixed in Stripe Dashboard for this app; they are requested per session from the buy page origin. Cutover success means buyers (and organizers sharing buy links) use `https://808tickets.com/...`, not the old Vercel hostname. Webhook endpoints remain Supabase function URLs (not the buyer domain).

---

## 5. Required external setup (non-code)

Complete before flipping production link env/fallbacks:

| Step | Owner surface | Done when |
|------|---------------|-----------|
| 1. DNS for `808tickets.com` (and `www` if used) | DNS provider → Vercel | Records resolve to Vercel |
| 2. Add domain to Vercel project | Vercel → Domains | Domain shows Valid / HTTPS |
| 3. HTTPS certificate active | Vercel | Browser padlock on `https://808tickets.com` |
| 4. Confirm Expo web export serves on custom domain | Vercel deployment | `/`, `/pass/{token}`, `/purchase/success`, `/events/.../buy` load |
| 5. Production / preview env on Vercel | Vercel env | `EXPO_PUBLIC_*` point at hosted Supabase; pass-link base = launch domain when ready |
| 6. Supabase Auth URL config | Supabase → Authentication → URL Configuration | Site URL + redirect allow-list include `https://808tickets.com/**` (keep localhost + optionally keep Vercel host during transition) |
| 7. Hosted Edge `PUBLIC_SITE_URL` | Supabase Edge secrets | `https://808tickets.com` |
| 8. Stripe | Stripe Dashboard | No buyer-domain allow-list required for Checkout Session URLs; confirm live/test webhook still hits Supabase `stripe-webhook` |
| 9. Resend / email from | Resend | Verify sending domain later; `EMAIL_FROM` branding can stay separate from URL cutover |
| 10. Apple Wallet | Apple / Edge | Pass Type ID stays `pass.com.808tix.pass`; no web domain required until `webServiceURL` exists |
| 11. EAS builds | EAS | After `eas.json` update, produce new preview/production binaries so share/SMS use launch domain |

---

## 6. Proposed implementation order (later prompt)

Do **not** execute these in this audit-only change.

### A. Docs / checklist (this file)

- [x] Audit table and external setup captured in `docs/DOMAIN_CUTOVER.md`
- [ ] Cross-link from runbook / Stripe / QA docs (lightweight)

### B. Production env examples only

- Align comments in `.env.example` / `supabase/functions/.env.example` with launch + local examples (no secrets)
- Optionally note production `PUBLIC_SITE_URL=https://808tickets.com` as a commented line next to localhost

### C. Native / EAS pass-link fallback (production-bound) — **done in repo**

- [x] `eas.json` preview + production `EXPO_PUBLIC_PASS_LINK_BASE_URL` → `https://808tickets.com`
- [x] `PRODUCTION_FALLBACK_ORIGIN` in `auth-redirect-url.core.ts`
- [x] Companion asserts: `check-native-eas-readiness.mjs`, `check-native-env.mjs`, pass-link and auth redirect fixture hosts
- [ ] Rebuild EAS preview/production binaries (operator)

### D. Hosted platform env

- Vercel production env for Expo public vars
- Supabase Edge `PUBLIC_SITE_URL`
- Supabase Auth redirect allow-list

### E. Production readiness checks

```bash
npm run check:env -- --mode production   # if/when that mode expects hosted secrets
npm run check:all
```

### F. Deployed smoke / rehearsal

- Open buy + ticket pages on `https://808tickets.com`
- One test purchase (manual Stripe as appropriate): success/cancel return on launch domain
- Confirm email ticket links use `https://808tickets.com/pass/...`
- Organizer share/SMS from a **new** native build (if using device builds)
- Keep local `qa:web` / `rehearsal:local` on localhost/LAN

---

## 7. Explicit non-goals

- Do **not** rename internal routes (`/pass/{token}` stays).
- Do **not** rename DB `passes` / `validate_pass` / Edge function names.
- Do **not** remove localhost or LAN QA examples.
- Do **not** hardcode `808tickets.com` into local smoke, Playwright, or rehearsal helpers.
- Do **not** change Stripe Checkout, webhook, email delivery, wallet signing, or scanner validation logic as part of domain cutover docs.
- Do **not** rename package/`app.json` slug (`808Tix`) / scheme (`tix808`) for this launch.

---

## 8. Cutover go / no-go

**Go** when:

- [x] `https://808tickets.com` serves buyer + ticket + purchase routes over HTTPS
- [ ] Supabase Auth redirects allow the new origin (operator)
- [ ] Hosted `PUBLIC_SITE_URL` is the launch domain (operator)
- [x] EAS / repo public pass-link base matches launch domain
- [x] `check:all` green after repo config/guard updates
- [ ] One real ticket link and one Stripe return URL observed on the launch domain (operator smoke)

**No-go** if:

- DNS/cert incomplete
- Email still embeds `808tix.vercel.app` while marketing claims `808tickets.com`
- Native builds still ship old pass-link base after you told organizers the launch domain is live
- Local QA broken because localhost examples were replaced

---

## 9. Known gaps / watchouts

1. **Hosted secrets:** Repo defaults are updated; **Supabase Edge `PUBLIC_SITE_URL`** must still be set to `https://808tickets.com` in the hosted project for email ticket links.
2. **Resend:** Not configured yet — email delivery remains preview/blocked until Resend domain and `RESEND_API_KEY` are set (out of scope for URL cutover).
3. **Native rebuild:** Existing device builds baked with the old pass-link base need a new EAS build to pick up `eas.json`.
4. **STRIPE_PAYMENTS.md** sample JSON uses `/checkout/success|cancel`; runtime paths are `/purchase/success|cancel` (docs-only path wording).
5. **NATIVE_PHASE_0.md / MVP_ROADMAP.md** may still mention `808tix.vercel.app` as historical reference — canonical launch domain is `808tickets.com`.

## 10. Operator checklist (post-repo cutover)

- [ ] Vercel production: `EXPO_PUBLIC_PASS_LINK_BASE_URL=https://808tickets.com` (if not only from build)
- [ ] Supabase Edge secret: `PUBLIC_SITE_URL=https://808tickets.com`
- [ ] Supabase Auth: Site URL + `https://808tickets.com/**` redirect allow-list (optionally keep `https://808tix.vercel.app/**` during redirect transition)
- [ ] EAS: new preview/production build after `eas.json` change
- [ ] Resend: deferred
- [ ] Smoke: one buy flow and one shared ticket link on `https://808tickets.com`
