export type PublicUpcomingEvent = {
  id: string;
  name: string;
  venue_name: string | null;
  event_date: string | null;
  start_time: string | null;
  image_url: string | null;
  currency: string;
  starting_price_cents: number;
};

export function parsePublicUpcomingEvents(data: unknown): PublicUpcomingEvent[] {
  if (!Array.isArray(data)) {
    return [];
  }

  const events: PublicUpcomingEvent[] = [];

  for (const row of data) {
    if (!row || typeof row !== 'object') {
      continue;
    }

    const record = row as Record<string, unknown>;
    const id = typeof record.id === 'string' ? record.id : null;
    const name = typeof record.name === 'string' ? record.name : null;
    const startingPrice = record.starting_price_cents;

    if (!id || !name || typeof startingPrice !== 'number' || !Number.isFinite(startingPrice)) {
      continue;
    }

    events.push({
      id,
      name,
      venue_name: typeof record.venue_name === 'string' ? record.venue_name : null,
      event_date: typeof record.event_date === 'string' ? record.event_date : null,
      start_time: typeof record.start_time === 'string' ? record.start_time : null,
      image_url: typeof record.image_url === 'string' ? record.image_url : null,
      currency: typeof record.currency === 'string' ? record.currency : 'usd',
      starting_price_cents: startingPrice,
    });
  }

  return events;
}
