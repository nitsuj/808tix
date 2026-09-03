import { createStripeCheckoutSession } from '../_shared/stripe.ts';
import {
  buildPurchaseSuccessUrl,
  normalizePublicSiteUrl,
} from '../_shared/pass-link-server.ts';
import { createServiceClient } from '../_shared/supabase-service.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_CHECKOUT_QUANTITY = 10;

type RequestBody = {
  event_id?: string;
  ticket_type_id?: string;
  quantity?: number;
  buyer_email?: string;
  buyer_name?: string | null;
  buyer_phone?: string | null;
  /** Ignored for redirect building — kept only for backward-compatible request bodies. */
  success_url?: string;
  /** Ignored for redirect building — kept only for backward-compatible request bodies. */
  cancel_url?: string;
};

type PendingOrderResult = {
  order_id: string;
  public_access_token: string;
  status: string;
  subtotal_cents: number;
  platform_fee_cents: number;
  processing_fee_cents: number;
  total_cents: number;
  organizer_net_cents: number;
  currency: string;
  reserved_until: string;
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function errorResponse(status: number, message: string, code: string): Response {
  return jsonResponse({ ok: false, message, code }, status);
}

function parsePositiveInt(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    return null;
  }
  return value;
}

function isLocalHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

function isAllowedCheckoutOrigin(origin: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }

  const host = parsed.hostname.toLowerCase();
  if (host === '808tickets.com' || host === 'www.808tickets.com') {
    return parsed.protocol === 'https:';
  }

  if (isLocalHostname(host)) {
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  }

  return false;
}

/**
 * Server-controlled checkout redirect origin.
 * Priority:
 * 1) Allowlisted local PUBLIC_SITE_URL (local smoke / local Expo)
 * 2) Local Supabase → http://127.0.0.1:8081
 * 3) Allowlisted hosted PUBLIC_SITE_URL
 * 4) https://808tickets.com
 */
