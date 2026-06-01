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

type TwilioErrorPayload = {
  message?: string;
  code?: number;
};

type TwilioSendResult =
  | { ok: true; sid: string }
  | { ok: false; status: number; code: number | null; message: string; safeMessage: string };

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function errorResponse(status: number, message: string, debugCode: string): Response {
  return jsonResponse(
    {
      ok: false,
      message,
      debugCode,
    },
    status,
  );
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
  return `You've received a pass for ${eventName.trim()}.\nView it here:\n${passUrl}`;
}

function isTwilioConfigured(): boolean {
  return Boolean(
    Deno.env.get('TWILIO_ACCOUNT_SID')?.trim() &&
      Deno.env.get('TWILIO_AUTH_TOKEN')?.trim() &&
      Deno.env.get('TWILIO_PHONE_NUMBER')?.trim(),
  );
}

async function sendTwilioSms(
  to: string,
  body: string,
): Promise<TwilioSendResult> {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')!.trim();
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN')!.trim();
  const fromNumber = Deno.env.get('TWILIO_PHONE_NUMBER')!.trim();

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

  const responseText = await response.text();

  if (!response.ok) {
    let twilioMessage = responseText;
    let twilioCode: number | null = null;

    try {
      const payload = JSON.parse(responseText) as TwilioErrorPayload;
      twilioMessage = payload.message ?? responseText;
      twilioCode = payload.code ?? null;
    } catch {
      // Keep raw response text when Twilio does not return JSON.
    }

    console.error('[send-pass-sms] checkpoint: twilio_error', {
      status: response.status,
      code: twilioCode,
      message: twilioMessage,
    });
    return {
      ok: false,
      status: response.status,
      code: twilioCode,
      message: twilioMessage,
      safeMessage: 'Could not send SMS. The pass is still valid — use Share Pass.',
    };
  }

  let sid = 'unknown';

  try {
    const payload = JSON.parse(responseText) as { sid?: string };
    sid = payload.sid ?? sid;
  } catch {
    console.warn('[send-pass-sms] Twilio success response was not JSON:', responseText);
  }

  console.log('[send-pass-sms] checkpoint: twilio_response_sid', { sid, to });
  return { ok: true, sid };
}

Deno.serve(async (req) => {
  try {
    console.log('[send-pass-sms] checkpoint: function_invoked', { method: req.method });

    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    if (req.method !== 'POST') {
      return errorResponse(405, 'Method not allowed.', 'METHOD_NOT_ALLOWED');
    }

    const authHeader = req.headers.get('Authorization');
    console.log('[send-pass-sms] checkpoint: auth_header', { present: Boolean(authHeader) });

    if (!authHeader) {
      return errorResponse(401, 'Authentication required.', 'AUTH_HEADER_MISSING');
    }

    let body: RequestBody;

    try {
      body = (await req.json()) as RequestBody;
      console.log('[send-pass-sms] checkpoint: request_body_parsed');
    } catch (error) {
      console.error('[send-pass-sms] checkpoint: request_body_parse_error', error);
      return errorResponse(400, 'Invalid request body.', 'REQUEST_BODY_INVALID');
    }

    const passId = body.pass_id?.trim();
    const eventName = body.event_name?.trim();
    const passUrl = body.pass_url?.trim();
    const phoneInput = body.phone?.trim();

    if (!passId || !eventName || !passUrl || !phoneInput) {
      return errorResponse(
        400,
        'pass_id, event_name, pass_url, and phone are required.',
        'REQUEST_FIELDS_MISSING',
      );
    }

    const phone = validatePhone(phoneInput);

    if (!phone) {
      return errorResponse(400, 'Invalid phone number.', 'PHONE_INVALID');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseAnonKey) {
      return errorResponse(500, 'Server configuration error.', 'SUPABASE_CONFIG_MISSING');
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      console.error('[send-pass-sms] checkpoint: jwt_user_error', {
        message: userError?.message ?? 'No user resolved',
      });
      return errorResponse(401, 'Authentication failed.', 'JWT_USER_RESOLVE_FAILED');
    }
    console.log('[send-pass-sms] checkpoint: jwt_user_resolved', { userId: userData.user.id });

    console.log('[send-pass-sms] checkpoint: pass_lookup_started', { passId });
    const { data: pass, error: passError } = await supabase
      .from('passes')
      .select('id, guest_phone, event_id')
      .eq('id', passId)
      .maybeSingle();

    if (passError || !pass) {
      console.error('[send-pass-sms] checkpoint: pass_lookup_error', {
        message: passError?.message ?? 'Pass missing',
      });
      return errorResponse(403, 'Pass not found or access denied.', 'PASS_LOOKUP_FAILED');
    }
    console.log('[send-pass-sms] checkpoint: pass_lookup_result', { found: true, passId: pass.id });

    const smsBody = buildSmsBody(eventName, passUrl);
    const twilioConfigured = isTwilioConfigured();
    console.log('[send-pass-sms] checkpoint: twilio_configured', { configured: twilioConfigured });

    if (!twilioConfigured) {
      console.log('[send-pass-sms] preview mode', { to: phone, body: smsBody });
      return jsonResponse({
        ok: true,
        mode: 'preview',
        message: 'Preview logged — SMS not configured.',
        preview: smsBody,
      });
    }

    console.log('[send-pass-sms] checkpoint: twilio_request_started', { to: phone });
    const sendResult = await sendTwilioSms(phone, smsBody);

    if (!sendResult.ok) {
      return errorResponse(502, sendResult.safeMessage, 'TWILIO_SEND_FAILED');
    }

    return jsonResponse({
      ok: true,
      mode: 'sent',
      message: 'SMS sent.',
    });
  } catch (error) {
    console.error('[send-pass-sms] checkpoint: unhandled_exception', error);
    return errorResponse(500, 'Unexpected SMS service error.', 'UNHANDLED_EXCEPTION');
  }
});
