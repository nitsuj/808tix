import type { EventStatus } from '@/lib/database.types';

export const PUBLISH_BEFORE_ISSUE_MESSAGE = 'Publish this event before issuing passes.';

export const PUBLISH_BEFORE_SCAN_MESSAGE =
  'Publish this event before issuing or scanning passes.';

export type DashboardStatusFilter = 'all' | 'live' | 'draft';

export function isEventLive(status: EventStatus): boolean {
  return status === 'published';
}

export function isEventDraft(status: EventStatus): boolean {
  return status === 'draft';
}

export function canIssuePassesForEvent(status: EventStatus): boolean {
  return isEventLive(status);
}

export function canScanPassesForEvent(status: EventStatus): boolean {
  return isEventLive(status);
}

/** Pill label for organizer command surfaces. */
export function getEventStatusPillLabel(status: EventStatus): string {
  if (status === 'published') {
    return 'LIVE';
  }

  if (status === 'draft') {
    return 'DRAFT';
  }

  return status.charAt(0).toUpperCase() + status.slice(1).toUpperCase();
}

export function filterDashboardEventsByStatus<T extends { status: EventStatus }>(
  events: T[],
  filter: DashboardStatusFilter,
): T[] {
  if (filter === 'live') {
    return events.filter((event) => isEventLive(event.status));
  }

  if (filter === 'draft') {
    return events.filter((event) => isEventDraft(event.status));
  }

  return events;
}

export function getIssuePassBlockedMessage(status: EventStatus): string | null {
  if (canIssuePassesForEvent(status)) {
    return null;
  }

  return PUBLISH_BEFORE_ISSUE_MESSAGE;
}

export function getScanBlockedMessage(status: EventStatus): string | null {
  if (canScanPassesForEvent(status)) {
    return null;
  }

  return PUBLISH_BEFORE_SCAN_MESSAGE;
}