function resolveCheckoutSiteOrigin(): string {
  const configured = normalizePublicSiteUrl(Deno.env.get('PUBLIC_SITE_URL'));
  if (configured) {
    try {
      const parsed = new URL(configured);
      if (isAllowedCheckoutOrigin(configured) && isLocalHostname(parsed.hostname)) {
        return configured;
      }
    } catch {
      // continue
    }
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim() ?? '';
  let supabaseLocal = false;
  try {
    supabaseLocal = isLocalHostname(new URL(supabaseUrl).hostname);
  } catch {
    supabaseLocal = false;
  }

  if (supabaseLocal) {
    return 'http://127.0.0.1:8081';
  }

  if (configured && isAllowedCheckoutOrigin(configured)) {
    try {
      const parsed = new URL(configured);
      if (parsed.hostname.toLowerCase() === 'www.808tickets.com') {
        return 'https://808tickets.com';
      }
    } catch {
      // fall through
    }
    return configured;
  }

  return 'https://808tickets.com';
}

function buildCheckoutCancelUrl(siteOrigin: string, eventId: string): string {
  const url = new URL(`/events/${encodeURIComponent(eventId)}/buy`, `${siteOrigin}/`);
  return url.toString();
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    if (req.method !== 'POST') {
      return errorResponse(405, 'Method not allowed.', 'METHOD_NOT_ALLOWED');
    }

    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')?.trim();
    if (!stripeSecretKey) {
      return errorResponse(500, 'Stripe is not configured.', 'STRIPE_CONFIG_MISSING');
    }

    let body: RequestBody;
    try {
      body = (await req.json()) as RequestBody;
    } catch {
      return errorResponse(400, 'Invalid request body.', 'REQUEST_BODY_INVALID');
    }

    const eventId = body.event_id?.trim();
    const ticketTypeId = body.ticket_type_id?.trim();
    const buyerEmail = body.buyer_email?.trim();
    const buyerName = body.buyer_name?.trim() || null;
    const buyerPhone = body.buyer_phone?.trim() || null;
    const quantity = parsePositiveInt(body.quantity);

    if (!eventId || !ticketTypeId || !buyerEmail || !quantity) {
      return errorResponse(
        400,
        'event_id, ticket_type_id, quantity, and buyer_email are required.',
        'REQUEST_FIELDS_MISSING',
      );
    }

    if (quantity > MAX_CHECKOUT_QUANTITY) {
      return errorResponse(
        400,
        `quantity cannot exceed ${MAX_CHECKOUT_QUANTITY}.`,
        'QUANTITY_TOO_LARGE',
      );
    }

    // Client-supplied success/cancel URLs are ignored (open-redirect hardening).
    const siteOrigin = resolveCheckoutSiteOrigin();
    if (!isAllowedCheckoutOrigin(siteOrigin)) {
      return errorResponse(500, 'Checkout redirect origin is not allowed.', 'REDIRECT_ORIGIN_INVALID');
    }

    const supabase = createServiceClient();

    const { data: pendingOrder, error: pendingOrderError } = await supabase.rpc(
      'create_pending_order',
      {
        p_event_id: eventId,
        p_buyer_email: buyerEmail,
        p_ticket_type_id: ticketTypeId,
        p_quantity: quantity,
        p_buyer_name: buyerName,
        p_buyer_phone: buyerPhone,
      },
    );

    if (pendingOrderError || !pendingOrder) {
      console.error('[create-checkout-session] create_pending_order failed', pendingOrderError);
      const message = pendingOrderError?.message ?? 'Could not create pending order.';
      return errorResponse(400, message, 'CREATE_PENDING_ORDER_FAILED');
    }

    const order = pendingOrder as PendingOrderResult;
    const orderId = order.order_id;
    const publicAccessToken = order.public_access_token;

    const { data: orderItem, error: orderItemError } = await supabase
      .from('order_items')
      .select('pass_type_label, unit_price_cents, quantity')
      .eq('order_id', orderId)
      .maybeSingle();

    if (orderItemError || !orderItem) {
      console.error('[create-checkout-session] order_items lookup failed', orderItemError);
      return errorResponse(500, 'Order line item missing after reservation.', 'ORDER_ITEM_MISSING');
    }

    const reservedUntilMs = Date.parse(order.reserved_until);
    const expiresAtUnix = Number.isFinite(reservedUntilMs)
      ? Math.floor(reservedUntilMs / 1000)
      : undefined;

    const successUrl = buildPurchaseSuccessUrl(publicAccessToken, siteOrigin);
    const cancelUrl = buildCheckoutCancelUrl(siteOrigin, eventId);

    let checkoutSession;
    try {
      checkoutSession = await createStripeCheckoutSession({
        secretKey: stripeSecretKey,
        currency: order.currency,
        ticketName: orderItem.pass_type_label,
        ticketUnitAmountCents: orderItem.unit_price_cents,
        ticketQuantity: orderItem.quantity,
        platformFeeCents: order.platform_fee_cents,
        processingFeeCents: order.processing_fee_cents ?? 0,
        customerEmail: buyerEmail,
        successUrl,
        cancelUrl,
        metadata: {
          order_id: orderId,
          event_id: eventId,
          ticket_type_id: ticketTypeId,
          quantity: String(quantity),
        },
        expiresAtUnix,
      });
    } catch (error) {
      console.error('[create-checkout-session] Stripe session creation failed', error);
      return errorResponse(
        502,
        'Could not start checkout. Your reservation will expire automatically.',
        'STRIPE_CHECKOUT_FAILED',
      );
    }

    const { error: orderUpdateError } = await supabase
      .from('orders')
      .update({
        status: 'checkout_open',
        stripe_checkout_session_id: checkoutSession.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .eq('status', 'pending');

    if (orderUpdateError) {
      console.error('[create-checkout-session] order update failed', orderUpdateError);
      return errorResponse(500, 'Checkout started but order could not be updated.', 'ORDER_UPDATE_FAILED');
    }

    // Do not return order_public_access_token / public_access_token pre-payment.
    // Buyer receives order_token only via Stripe redirect to our allowlisted success URL.
    return jsonResponse({
      ok: true,
      checkout_url: checkoutSession.url,
      checkout_session_id: checkoutSession.id,
      status: 'checkout_open',
    });
  } catch (error) {
    console.error('[create-checkout-session] unhandled exception', error);
    return errorResponse(500, 'Unexpected checkout error.', 'UNHANDLED_EXCEPTION');
  }
});
