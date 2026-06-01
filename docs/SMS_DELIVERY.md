# SMS Pass Delivery (V1)

Organizers can send a guest their pass link by SMS after issuing a pass.

## Flow

1. Organizer issues a pass with an optional **Guest Phone** on the Issue Pass screen.
2. On the success screen, **Send SMS** appears when a phone number was saved on the pass.
3. The app calls the Supabase Edge Function `send-pass-sms` (server-side only — Twilio credentials never reach the client).
4. SMS failure does **not** invalidate the pass. The guest link remains valid and **Share Pass** still works.

## Message format

```
You've received a pass for {event_name}.
View it here:
{pass_url}
```

No marketing copy. No emojis.

## Architecture

| Layer | Responsibility |
|-------|----------------|
| `src/lib/send-pass-sms.ts` | Client invokes Edge Function with pass id, event name, pass URL, phone |
| `supabase/functions/send-pass-sms` | Auth check, pass ownership via RLS, preview or Twilio send |
| Twilio REST API | Delivers SMS when secrets are configured |

## Twilio account setup

Do this once in the [Twilio Console](https://console.twilio.com/):

1. **Create or sign in** to a Twilio account.
2. **Copy credentials** from Console → Account → API keys & tokens (or Account Info):
   - **Account SID** → `TWILIO_ACCOUNT_SID`
   - **Auth Token** → `TWILIO_AUTH_TOKEN`
3. **Buy or provision a phone number** (Phone Numbers → Manage → Buy a number) with SMS capability.
   - Use E.164 format for the secret, e.g. `+18085550100` → `TWILIO_PHONE_NUMBER`
4. **Trial accounts only:** verify each recipient number under Phone Numbers → Manage → Verified Caller IDs before testing. Production accounts can send to any valid number (subject to carrier rules and opt-in policy).

## Supabase secrets

Secrets are stored in Supabase only. Never add Twilio values to Expo `.env` or commit them to git.

### Production (linked remote project)

Link the project if needed:

```bash
supabase link --project-ref YOUR_PROJECT_REF
```

Set all three secrets in one command:

```bash
supabase secrets set \
  TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
  TWILIO_AUTH_TOKEN=your_auth_token \
  TWILIO_PHONE_NUMBER=+18085550100
```

Verify secrets are set (names only — values are hidden):

```bash
supabase secrets list
```

Deploy the function (secrets are picked up automatically at runtime):

```bash
supabase functions deploy send-pass-sms
```

### Local Supabase (`supabase start`)

Create `supabase/functions/.env` from the example (gitignored):

```bash
cp supabase/functions/.env.example supabase/functions/.env
```

Edit `supabase/functions/.env`:

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+18085550100
```

Serve with the env file:

```bash
supabase functions serve send-pass-sms --env-file supabase/functions/.env
```

Omit `--env-file` (or leave values blank) to exercise **preview mode** locally.

## Expo app environment

Pass links embedded in SMS use the public app URL:

| Variable | Purpose |
|----------|---------|
| `EXPO_PUBLIC_PASS_LINK_BASE_URL` | Base URL in SMS (e.g. `https://your-domain.com` in production) |

`EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` must point at the same Supabase project where the function is deployed.

## Preview mode vs live SMS

| Condition | Behavior |
|-----------|----------|
| Any of `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` missing | Preview mode: `{ ok: true, mode: "preview" }`, message logged to function logs |
| All three secrets present | Live SMS via Twilio: `{ ok: true, mode: "sent" }` |
| Twilio rejects the send | `{ ok: false, error: "..." }` — pass is unchanged |

Preview log line:

```
[send-pass-sms] Preview mode — to: +18085550100 body: You've received a pass for ...
```

Live log line:

```
[send-pass-sms] Sent via Twilio — sid: SM... to: +18085550100
```

## Local testing

### Preview (no Twilio)

1. `supabase start`
2. `supabase functions serve send-pass-sms --env-file supabase/functions/.env` (with Twilio lines commented out)
3. Run the app, sign in as organizer, issue a pass with a phone number.
4. Tap **Send SMS** — UI shows preview message; function terminal shows preview log.

### Live SMS (local function + Twilio)

1. Fill in all three Twilio values in `supabase/functions/.env`.
2. On a **trial** account, add the guest phone as a Verified Caller ID in Twilio.
3. `supabase functions serve send-pass-sms --env-file supabase/functions/.env`
4. Point the app at local Supabase (`EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`).
5. Issue pass → **Send SMS** → guest phone receives the text.

### Live SMS (deployed function)

1. Set secrets on the remote project (commands above).
2. `supabase functions deploy send-pass-sms`
3. App uses production `EXPO_PUBLIC_SUPABASE_URL`.
4. Issue pass → **Send SMS**.

## First real SMS test (end-to-end)

1. Complete Twilio setup (account, number, verify recipient if trial).
2. Set secrets on your Supabase project and deploy:
   ```bash
   supabase secrets set TWILIO_ACCOUNT_SID=... TWILIO_AUTH_TOKEN=... TWILIO_PHONE_NUMBER=+1...
   supabase functions deploy send-pass-sms
   ```
3. Confirm `EXPO_PUBLIC_PASS_LINK_BASE_URL` is a URL the guest can open (localhost only works for you on the same machine).
4. In the app: open an event → **Issue Pass** → enter guest name, pass type, and **your real mobile number** (E.164 or 10-digit US).
5. Tap **Issue Pass**, then **Send SMS**.
6. Expect **SMS sent.** on screen and the text on your phone within a few seconds.
7. Open the link in the SMS — guest pass should load.

If it fails: check Supabase Edge Function logs (`supabase functions logs send-pass-sms` or Dashboard → Edge Functions → Logs). The pass and **Share Pass** remain available.

## Security

- Function requires `Authorization: Bearer <organizer JWT>`.
- Pass lookup uses RLS — organizers can only send SMS for passes on their own events.
- Twilio credentials exist only in Supabase Edge Function secrets (or local `supabase/functions/.env` for dev).

## Out of scope (V1)

- Delivery status tracking / DB columns
- Push notifications
- Transfer / resale / wallet
- Apple Wallet
