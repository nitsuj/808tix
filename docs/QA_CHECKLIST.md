# 808Tix QA / preflight checklist

Automated checks guard routing, export output, and pass-link generation. **Cursor agents must run these before marking any build complete.**

## Required command

```bash
npm run check:preflight
```

This runs, in order:

1. `npm run lint` — Expo ESLint
2. `npm run check:vercel` — `vercel.json` shape and rewrite rules
3. `npm run check:export` — `npx expo export --platform web` + `dist/` route files
4. `npm run check:links` — pass URL normalization and absolute link rules
5. `npm run check:issue-pass` — Issue Pass contact validation rules

If any step fails, **do not** report the task as complete until fixed.

## When each check is required

| Change type | Must pass |
|-------------|-----------|
| `vercel.json` | `check:vercel` (and `check:export` if routes changed) |
| New/changed Expo routes | `check:export` |
| `src/lib/pass-link.ts` / `pass-link.core.ts` | `check:links` |
| `src/lib/issue-pass-form.ts` | `check:issue-pass` |
| Deploy to Vercel | Full `check:preflight` + manual smoke below |
| Native EAS / device builds | `check:native-phase0` + manual smoke in [`NATIVE_PHASE_0.md`](./NATIVE_PHASE_0.md) |

## Individual scripts

```bash
npm run check:vercel    # vercel.json only
npm run check:export    # export + dist file presence
npm run check:links     # pass link unit checks
```

### vercel.json rules (`check:vercel`)

- Valid JSON
- **No** `"handle"` entries (e.g. no `"handle": "filesystem"`)
- Rewrites for:
  - `/pass/:token` → `/pass/[token].html`
  - `/events/:eventId` → `/events/[eventId].html`
  - `/events/:eventId/scan|issue|edit|passes` → matching `[eventId]/*.html`
- When `dist/` exists, each rewrite destination file must be present

### Export rules (`check:export`)

After `npx expo export --platform web`, `dist/` must contain:

- `pass/[token].html`
- `events/[eventId].html`
- `events/[eventId]/scan.html`
- `events/[eventId]/issue.html`
- `events/[eventId]/edit.html`
- `events/[eventId]/passes.html`

### Pass link rules (`check:links`)

- Base URL without protocol gets `https://` prepended
- Trailing slashes stripped from origin
- Output is absolute: `https://host/pass/{token}`
- Never a host-only or path-relative URL that would resolve under `/events/{eventId}/...`

## Manual smoke test (after Vercel deploy)

- [ ] `https://{host}/pass/fake-token` → in-app **Pass unavailable** (not Vercel 404)
- [ ] Real pass link → QR / ticket detail loads
- [ ] From pass list: **View Pass** opens `https://{host}/pass/{token}` (not under `/events/...`)
- [ ] Share / SMS use the same absolute pass URL
- [ ] Organizer login and scanner still work (unchanged flows)

## Cursor completion policy

Before saying **done**, **complete**, or **ready to deploy**:

1. Run `npm run check:preflight`
2. Paste the terminal output (or confirm all steps passed)
3. Note any manual deploy steps (env vars, Supabase migrations) separately from preflight
