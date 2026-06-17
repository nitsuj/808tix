import { buildAbsoluteAppUrl } from '@/lib/app-base-url';

export function buildPurchaseSuccessUrl(): string {
  return buildAbsoluteAppUrl('/purchase/success');
}

export function buildPurchaseCancelUrl(): string {
  return buildAbsoluteAppUrl('/purchase/cancel');
}

export function buildEventBuyPath(eventId: string, ticketTypeId: string): string {
  const event = eventId.trim();
  const ticketType = ticketTypeId.trim();

  if (!event || !ticketType) {
    throw new Error('buildEventBuyPath: eventId and ticketTypeId are required.');
  }

  const params = new URLSearchParams({ ticket_type_id: ticketType });
  return `/events/${encodeURIComponent(event)}/buy?${params.toString()}`;
}

export function buildEventBuyUrl(eventId: string, ticketTypeId: string): string {
  return buildAbsoluteAppUrl(buildEventBuyPath(eventId, ticketTypeId));
}

export function buildPurchaseSuccessPathWithToken(orderToken: string): string {
  const token = orderToken.trim();

  if (!token) {
    throw new Error('buildPurchaseSuccessPathWithToken: orderToken is required.');
  }

  const params = new URLSearchParams({ order_token: token });
  return `/purchase/success?${params.toString()}`;
}
