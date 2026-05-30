# SMS Pass Delivery (V1)

Organizers can send a guest their pass link by SMS after issuing a pass.

## Flow

1. Organizer issues a pass with an optional **Guest Phone** on the Issue Pass screen.
2. On the success screen, **Send SMS** appears when a phone number was saved on the pass.
3. The app calls the Supabase Edge Function `send-pass-sms` (server-side only — no Twilio keys in the client).
4. SMS failure does **not** affect the issued pass or link.

## Message format

```
You've received a pass for {event_name}. View it here: {pass_url}
```

## Environment variables

### Expo app (`.env`)

Already required for pass links:

| Variable | Purpose |
|----------|---------|
| `EXPO_PUBLIC_PASS_LINK_BASE_URL` | Base URL embedded in SMS (e.g. `http://localhost:8081` or production domain) |

### Edge Function secrets (Supabase — not in Expo `.env`)

Set via Supabase Dashboard → Project Settings → Edge Functions → Secrets, or CLI:

```bash
supabase secrets set TWILIO_ACCOUNT_SID=your_account_sid
supabase secrets set TWILIO_AUTH_TOKEN=your_auth_token
supabase secrets set TWILIO_PHONE_NUMBER=+15551234567
```

| Secret | Required | Purpose |
|--------|----------|---------|
| `TWILIO_ACCOUNT_SID` | For live SMS | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | For live SMS | Twilio auth token |
| `TWILIO_PHONE_NUMBER` | For live SMS | Twilio sender number (E.164) |

`SUPABASE_URL` and `SUPABASE_ANON_KEY` are injected automatically in Edge Functions.

## Local testing

### Without Twilio (dev preview)

1. Start Supabase: `supabase start`
2. Serve the function:
   ```bash
   supabase functions serve send-pass-sms --no-verify-jwt
   ```
   Omit `--no-verify-jwt` when testing with a real logged-in session from the app.
3. Issue a pass with a phone number in the app.
4. Tap **Send SMS** — the function returns `mode: "preview"` with the message body instead of sending.
5. Check the function terminal for `[send-pass-sms] Dev preview` logs.

### With Twilio

1. Set the three Twilio secrets on your Supabase project (or local secrets file for `functions serve`).
2. Use a verified recipient number on Twilio trial accounts.
3. Issue a pass → **Send SMS** → guest should receive the text.

### Deploy

```bash
supabase functions deploy send-pass-sms
supabase secrets set TWILIO_ACCOUNT_SID=... TWILIO_AUTH_TOKEN=... TWILIO_PHONE_NUMBER=...
```

## Security

- Function requires `Authorization: Bearer <organizer JWT>`.
- Pass lookup uses RLS — organizers can only send SMS for passes on their own events.
- Twilio credentials never ship to the mobile/web client.

## Out of scope (V1)

- Delivery status tracking / DB columns
- Push notifications
- Transfer / resale / wallet
