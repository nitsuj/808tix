import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

import {
  buildPassLinkUrl,
  buildPurchaseSuccessUrl,
  isPreviewDeliveryMode,
  resolvePublicSiteUrl,
} from './pass-link-server.ts';
import {
  OPEN_TICKETS_CTA_LABEL,
  PROCESSING_FEE_LABEL,
  SERVICE_FEE_LABEL,
  renderOrderConfirmationHtml,
  renderOrderConfirmationText,
  type OrderEmailFeeBreakdown,
} from './order-email-template.ts';

export const ORDER_CONFIRMATION_MESSAGE_TYPE = 'order_confirmation';
export { OPEN_TICKETS_CTA_LABEL, PROCESSING_FEE_LABEL, SERVICE_FEE_LABEL };

export type OrderConfirmationTicket = {
  sequence: number;
  pass_type: string;
  guest_name: string;
  secure_token: string;
};

export type BuildOrderConfirmationEmailInput = {
  order_id: string;
  public_access_token: string;
  buyer_email: string;
  buyer_name: string | null;
  event_name: string;
  venue_name: string | null;
  event_date: string | null;
  start_time: string | null;
  tickets: OrderConfirmationTicket[];
  site_origin?: string;
  currency?: string | null;
  subtotal_cents?: number | null;
  platform_fee_cents?: number | null;
  processing_fee_cents?: number | null;
  total_cents?: number | null;
};

export type BuiltOrderConfirmationEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  payload_snapshot: Record<string, unknown>;
};

export type ClaimOutboundMessageResult =
  | { action: 'created'; id: string; attempt_count: number }
  | { action: 'retry'; id: string; attempt_count: number }
  | { action: 'already_sent'; id: string; status: string };

export type SendOrderConfirmationEmailResult =
  | {
      ok: true;
      mode: 'preview' | 'sent';
      already_sent: boolean;
      outbound_message_id: string;
      provider: string;
      outbound_message_status: string;
      recipient: string;
      pass_count: number;
    }
  | {
      ok: false;
      error: string;
      outbound_message_id?: string;
      outbound_message_status?: string;
    };

function formatEventDateLine(eventDate: string | null, startTime: string | null): string | null {
  const dateTrimmed = eventDate?.trim();

  if (!dateTrimmed) {
    return null;
  }

  const timeTrimmed = startTime?.trim() ?? '';
  let normalizedTime = '';

  if (/^\d{2}:\d{2}$/.test(timeTrimmed)) {
    normalizedTime = `${timeTrimmed}:00`;
  } else if (/^\d{2}:\d{2}:\d{2}$/.test(timeTrimmed)) {
    normalizedTime = timeTrimmed;
  }

  const dateTimeSource = normalizedTime ? `${dateTrimmed}T${normalizedTime}` : dateTrimmed;

  const parsed = new Date(dateTimeSource);

  if (Number.isNaN(parsed.getTime())) {
    return dateTrimmed;
  }

  const formatted = parsed.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: normalizedTime ? 'numeric' : undefined,
    minute: normalizedTime ? '2-digit' : undefined,
  });

  return formatted.toUpperCase();
}

export function buildOrderConfirmationIdempotencyKey(orderId: string): string {
  return `order_confirmation:${orderId.trim()}`;
}

