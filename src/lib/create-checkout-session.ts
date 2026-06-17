export type StartCheckoutSessionInput = {
  eventId: string;
  ticketTypeId: string;
  quantity: number;
  buyerEmail: string;
  buyerName?: string | null;
  buyerPhone?: string | null;
  successUrl: string;
  cancelUrl: string;
};

export type StartCheckoutSessionResult = {
  checkoutUrl: string;
  orderPublicAccessToken: string;
  status: string;
};

type CheckoutApiResponse = {
  ok?: boolean;
  checkout_url?: string;
  order_public_access_token?: string;
  status?: string;
  message?: string;
  code?: string;
};

function getSupabaseFunctionConfig(): { url: string; anonKey: string } {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    throw new Error(
      'Missing Supabase configuration. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.',
    );
  }

  return { url, anonKey };
}

export async function startCheckoutSession(
  input: StartCheckoutSessionInput,
): Promise<StartCheckoutSessionResult> {
  const { url, anonKey } = getSupabaseFunctionConfig();
  const endpoint = `${url.replace(/\/$/, '')}/functions/v1/create-checkout-session`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify({
      event_id: input.eventId.trim(),
      ticket_type_id: input.ticketTypeId.trim(),
      quantity: input.quantity,
      buyer_email: input.buyerEmail.trim(),
      buyer_name: input.buyerName?.trim() || null,
      buyer_phone: input.buyerPhone?.trim() || null,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
    }),
  });

  let body: CheckoutApiResponse;

  try {
    body = (await response.json()) as CheckoutApiResponse;
  } catch {
    throw new Error('Checkout could not be started. Please try again.');
  }

  if (!response.ok || !body.ok || !body.checkout_url || !body.order_public_access_token) {
    const message = body.message?.trim() || 'Checkout could not be started. Please try again.';
    throw new Error(message);
  }

  return {
    checkoutUrl: body.checkout_url,
    orderPublicAccessToken: body.order_public_access_token,
    status: body.status ?? 'checkout_open',
  };
}
