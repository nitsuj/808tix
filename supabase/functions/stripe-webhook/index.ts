import {
  fetchStripeChargeId,
  readPaymentIntentId,
  verifyStripeWebhookSignature,
  type StripeWebhookEvent,
} from '../_shared/stripe.ts';
import { createServiceClient } from '../_shared/supabase-service.ts';

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function readMetadataString(metadata: unknown, key: string): string | null {
  if (!metadata || typeof metadata !== 'object') {
    return null;
  }

  const value = (metadata as Record<string, unknown>)[key];
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  return value.trim();
}

async function claimWebhookEvent(
  stripeEventId: string,
  type: string,
  payload: Record<string, unknown>,
  orderId: string | null,
): Promise<'new' | 'duplicate_processed' | 'retry'> {
  const supabase = createServiceClient();

  const { error } = await supabase.from('payment_events').insert({
    stripe_event_id: stripeEventId,
    type,
    payload,
    order_id: orderId,
    processing_status: 'received',
  });

  if (error?.code === '23505') {
    const { data: existing, error: lookupError } = await supabase
      .from('payment_events')
      .select('processing_status')
      .eq('stripe_event_id', stripeEventId)
      .maybeSingle();

    if (lookupError || !existing) {
      throw new Error(`payment_events duplicate lookup failed: ${lookupError?.message ?? 'missing row'}`);
    }

    if (existing.processing_status === 'processed') {
      return 'duplicate_processed';
    }

    return 'retry';
  }

  if (error) {
    throw new Error(`payment_events insert failed: ${error.message}`);
  }

  return 'new';
}

async function markWebhookProcessed(stripeEventId: string): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from('payment_events')
    .update({
      processing_status: 'processed',
      processed_at: new Date().toISOString(),
      error: null,
    })
    .eq('stripe_event_id', stripeEventId);

  if (error) {
    throw new Error(`payment_events processed update failed: ${error.message}`);
  }
}

async function markWebhookFailed(stripeEventId: string, errorMessage: string): Promise<void> {
  const supabase = createServiceClient();
  await supabase
    .from('payment_events')
    .update({
      processing_status: 'failed',
      processed_at: new Date().toISOString(),
      error: errorMessage.slice(0, 2000),
    })
    .eq('stripe_event_id', stripeEventId);
}

async function handleCheckoutSessionCompleted(
  session: Record<string, unknown>,
  stripeSecretKey: string,
): Promise<void> {
  const paymentStatus = typeof session.payment_status === 'string' ? session.payment_status : '';

  if (paymentStatus !== 'paid') {
    throw new Error(`checkout.session.completed ignored: payment_status=${paymentStatus}`);
  }

  const orderId = readMetadataString(session.metadata, 'order_id');
  if (!orderId) {
    throw new Error('checkout.session.completed missing metadata.order_id');
  }

  const amountTotal = typeof session.amount_total === 'number' ? session.amount_total : null;
  const currency = typeof session.currency === 'string' ? session.currency : null;
  const sessionId = typeof session.id === 'string' ? session.id : null;

  if (amountTotal === null || !currency || !sessionId) {
    throw new Error('checkout.session.completed missing amount_total, currency, or id');
  }

  const paymentIntentId = readPaymentIntentId(session.payment_intent);
  let chargeId: string | null = null;

  if (paymentIntentId) {
    chargeId = await fetchStripeChargeId(stripeSecretKey, paymentIntentId);
  }

  const supabase = createServiceClient();
  const { error } = await supabase.rpc('fulfill_paid_order', {
    p_order_id: orderId,
    p_amount_cents: amountTotal,
    p_currency: currency,
    p_stripe_checkout_session_id: sessionId,
    p_stripe_payment_intent_id: paymentIntentId,
    p_stripe_charge_id: chargeId,
    p_processor_fee_cents: null,
    p_net_cents: null,
  });

  if (error) {
    throw new Error(`fulfill_paid_order failed: ${error.message}`);
  }
}

async function handleCheckoutSessionExpired(session: Record<string, unknown>): Promise<void> {
  const orderId = readMetadataString(session.metadata, 'order_id');
  if (!orderId) {
    return;
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from('orders')
    .update({
      status: 'expired',
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId)
    .in('status', ['pending', 'checkout_open']);

  if (error) {
    throw new Error(`order expire update failed: ${error.message}`);
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, message: 'Method not allowed.' }, 405);
  }

  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')?.trim();
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')?.trim();

  if (!stripeSecretKey || !webhookSecret) {
    return jsonResponse({ ok: false, message: 'Stripe webhook is not configured.' }, 500);
  }

  const signatureHeader = req.headers.get('Stripe-Signature');
  if (!signatureHeader) {
    return jsonResponse({ ok: false, message: 'Missing Stripe-Signature header.' }, 400);
  }

  const rawBody = await req.text();
  const signatureValid = await verifyStripeWebhookSignature(rawBody, signatureHeader, webhookSecret);

  if (!signatureValid) {
    return jsonResponse({ ok: false, message: 'Invalid Stripe signature.' }, 400);
  }

  let event: StripeWebhookEvent;
  try {
    event = JSON.parse(rawBody) as StripeWebhookEvent;
  } catch {
    return jsonResponse({ ok: false, message: 'Invalid webhook JSON.' }, 400);
  }

  const sessionObject = event.data?.object ?? {};
  const orderId = readMetadataString(sessionObject.metadata, 'order_id');

  let claimState: 'new' | 'duplicate_processed' | 'retry';
  try {
    claimState = await claimWebhookEvent(event.id, event.type, event as unknown as Record<string, unknown>, orderId);
  } catch (error) {
    console.error('[stripe-webhook] payment_events claim failed', error);
    return jsonResponse({ ok: false, message: 'Could not record webhook event.' }, 500);
  }

  if (claimState === 'duplicate_processed') {
    return jsonResponse({ ok: true, duplicate: true });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      await handleCheckoutSessionCompleted(sessionObject, stripeSecretKey);
    } else if (event.type === 'checkout.session.expired') {
      await handleCheckoutSessionExpired(sessionObject);
    }

    await markWebhookProcessed(event.id);
    return jsonResponse({ ok: true, type: event.type });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook processing failed';
    console.error('[stripe-webhook] processing failed', { type: event.type, message });
    await markWebhookFailed(event.id, message);
    return jsonResponse({ ok: false, message: 'Webhook processing failed.' }, 500);
  }
});
