import type { Router } from 'expo-router';

import type { EventPassFilter } from '@/lib/event-passes';

/** Expo Router href for the organizer pass list (use object form — query in string paths breaks web). */
export function buildEventPassListHref(eventId: string, filter: EventPassFilter) {
  return {
    pathname: '/events/[eventId]/passes' as const,
    params: {
      eventId,
      filter,
    },
  };
}

export function navigateToEventPassList(
  router: Router,
  eventId: string,
  filter: EventPassFilter,
): void {
  const href = buildEventPassListHref(eventId, filter);
  const destination = `/events/${eventId}/passes?filter=${filter}`;

  // TEMP DEBUG — remove after verifying navigation on Vercel/web
  console.log('[pass-list nav] eventId:', eventId);
  console.log('[pass-list nav] filter:', filter);
  console.log('[pass-list nav] destination:', destination);
  console.log('[pass-list nav] href:', href);

  router.push(href);
}
