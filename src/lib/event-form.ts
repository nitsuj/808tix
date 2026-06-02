import type { EventStatus } from '@/lib/database.types';
import { getTodayYyyyMmDdLocal } from '@/lib/event-date';

export type { EventStatus };

export type EventFormValues = {
  eventName: string;
  venueName: string;
  eventDate: string;
  startTime: string;
  maxPasses: string;
  status: EventStatus;
};

export type CreateEventFormValues = Omit<EventFormValues, 'status'>;

export type EventFormFieldErrors = Partial<Record<keyof EventFormValues, string>>;

export type CreateEventFieldErrors = Partial<Record<keyof CreateEventFormValues, string>>;

export const EVENT_STATUS_OPTIONS: EventStatus[] = [
  'draft',
  'published',
  'completed',
  'cancelled',
];

export function isEventDateTodayOrFuture(eventDate: string): boolean {
  const trimmed = eventDate.trim();

  if (!isValidDateInput(trimmed)) {
    return false;
  }

  return trimmed >= getTodayYyyyMmDdLocal();
}

export function validateCreateEventForm(values: CreateEventFormValues): CreateEventFieldErrors {
  const errors: CreateEventFieldErrors = {};

  if (!values.eventName.trim()) {
    errors.eventName = 'Event name is required.';
  }

  if (!values.venueName.trim()) {
    errors.venueName = 'Venue name is required.';
  }

  if (!values.eventDate.trim()) {
    errors.eventDate = 'Event date is required.';
  } else if (!isValidDateInput(values.eventDate)) {
    errors.eventDate = 'Use format YYYY-MM-DD.';
  } else if (!isEventDateTodayOrFuture(values.eventDate)) {
    errors.eventDate = 'Event date must be today or in the future.';
  }

  if (!values.startTime.trim()) {
    errors.startTime = 'Start time is required.';
  } else if (!normalizeTimeInput(values.startTime)) {
    errors.startTime = 'Use 24-hour format HH:MM (e.g. 21:00 or 1900).';
  }

  if (!values.maxPasses.trim()) {
    errors.maxPasses = 'Max passes is required.';
  } else if (parseMaxPassesInput(values.maxPasses) === null) {
    errors.maxPasses = 'Enter a whole number of at least 1.';
  }

  return errors;
}

export type EditEventFormValues = CreateEventFormValues;

export type EditEventFieldErrors = CreateEventFieldErrors;

export function validateEditEventForm(
  values: EditEventFormValues,
  issuedCount: number,
): EditEventFieldErrors {
  const errors: EditEventFieldErrors = {
    ...validateCreateEventForm(values),
  };

  const capacity = parseMaxPassesInput(values.maxPasses);

  if (capacity === null && !errors.maxPasses) {
    errors.maxPasses = 'Enter a whole number of at least 1.';
  } else if (capacity !== null && capacity < issuedCount) {
    errors.maxPasses = `Max passes cannot be less than ${issuedCount} issued.`;
  }

  return errors;
}

/** Integer >= 1 or null if invalid. */
export function parseMaxPassesInput(input: string): number | null {
  const trimmed = input.trim();

  if (!/^\d+$/.test(trimmed)) {
    return null;
  }

  const value = Number(trimmed);

  if (!Number.isSafeInteger(value) || value < 1) {
    return null;
  }

  return value;
}

export function isValidDateInput(input: string): boolean {
  const trimmed = input.trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return false;
  }

  const parsed = new Date(`${trimmed}T12:00:00`);

  return !Number.isNaN(parsed.getTime());
}

function parseCompactTimeDigits(trimmed: string): { hours: number; minutes: number } | null {
  if (!/^\d{3,4}$/.test(trimmed)) {
    return null;
  }

  const padded = trimmed.padStart(4, '0');
  const hours = Number(padded.slice(0, 2));
  const minutes = Number(padded.slice(2, 4));

  if (hours > 23 || minutes > 59) {
    return null;
  }

  return { hours, minutes };
}

/** Returns Postgres-compatible time string HH:MM:SS or null if invalid. */
export function normalizeTimeInput(input: string): string | null {
  const trimmed = input.trim();

  const colonMatch = /^(\d{1,2}):(\d{2})$/.exec(trimmed);

  if (colonMatch) {
    const hours = Number(colonMatch[1]);
    const minutes = Number(colonMatch[2]);

    if (hours > 23 || minutes > 59) {
      return null;
    }

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
  }

  const compact = parseCompactTimeDigits(trimmed);

  if (!compact) {
    return null;
  }

  return `${String(compact.hours).padStart(2, '0')}:${String(compact.minutes).padStart(2, '0')}:00`;
}

/** Normalize compact times for display in HH:MM (e.g. 1900 → 19:00). */
export function formatTimeInputForDisplay(input: string): string {
  const normalized = normalizeTimeInput(input);

  if (!normalized) {
    return input.trim();
  }

  return normalized.slice(0, 5);
}