export function buildOrderConfirmationEmail(
  input: BuildOrderConfirmationEmailInput,
): BuiltOrderConfirmationEmail {
  const siteOrigin = input.site_origin ?? resolvePublicSiteUrl();
  const buyerName = input.buyer_name?.trim() || 'there';
  const eventName = input.event_name.trim() || 'your event';
  const ticketTotal = input.tickets.length;
  const dateLine = formatEventDateLine(input.event_date, input.start_time);
  const venueLine = input.venue_name?.trim() ?? null;
  const successUrl = buildPurchaseSuccessUrl(input.public_access_token, siteOrigin);
  const currency = (input.currency?.trim() || 'usd').toLowerCase();
  const hasFeeBreakdown =
    typeof input.subtotal_cents === 'number' &&
    typeof input.platform_fee_cents === 'number' &&
    typeof input.processing_fee_cents === 'number' &&
    typeof input.total_cents === 'number';

  const fees: OrderEmailFeeBreakdown | null = hasFeeBreakdown
    ? {
        currency,
        subtotal_cents: input.subtotal_cents!,
        platform_fee_cents: input.platform_fee_cents!,
        processing_fee_cents: input.processing_fee_cents!,
        total_cents: input.total_cents!,
      }
    : null;

  const tickets = input.tickets.map((ticket, index) => {
    const ticketNumber = index + 1;
    const passType = ticket.pass_type?.trim() || 'General Admission';
    const passUrl = buildPassLinkUrl(ticket.secure_token, siteOrigin);

    return {
      ticketNumber,
      ticketTotal,
      passType,
      passUrl,
    };
  });

  const templateInput = {
    buyerName,
    eventName,
    dateLine,
    venueLine,
    ticketTotal,
    tickets,
    successUrl,
    fees,
  };

  const subject = `Your tickets for ${eventName}`;
  const html = renderOrderConfirmationHtml(templateInput);
  const text = renderOrderConfirmationText(templateInput);

  assertOrderConfirmationBodies({ html, text, siteOrigin });

  return {
    to: input.buyer_email.trim(),
    subject,
    html,
    text,
    payload_snapshot: {
      message_type: ORDER_CONFIRMATION_MESSAGE_TYPE,
      content_format: 'html+text',
      has_html_body: true,
      has_text_body: true,
      has_open_tickets_cta: true,
      html_bytes: html.length,
      text_bytes: text.length,
      primary_cta_label: OPEN_TICKETS_CTA_LABEL,
      site_origin: siteOrigin,
      event_name: eventName,
      pass_count: ticketTotal,
      buyer_email: input.buyer_email.trim(),
      venue_name: venueLine,
      event_date: input.event_date,
      start_time: input.start_time,
      currency,
      subtotal_cents: input.subtotal_cents ?? null,
      platform_fee_cents: input.platform_fee_cents ?? null,
      processing_fee_cents: input.processing_fee_cents ?? null,
      total_cents: input.total_cents ?? null,
      service_fee_label: SERVICE_FEE_LABEL,
      processing_fee_label: PROCESSING_FEE_LABEL,
      // Tokenized URLs intentionally omitted from snapshot.
    },
  };
}

/**
 * Fail loudly if HTML generation produced a text-only / incomplete body.
 * Hosted send must never silently fall back to plain text.
 */
export function assertOrderConfirmationBodies(params: {
  html: string;
  text: string;
  siteOrigin?: string;
}): void {
  const html = params.html?.trim() ?? '';
  const text = params.text?.trim() ?? '';

  if (!html || html.length < 200) {
    throw new Error('Order confirmation HTML body is missing or too short.');
  }
  if (!text || text.length < 40) {
    throw new Error('Order confirmation plain-text body is missing or too short.');
  }
  if (!html.includes('<!DOCTYPE html>') && !html.toLowerCase().includes('<html')) {
    throw new Error('Order confirmation HTML body is not a full HTML document.');
  }
  if (!html.includes('808Tickets')) {
    throw new Error('Order confirmation HTML missing 808Tickets brand header.');
  }
  if (!html.includes(OPEN_TICKETS_CTA_LABEL) || !text.includes(OPEN_TICKETS_CTA_LABEL)) {
    throw new Error(`Order confirmation missing "${OPEN_TICKETS_CTA_LABEL}" CTA.`);
  }
  // When fee summary is rendered, both bodies must keep transparent labels.
  if (html.includes('Order summary') || text.includes('Order summary')) {
    if (!html.includes(SERVICE_FEE_LABEL) || !text.includes(SERVICE_FEE_LABEL)) {
      throw new Error(`Order confirmation missing "${SERVICE_FEE_LABEL}" label.`);
    }
    if (!html.includes(PROCESSING_FEE_LABEL) || !text.includes(PROCESSING_FEE_LABEL)) {
      throw new Error(`Order confirmation missing "${PROCESSING_FEE_LABEL}" label.`);
    }
  }
  if (params.siteOrigin && !html.includes(params.siteOrigin.replace(/\/+$/, ''))) {
    throw new Error('Order confirmation HTML links do not use configured PUBLIC_SITE_URL origin.');
  }
}


export function resolveOutboundRecipient(buyerEmail: string): {
  recipient: string;
  original_buyer_email: string;
} {
  const original = buyerEmail.trim();
  const override = Deno.env.get('EMAIL_OVERRIDE_TO')?.trim();

  return {
    recipient: override || original,
    original_buyer_email: original,
  };
}

