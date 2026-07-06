import { normalizePhoneNumber } from '@/lib/phone-validation';
import { supabase } from '@/lib/supabase';

export type SendPassSmsInput = {
  passId: string;
  eventName: string;
  passUrl: string;
  phone: string;
};

export type SendPassSmsResult =
  | { ok: true; mode: 'sent'; message: string }
  | { ok: true; mode: 'preview'; message: string; preview: string }
  | { ok: false; error: string };

type SendPassSmsResponse = {
  ok?: boolean;
  mode?: 'sent' | 'preview';
  message?: string;
  preview?: string;
  error?: string;
};

const SMS_FUNCTION_NAME = 'send-pass-sms';

export async function sendPassSms(input: SendPassSmsInput): Promise<SendPassSmsResult> {
  const phone = normalizePhoneNumber(input.phone);

  if (!phone) {
    return { ok: false, error: 'A valid guest phone number is required to send SMS.' };
  }

  const invokeResult = await supabase.functions.invoke<SendPassSmsResponse>(SMS_FUNCTION_NAME, {
    body: {
      pass_id: input.passId,
      event_name: input.eventName,
      pass_url: input.passUrl,
      phone,
    },
  });

  const { data, error } = invokeResult;

  if (error) {
    return { ok: false, error: error.message || 'Could not send SMS.' };
  }

  if (!data) {
    return { ok: false, error: 'No response from SMS service.' };
  }

  if (data.ok === false || data.error) {
    return { ok: false, error: data.error ?? 'Could not send SMS.' };
  }

  if (data.mode === 'preview') {
    return {
      ok: true,
      mode: 'preview',
      message: data.message ?? 'SMS provider not configured.',
      preview: data.preview ?? '',
    };
  }

  return {
    ok: true,
    mode: 'sent',
    message: data.message ?? 'Pass link sent by SMS.',
  };
}
