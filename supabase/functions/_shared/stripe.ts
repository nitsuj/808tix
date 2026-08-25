const STRIPE_API_BASE = 'https://api.stripe.com/v1';

export type StripeCheckoutSessionInput = {
  secretKey: string;
  currency: string;
  ticketName: string;
  ticketUnitAmountCents: number;
  ticketQuantity: number;
  platformFeeCents: number;
  processingFeeCents: number;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
  metadata: Record<string, string>;
  expiresAtUnix?: number;
};

export type StripeCheckoutSessionResult = {
  id: string;
  url: string;
};

type StripeApiError = {
  error?: {
    message?: string;
    type?: string;
  };
};

export async function createStripeCheckoutSession(
  input: StripeCheckoutSessionInput,
): Promise<StripeCheckoutSessionResult> {
  const params = new URLSearchParams();
  params.set('mode', 'payment');
  params.set('customer_email', input.customerEmail);
  params.set('success_url', input.successUrl);
  params.set('cancel_url', input.cancelUrl);

  if (input.expiresAtUnix) {
    params.set('expires_at', String(input.expiresAtUnix));
  }

  params.set('line_items[0][price_data][currency]', input.currency);
  params.set('line_items[0][price_data][product_data][name]', input.ticketName);
  params.set('line_items[0][price_data][unit_amount]', String(input.ticketUnitAmountCents));
  params.set('line_items[0][quantity]', String(input.ticketQuantity));

  let nextLineIndex = 1;

  if (input.platformFeeCents > 0) {
    params.set(`line_items[${nextLineIndex}][price_data][currency]`, input.currency);
    params.set(
      `line_items[${nextLineIndex}][price_data][product_data][name]`,
      '808Tickets service fee',
    );
    params.set(
      `line_items[${nextLineIndex}][price_data][unit_amount]`,
      String(input.platformFeeCents),
    );
    params.set(`line_items[${nextLineIndex}][quantity]`, '1');
    nextLineIndex += 1;
  }

  if (input.processingFeeCents > 0) {
    params.set(`line_items[${nextLineIndex}][price_data][currency]`, input.currency);
    params.set(
      `line_items[${nextLineIndex}][price_data][product_data][name]`,
      'Payment processing fee',
    );
    params.set(
      `line_items[${nextLineIndex}][price_data][unit_amount]`,
      String(input.processingFeeCents),
    );
    params.set(`line_items[${nextLineIndex}][quantity]`, '1');
  }

  for (const [key, value] of Object.entries(input.metadata)) {
    params.set(`metadata[${key}]`, value);
  }

  const response = await fetch(`${STRIPE_API_BASE}/checkout/sessions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const bodyText = await response.text();

  if (!response.ok) {
    let message = bodyText;
    try {
      const parsed = JSON.parse(bodyText) as StripeApiError;
      message = parsed.error?.message ?? bodyText;
    } catch {
      // Keep raw body.
    }
    throw new Error(`Stripe Checkout Session creation failed: ${message}`);
  }

  const session = JSON.parse(bodyText) as { id?: string; url?: string };

  if (!session.id || !session.url) {
    throw new Error('Stripe Checkout Session response missing id or url.');
  }

  return { id: session.id, url: session.url };
}

function parseStripeSignatureHeader(header: string): { timestamp: string; signatures: string[] } {
  const timestampParts: string[] = [];
  const signatures: string[] = [];

  for (const part of header.split(',')) {
    const [key, value] = part.split('=');
    if (key === 't' && value) {
      timestampParts.push(value);
    }
    if (key === 'v1' && value) {
      signatures.push(value);
    }
  }

  return {
    timestamp: timestampParts[0] ?? '',
    signatures,
  };
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return mismatch === 0;
}

async function computeStripeSignature(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(payload),
  );

  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifyStripeWebhookSignature(
  payload: string,
  signatureHeader: string,
  secret: string,
  toleranceSeconds = 300,
): Promise<boolean> {
  const { timestamp, signatures } = parseStripeSignatureHeader(signatureHeader);

  if (!timestamp || signatures.length === 0) {
    return false;
  }

  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds)) {
    return false;
  }

  const age = Math.floor(Date.now() / 1000) - timestampSeconds;
  if (age > toleranceSeconds || age < -toleranceSeconds) {
    return false;
  }

  const signedPayload = `${timestamp}.${payload}`;
  const expected = await computeStripeSignature(signedPayload, secret);

  return signatures.some((signature) => timingSafeEqualHex(expected, signature));
}

export type StripeWebhookEvent = {
  id: string;
  type: string;
  data: {
    object: Record<string, unknown>;
  };
};

export function readPaymentIntentId(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id;
    if (typeof id === 'string' && id.trim()) {
      return id.trim();
    }
  }

  return null;
}

export async function fetchStripeChargeId(
  secretKey: string,
  paymentIntentId: string,
): Promise<string | null> {
  const response = await fetch(`${STRIPE_API_BASE}/payment_intents/${paymentIntentId}`, {
    headers: {
      Authorization: `Bearer ${secretKey}`,
    },
  });

  if (!response.ok) {
    return null;
  }

  const payload = await response.json() as {
    latest_charge?: string | { id?: string } | null;
  };

  const latestCharge = payload.latest_charge;
  if (typeof latestCharge === 'string') {
    return latestCharge;
  }

  if (latestCharge && typeof latestCharge === 'object' && typeof latestCharge.id === 'string') {
    return latestCharge.id;
  }

  return null;
}