export async function claimOutboundMessage(
  supabase: SupabaseClient,
  params: {
    order_id: string;
    recipient: string;
    idempotency_key: string;
    payload_snapshot: Record<string, unknown>;
  },
): Promise<ClaimOutboundMessageResult> {
  const { data: inserted, error: insertError } = await supabase
    .from('outbound_messages')
    .insert({
      order_id: params.order_id,
      recipient: params.recipient,
      channel: 'email',
      message_type: ORDER_CONFIRMATION_MESSAGE_TYPE,
      status: 'pending',
      idempotency_key: params.idempotency_key,
      payload_snapshot: params.payload_snapshot,
      attempt_count: 1,
    })
    .select('id, status, attempt_count')
    .maybeSingle();

  if (!insertError && inserted) {
    return {
      action: 'created',
      id: inserted.id,
      attempt_count: inserted.attempt_count,
    };
  }

  if (insertError?.code !== '23505') {
    throw new Error(`outbound_messages claim insert failed: ${insertError?.message ?? 'unknown'}`);
  }

  const { data: existing, error: lookupError } = await supabase
    .from('outbound_messages')
    .select('id, status, attempt_count')
    .eq('idempotency_key', params.idempotency_key)
    .maybeSingle();

  if (lookupError || !existing) {
    throw new Error(
      `outbound_messages duplicate lookup failed: ${lookupError?.message ?? 'missing row'}`,
    );
  }

  if (existing.status === 'sent' || existing.status === 'skipped') {
    return {
      action: 'already_sent',
      id: existing.id,
      status: existing.status,
    };
  }

  const nextAttempt = (existing.attempt_count ?? 0) + 1;

  const { data: updated, error: updateError } = await supabase
    .from('outbound_messages')
    .update({
      status: 'pending',
      recipient: params.recipient,
      payload_snapshot: params.payload_snapshot,
      attempt_count: nextAttempt,
      error: null,
    })
    .eq('id', existing.id)
    .in('status', ['pending', 'failed'])
    .select('id, status, attempt_count')
    .maybeSingle();

  if (updateError || !updated) {
    const { data: current } = await supabase
      .from('outbound_messages')
      .select('id, status, attempt_count')
      .eq('id', existing.id)
      .maybeSingle();

    if (current && (current.status === 'sent' || current.status === 'skipped')) {
      return {
        action: 'already_sent',
        id: current.id,
        status: current.status,
      };
    }

    throw new Error(
      `outbound_messages retry claim failed: ${updateError?.message ?? 'row not retryable'}`,
    );
  }

  return {
    action: 'retry',
    id: updated.id,
    attempt_count: updated.attempt_count,
  };
}

export async function markOutboundMessageSent(
  supabase: SupabaseClient,
  outboundMessageId: string,
  params: {
    provider: string;
    provider_message_id?: string | null;
  },
): Promise<void> {
  const { error } = await supabase
    .from('outbound_messages')
    .update({
      status: 'sent',
      provider: params.provider,
      provider_message_id: params.provider_message_id ?? null,
      error: null,
      sent_at: new Date().toISOString(),
    })
    .eq('id', outboundMessageId);

  if (error) {
    throw new Error(`outbound_messages sent update failed: ${error.message}`);
  }
}

export async function markOutboundMessageFailed(
  supabase: SupabaseClient,
  outboundMessageId: string,
  errorMessage: string,
): Promise<void> {
  const { error } = await supabase
    .from('outbound_messages')
    .update({
      status: 'failed',
      error: errorMessage.slice(0, 2000),
    })
    .eq('id', outboundMessageId);

  if (error) {
    throw new Error(`outbound_messages failed update failed: ${error.message}`);
  }
}

type ResendSendResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function sendEmailWithResend(params: {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<ResendSendResult> {
  const apiKey = Deno.env.get('RESEND_API_KEY')?.trim();

  if (!apiKey) {
    return { ok: false, error: 'RESEND_API_KEY is not configured.' };
  }

  try {
    assertOrderConfirmationBodies({ html: params.html, text: params.text });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[order-email] refusing text-only / invalid Resend payload', { message });
    return { ok: false, error: message };
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: params.from,
      to: [params.to],
      subject: params.subject,
      html: params.html,
      text: params.text,
    }),
  });

  const responseText = await response.text();
  let payload: { id?: string; message?: string } = {};

  try {
    payload = responseText ? (JSON.parse(responseText) as { id?: string; message?: string }) : {};
  } catch {
    payload = {};
  }

  if (!response.ok) {
    const message = payload.message ?? `Resend API error (${response.status})`;
    return { ok: false, error: message };
  }

  if (!payload.id) {
    return { ok: false, error: 'Resend API response missing message id.' };
  }

  return { ok: true, id: payload.id };
}

