import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type RequestBody = {
  pass_id?: string;
  event_name?: string;
  pass_url?: string;
  phone?: string;
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function normalizePhoneNumber(input: string): string {
  const trimmed = input.trim();

  if (!trimmed) {
    return '';
  }

  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');

  if (!digits) {
    return '';
  }

  if (hasPlus) {
    return `+${digits}`;
  }

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  return `+${digits}`;
}

function validatePhone(input: string): string | null {
  const normalized = normalizePhoneNumber(input);

  if (!/^\+[1-9]\d{9,14}$/.test(normalized)) {
    return null;
  }

  return normalized;
}

function buildSmsBody(eventName: string, passUrl: string): string {
  return `You've received a pass for ${eventName.trim()}. View it here: ${passUrl}`;
}

async function sendTwilioSms(to: string, body: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')?.trim();
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN')?.trim();
  const fromNumber = Deno.env.get('TWILIO_PHONE_NUMBER')?.trim();

  if (!accountSid || !authToken || !fromNumber) {
    console.log('[send-pass-sms] SMS provider not configured. Preview:', body);
    return { ok: false, error: 'SMS provider not configured.' };
  }

  const credentials = btoa(`${accountSid}:${authToken}`);
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      To: to,
      From: fromNumber,
      Body: body,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error('[send-pass-sms] Twilio error:', response.status, detail);
    return { ok: false, error: 'SMS provider rejected the message.' };
  }

  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Method not allowed.' }, 405);
  }

  const authHeader = req.headers.get('Authorization');

  if (!authHeader) {
    return jsonResponse({ ok: false, error: 'Authentication required.' }, 401);
  }

  let body: RequestBody;

  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return jsonResponse({ ok: false, error: 'Invalid request body.' }, 400);
  }

  const passId = body.pass_id?.trim();
  const eventName = body.event_name?.trim();
  const passUrl = body.pass_url?.trim();
  const phoneInput = body.phone?.trim();

  if (!passId || !eventName || !passUrl || !phoneInput) {
    return jsonResponse({ ok: false, error: 'pass_id, event_name, pass_url, and phone are required.' }, 400);
  }

  const phone = validatePhone(phoneInput);

  if (!phone) {
    return jsonResponse({ ok: false, error: 'Invalid phone number.' }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !supabaseAnonKey) {
    return jsonResponse({ ok: false, error: 'Server configuration error.' }, 500);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: pass, error: passError } = await supabase
    .from('passes')
    .select('id, guest_phone, event_id')
    .eq('id', passId)
    .maybeSingle();

  if (passError || !pass) {
    return jsonResponse({ ok: false, error: 'Pass not found or access denied.' }, 403);
  }

  const smsBody = buildSmsBody(eventName, passUrl);
  const twilioConfigured =
    Boolean(Deno.env.get('TWILIO_ACCOUNT_SID')?.trim()) &&
    Boolean(Deno.env.get('TWILIO_AUTH_TOKEN')?.trim()) &&
    Boolean(Deno.env.get('TWILIO_PHONE_NUMBER')?.trim());

  if (!twilioConfigured) {
    console.log('[send-pass-sms] Dev preview — to:', phone, 'body:', smsBody);
    return jsonResponse({
      ok: true,
      mode: 'preview',
      message: 'SMS provider not configured. Message preview returned for local testing.',
      preview: smsBody,
    });
  }

  const sendResult = await sendTwilioSms(phone, smsBody);

  if (!sendResult.ok) {
    return jsonResponse({ ok: false, error: sendResult.error }, 502);
  }

  return jsonResponse({
    ok: true,
    mode: 'sent',
    message: 'Pass link sent by SMS.',
  });
});
