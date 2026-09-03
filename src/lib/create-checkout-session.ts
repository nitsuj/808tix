export type StartCheckoutSessionInput = {
  eventId: string;
  ticketTypeId: string;
  quantity: number;
  buyerEmail: string;
  buyerName?: string | null;
  buyerPhone?: string | null;
};

export type StartCheckoutSessionResult = {
  checkoutUrl: string;
  checkoutSessionId: string | null;
  status: string;
};

type CheckoutApiResponse = {
  ok?: boolean;
  checkout_url?: string;
  checkout_session_id?: string;
  order_public_access_token?: string;
  public_access_token?: string;
  order_token?: string;
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
    }),
  });

  let body: CheckoutApiResponse;

  try {
    body = (await response.json()) as CheckoutApiResponse;
  } catch {
    throw new Error('Checkout could not be started. Please try again.');
  }

  if (
    body.order_public_access_token ||
    body.public_access_token ||
    body.order_token
  ) {
    throw new Error('Checkout response exposed a pre-payment order token.');
  }

  if (!response.ok || !body.ok || !body.checkout_url) {
    const message = body.message?.trim() || 'Checkout could not be started. Please try again.';
    throw new Error(message);
  }

  return {
    checkoutUrl: body.checkout_url,
    checkoutSessionId: body.checkout_session_id?.trim() || null,
    status: body.status ?? 'checkout_open',
  };
}
