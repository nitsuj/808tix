/**
 * Launch fee math shared by buyer UI (mirrors public.calculate_order_fees).
 * Labels must stay exact for transparent receipts/checkout.
 */
export const SERVICE_FEE_LABEL = '808Tickets service fee';
export const PROCESSING_FEE_LABEL = 'Payment processing fee';

export type OrderFeeBreakdown = {
  subtotalCents: number;
  platformFeeCents: number;
  processingFeeCents: number;
  totalCents: number;
  organizerNetCents: number;
};

export function calculateOrderFees(input: {
  subtotalCents: number;
  quantity: number;
  platformFeeBps: number;
  platformFeeFixedCents: number;
  processingFeeBps: number;
  processingFeeFixedCents: number;
}): OrderFeeBreakdown {
  const {
    subtotalCents,
    quantity,
    platformFeeBps,
    platformFeeFixedCents,
    processingFeeBps,
    processingFeeFixedCents,
  } = input;

  if (subtotalCents <= 0 || quantity <= 0) {
    return {
      subtotalCents: Math.max(subtotalCents, 0),
      platformFeeCents: 0,
      processingFeeCents: 0,
      totalCents: Math.max(subtotalCents, 0),
      organizerNetCents: Math.max(subtotalCents, 0),
    };
  }

  const platformFeeCents =
    Math.round((subtotalCents * platformFeeBps) / 10000) + platformFeeFixedCents * quantity;

  const baseCents = subtotalCents + platformFeeCents;
  const divisor = 1 - processingFeeBps / 10000;

  if (divisor <= 0) {
    throw new Error('processingFeeBps must be less than 10000');
  }

  const totalCents = Math.ceil((baseCents + processingFeeFixedCents) / divisor);
  const processingFeeCents = Math.max(totalCents - baseCents, 0);

  return {
    subtotalCents,
    platformFeeCents,
    processingFeeCents,
    totalCents: baseCents + processingFeeCents,
    organizerNetCents: subtotalCents,
  };
}
