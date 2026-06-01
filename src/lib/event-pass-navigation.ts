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
  router.push(buildEventPassListHref(eventId, filter));
}
