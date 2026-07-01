import {
  maskRecipientEmail,
  sendOrderConfirmationEmail,
  type OrderConfirmationTicket,
} from '../_shared/order-email.ts';
import { createServiceClient } from '../_shared/supabase-service.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type RequestBody = {
  order_public_access_token?: string;
};

type OrderLookupRow = {
  status: string;
  event_name: string | null;
  venue_name: string | null;
  event_date: string | null;
  start_time: string | null;
  tickets: Array<{
    secure_token: string;
    pass_type: string;
    guest_name: string;
  }> | null;
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

function assertServiceRoleAuth(req: Request): void {
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();

  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured.');
  }

  const authHeader = req.headers.get('Authorization')?.trim();

  if (authHeader !== `Bearer ${serviceRoleKey}`) {
    throw new Error('UNAUTHORIZED');
  }
}

function mapTickets(
  tickets: OrderLookupRow['tickets'],
): OrderConfirmationTicket[] {
  if (!Array.isArray(tickets)) {
    return [];
  }

  return tickets.map((ticket, index) => ({
    sequence: index + 1,
    pass_type: ticket.pass_type,
    guest_name: ticket.guest_name,
    secure_token: ticket.secure_token,
  }));
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    if (req.method !== 'POST') {
      return errorResponse(405, 'Method not allowed.', 'METHOD_NOT_ALLOWED');
    }

    try {
      assertServiceRoleAuth(req);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unauthorized';

      if (message === 'UNAUTHORIZED') {
        return errorResponse(401, 'Service role authorization required.', 'UNAUTHORIZED');
      }

      return errorResponse(500, 'Email test function is not configured.', 'CONFIG_MISSING');
    }

    let body: RequestBody;

    try {
      body = (await req.json()) as RequestBody;
    } catch {
      return errorResponse(400, 'Invalid request body.', 'REQUEST_BODY_INVALID');
    }

    const publicAccessToken = body.order_public_access_token?.trim();

    if (!publicAccessToken) {
      return errorResponse(
        400,
        'order_public_access_token is required.',
        'REQUEST_FIELDS_MISSING',
      );
    }

    const supabase = createServiceClient();

    const { data: lookup, error: lookupError } = await supabase.rpc('get_order_by_public_token', {
      p_public_access_token: publicAccessToken,
    });

    if (lookupError) {
      console.error('[send-order-confirmation-email] order lookup failed', {
        message: lookupError.message,
      });
      return errorResponse(400, lookupError.message, 'ORDER_LOOKUP_FAILED');
    }

    if (!lookup) {
      return errorResponse(404, 'Order not found.', 'ORDER_NOT_FOUND');
    }

    const orderLookup = lookup as OrderLookupRow;

    if (orderLookup.status !== 'paid') {
      return errorResponse(
        409,
        'Order confirmation email is only available for paid orders.',
        'ORDER_NOT_PAID',
      );
    }

    const tickets = mapTickets(orderLookup.tickets);

    if (tickets.length === 0) {
      return errorResponse(409, 'Paid order has no tickets to email.', 'TICKETS_MISSING');
    }

    const { data: orderRow, error: orderError } = await supabase
      .from('orders')
      .select('id, buyer_email, buyer_name, public_access_token')
      .eq('public_access_token', publicAccessToken)
      .maybeSingle();

    if (orderError || !orderRow) {
      console.error('[send-order-confirmation-email] order row lookup failed', orderError);
      return errorResponse(500, 'Could not load order details.', 'ORDER_ROW_MISSING');
    }

    const sendResult = await sendOrderConfirmationEmail(supabase, {
      order_id: orderRow.id,
      public_access_token: orderRow.public_access_token,
      buyer_email: orderRow.buyer_email,
      buyer_name: orderRow.buyer_name,
      event_name: orderLookup.event_name ?? 'your event',
      venue_name: orderLookup.venue_name,
      event_date: orderLookup.event_date,
      start_time: orderLookup.start_time,
      tickets,
    });

    if (!sendResult.ok) {
      return jsonResponse(
        {
          ok: false,
          message: sendResult.error,
          code: 'EMAIL_SEND_FAILED',
          outbound_message_status: sendResult.outbound_message_status ?? 'failed',
        },
        502,
      );
    }

    return jsonResponse({
      ok: true,
      status: sendResult.mode,
      provider: sendResult.provider,
      outbound_message_status: sendResult.outbound_message_status,
      already_sent: sendResult.already_sent,
      recipient: maskRecipientEmail(sendResult.recipient),
      pass_count: sendResult.pass_count,
    });
  } catch (error) {
    console.error('[send-order-confirmation-email] unhandled exception', error);
    return errorResponse(500, 'Unexpected email test error.', 'UNHANDLED_EXCEPTION');
  }
});
