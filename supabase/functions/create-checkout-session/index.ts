import { createStripeCheckoutSession } from '../_shared/stripe.ts';
import { createServiceClient } from '../_shared/supabase-service.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type RequestBody = {
  event_id?: string;
  ticket_type_id?: string;
  quantity?: number;
  buyer_email?: string;
  buyer_name?: string | null;
  buyer_phone?: string | null;
  success_url?: string;
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

function appendOrderToken(url: string, token: string): string {
  const parsed = new URL(url);
  parsed.searchParams.set('order_token', token);
  return parsed.toString();
}

function parsePositiveInt(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    return null;
  }
  return value;
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
    const successUrl = body.success_url?.trim();
    const cancelUrl = body.cancel_url?.trim();
    const quantity = parsePositiveInt(body.quantity);

    if (!eventId || !ticketTypeId || !buyerEmail || !successUrl || !cancelUrl || !quantity) {
      return errorResponse(
        400,
        'event_id, ticket_type_id, quantity, buyer_email, success_url, and cancel_url are required.',
        'REQUEST_FIELDS_MISSING',
      );
    }

    try {
      new URL(successUrl);
      new URL(cancelUrl);
    } catch {
      return errorResponse(400, 'success_url and cancel_url must be valid URLs.', 'URL_INVALID');
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
        successUrl: appendOrderToken(successUrl, publicAccessToken),
        cancelUrl: appendOrderToken(cancelUrl, publicAccessToken),
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

    return jsonResponse({
      ok: true,
      checkout_url: checkoutSession.url,
      order_public_access_token: publicAccessToken,
      status: 'checkout_open',
    });
  } catch (error) {
    console.error('[create-checkout-session] unhandled exception', error);
    return errorResponse(500, 'Unexpected checkout error.', 'UNHANDLED_EXCEPTION');
  }
});