export async function sendOrderConfirmationEmail(
  supabase: SupabaseClient,
  input: BuildOrderConfirmationEmailInput,
): Promise<SendOrderConfirmationEmailResult> {
  const idempotencyKey = buildOrderConfirmationIdempotencyKey(input.order_id);
  const built = buildOrderConfirmationEmail(input);
  const { recipient, original_buyer_email } = resolveOutboundRecipient(built.to);

  const payloadSnapshot = {
    ...built.payload_snapshot,
    original_buyer_email,
    delivery_recipient: recipient,
  };

  const claim = await claimOutboundMessage(supabase, {
    order_id: input.order_id,
    recipient,
    idempotency_key: idempotencyKey,
    payload_snapshot: payloadSnapshot,
  });

  if (claim.action === 'already_sent') {
    return {
      ok: true,
      mode: 'preview',
      already_sent: true,
      outbound_message_id: claim.id,
      provider: 'idempotent',
      outbound_message_status: claim.status,
      recipient,
      pass_count: input.tickets.length,
    };
  }

  const previewMode = isPreviewDeliveryMode();

  if (previewMode) {
    console.log('[order-email] preview mode', {
      order_id: input.order_id,
      recipient,
      pass_count: input.tickets.length,
      subject: built.subject,
      content_format: 'html+text',
      html_bytes: built.html.length,
      text_bytes: built.text.length,
      primary_cta_label: OPEN_TICKETS_CTA_LABEL,
    });

    const artifactDir = Deno.env.get('EMAIL_PREVIEW_ARTIFACT_DIR')?.trim();
    if (artifactDir) {
      try {
        await Deno.mkdir(artifactDir, { recursive: true });
        await Deno.writeTextFile(`${artifactDir.replace(/\/+$/, '')}/latest.html`, built.html);
        await Deno.writeTextFile(`${artifactDir.replace(/\/+$/, '')}/latest.txt`, built.text);
        console.log('[order-email] wrote preview artifacts', { dir: artifactDir });
      } catch (artifactError) {
        console.warn('[order-email] preview artifact write failed', String(artifactError));
      }
    }

    await markOutboundMessageSent(supabase, claim.id, {
      provider: 'preview',
      provider_message_id: null,
    });

    return {
      ok: true,
      mode: 'preview',
      already_sent: false,
      outbound_message_id: claim.id,
      provider: 'preview',
      outbound_message_status: 'sent',
      recipient,
      pass_count: input.tickets.length,
    };
  }

  const from = Deno.env.get('EMAIL_FROM')?.trim();

  if (!from) {
    await markOutboundMessageFailed(supabase, claim.id, 'EMAIL_FROM is not configured.');
    return { ok: false, error: 'EMAIL_FROM is not configured.', outbound_message_id: claim.id };
  }

  const sendResult = await sendEmailWithResend({
    from,
    to: recipient,
    subject: built.subject,
    html: built.html,
    text: built.text,
  });

  if (!sendResult.ok) {
    await markOutboundMessageFailed(supabase, claim.id, sendResult.error);
    return {
      ok: false,
      error: sendResult.error,
      outbound_message_id: claim.id,
      outbound_message_status: 'failed',
    };
  }

  await markOutboundMessageSent(supabase, claim.id, {
    provider: 'resend',
    provider_message_id: sendResult.id,
  });

  return {
    ok: true,
    mode: 'sent',
    already_sent: false,
    outbound_message_id: claim.id,
    provider: 'resend',
    outbound_message_status: 'sent',
    recipient,
    pass_count: input.tickets.length,
  };
}

export function maskRecipientEmail(email: string): string {
  const trimmed = email.trim();
  const atIndex = trimmed.indexOf('@');

  if (atIndex <= 1) {
    return '***';
  }

  return `${trimmed.slice(0, 1)}***${trimmed.slice(atIndex)}`;
}
