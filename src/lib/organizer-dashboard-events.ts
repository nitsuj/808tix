import type { Event } from '@/lib/database.types';

/** Events shown on Command Center (draft/published, any date). */
export function isOrganizerDashboardEvent(event: Event): boolean {
  return event.status !== 'completed' && event.status !== 'cancelled';
}
