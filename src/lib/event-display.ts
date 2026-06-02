import type { EventStatus } from '@/lib/database.types';
import { formatEventDateTimeLong } from '@/lib/event-datetime-display';

export function formatEventStatus(status: EventStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function formatEventDateLabel(eventDate: string | null, startTime: string | null): string | null {
  return formatEventDateTimeLong(eventDate, startTime);
}

/** Postgres time HH:MM:SS → form input HH:MM */
export function formatTimeForInput(startTime: string | null): string {
  if (!startTime) {
    return '';
  }

  return startTime.slice(0, 5);
}

export function formatIssuedCapacity(issued: number, capacity: number): string {
  return `${issued} / ${capacity}`;
}
