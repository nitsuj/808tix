import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

import {
  buildPassLinkUrl,
  buildPurchaseSuccessUrl,
  isPreviewDeliveryMode,
  resolvePublicSiteUrl,
} from './pass-link-server.ts';

export const ORDER_CONFIRMATION_MESSAGE_TYPE = 'order_confirmation';

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

type OutboundMessageRow = {
  id: string;
  status: string;
  attempt_count: number;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

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

  const ticketLines = input.tickets.map((ticket, index) => {
    const ticketNumber = index + 1;
    const passType = ticket.pass_type?.trim() || 'General Admission';
    const passUrl = buildPassLinkUrl(ticket.secure_token, siteOrigin);

    return {
      ticketNumber,
      passType,
      passUrl,
      text: `Ticket ${ticketNumber} of ${ticketTotal} — ${passType}\nView ticket: ${passUrl}`,
      html: `<li><strong>Ticket ${ticketNumber} of ${ticketTotal}</strong> — ${escapeHtml(passType)}<br><a href="${escapeHtml(passUrl)}">View ticket</a></li>`,
    };
  });

  const subject = `Your tickets for ${eventName}`;

  const textParts = [
    `Hi ${buyerName},`,
    '',
    `You're all set for ${eventName}.`,
  ];

  if (dateLine) {
    textParts.push(dateLine);
  }

  if (venueLine) {
    textParts.push(venueLine);
  }

  textParts.push(
    '',
    `You have ${ticketTotal} ticket${ticketTotal === 1 ? '' : 's'}.`,
    '',
    ...ticketLines.map((line) => line.text),
    '',
    'On iPhone, open a ticket link and tap Add to Apple Wallet.',
    '',
    `View all tickets: ${successUrl}`,
    '',
    'Transactional email from 808Tickets.',
  );

  const htmlParts = [
    `<p>Hi ${escapeHtml(buyerName)},</p>`,
    `<p>You're all set for <strong>${escapeHtml(eventName)}</strong>.</p>`,
  ];

  if (dateLine) {
    htmlParts.push(`<p>${escapeHtml(dateLine)}</p>`);
  }

  if (venueLine) {
    htmlParts.push(`<p>${escapeHtml(venueLine)}</p>`);
  }

  htmlParts.push(
    `<p>You have <strong>${ticketTotal}</strong> ticket${ticketTotal === 1 ? '' : 's'}.</p>`,
    `<ul>${ticketLines.map((line) => line.html).join('')}</ul>`,
    '<p>On iPhone, open a ticket link and tap <strong>Add to Apple Wallet</strong>.</p>',
    `<p><a href="${escapeHtml(successUrl)}">View all tickets</a></p>`,
    '<p style="color:#666;font-size:12px;">Transactional email from 808Tickets.</p>',
  );

  return {
    to: input.buyer_email.trim(),
    subject,
    html: htmlParts.join('\n'),
    text: textParts.join('\n'),
    payload_snapshot: {
      message_type: ORDER_CONFIRMATION_MESSAGE_TYPE,
      event_name: eventName,
      pass_count: ticketTotal,
      buyer_email: input.buyer_email.trim(),
      venue_name: venueLine,
      event_date: input.event_date,
      start_time: input.start_time,
      success_url: successUrl,
    },
  };
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
    });

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
