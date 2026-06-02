import type { Event } from '@/lib/database.types';

/** Events shown on Command Center (draft/published, any event_date). */
export function isOrganizerDashboardEvent(event: Event): boolean {
  return event.status === 'draft' || event.status === 'published';
}

export function filterOrganizerDashboardEvents(events: Event[]): Event[] {
  return events.filter(isOrganizerDashboardEvent);
}
