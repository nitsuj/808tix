import type { EventStatus } from '@/lib/database.types';

export function formatEventStatus(status: EventStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function formatEventDateLabel(eventDate: string | null, startTime: string | null): string | null {
  if (!eventDate) {
    return null;
  }

  const parsed = new Date(`${eventDate}T${startTime ?? '00:00:00'}`);

  if (Number.isNaN(parsed.getTime())) {
    return eventDate;
  }

  const datePart = parsed.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  if (!startTime) {
    return datePart;
  }

  const timePart = parsed.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });

  return `${datePart} · ${timePart}`;
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
