# MVP backlog

Deferred work after June 10 MVP scope.

## Organizer onboarding

**Status (2026-05-31):** Self-service signup is implemented in the app.

| Step | Status |
|------|--------|
| Create account (email + password) | App — login screen **Create Account** |
| Organizer profile row | Auto — `handle_new_user` trigger on `auth.users` insert |
| Profile backfill if missing | App — `ensure_organizer_profile` RPC + retry on login |
| Create event → issue pass → scan | Works when profile exists and Supabase auth allows signup |

### Deploy requirement

Apply migration `20250610000013_ensure_organizer_profile.sql` on hosted Supabase:

```bash
supabase db push
```

Or run the migration SQL in the Supabase dashboard.

### Supabase Auth URL configuration (hosted)

Signup confirmation emails use `emailRedirectTo` from the app (`window.location.origin` on web, else `EXPO_PUBLIC_PASS_LINK_BASE_URL`). Also set in **Supabase Dashboard → Authentication → URL Configuration**:

| Setting | Production value |
|---------|------------------|
| **Site URL** | `https://808tix.vercel.app` |
| **Redirect URLs** | `https://808tix.vercel.app/**` |
| | `http://localhost:8081/**` (Expo web dev) |
| | `http://127.0.0.1:54321/**` (local Supabase, if used) |

Do **not** leave Site URL as `http://localhost:3000` on the hosted project — confirmation links will redirect there.

### Known limitations

- **Email confirmation:** If hosted Supabase requires email confirm, signup shows “check your email” and the user must confirm before sign-in.
- **No password reset UI** in the app yet (use Supabase dashboard or add later).
- **No social login** (by design for MVP).
- **No organizations / teams** — one profile = one organizer.
- **Profile name:** `full_name` is optional; dashboard shows email until set.
- **Legacy users** created in Supabase Auth without the profile trigger need **Set up organizer profile** or the ensure RPC.

### Future auth enhancements

- Password reset / forgot password flow
- Email change
- Organizer display name during signup
- Split `guest_first_name` / `guest_last_name` on passes (see below)
- Multi-organizer / venue accounts
- Invite-based staff roles (scanner-only users)

---

## Pass recipient names

- **TODO:** Split `passes.guest_name` into `guest_first_name` and `guest_last_name` columns.
- **Current:** Issue Pass collects first + last in the UI and stores `"${first_name} ${last_name}"` in `guest_name`.
- **When splitting:** Migrate existing `guest_name` values; update issue form insert, pass lists, guest pass, scanner, and Apple Wallet field mapping.
