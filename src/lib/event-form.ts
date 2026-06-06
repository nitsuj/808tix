import type { EventStatus } from '@/lib/database.types';
import { getTodayYyyyMmDdLocal, isValidDateInput } from '@/lib/event-date';
import { normalizeTimeDisplayFromInput } from '@/lib/event-time-input';

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

/** Local calendar compare — YYYY-MM-DD strings, no UTC drift. */
export function compareYyyyMmDdLocal(left: string, right: string): number {
  if (left === right) {
    return 0;
  }

  return left < right ? -1 : 1;
}

export function isEventDateTodayOrFuture(
  eventDate: string,
  todayYmd: string = getTodayYyyyMmDdLocal(),
): boolean {
  const trimmed = eventDate.trim();

  if (!isValidDateInput(trimmed)) {
    return false;
  }

  return compareYyyyMmDdLocal(trimmed, todayYmd) >= 0;
}

export function validateCreateEventForm(
  values: CreateEventFormValues,
  todayYmd: string = getTodayYyyyMmDdLocal(),
): CreateEventFieldErrors {
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
  } else if (!isEventDateTodayOrFuture(values.eventDate, todayYmd)) {
    errors.eventDate = 'Event date must be today or in the future.';
  }

  const trimmedTime = values.startTime.trim();

  if (!trimmedTime) {
    errors.startTime = 'Start time is required.';
  } else if (!normalizeTimeDisplayFromInput(trimmedTime)) {
    errors.startTime = 'Enter a valid time between 00:00 and 23:59.';
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
  todayYmd?: string,
): EditEventFieldErrors {
  const errors: EditEventFieldErrors = {
    ...validateCreateEventForm(values, todayYmd),
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

/** Returns Postgres-compatible time string HH:MM:SS or null if invalid. */
export function normalizeTimeInput(input: string): string | null {
  const display = normalizeTimeDisplayFromInput(input);

  if (!display) {
    return null;
  }

  return `${display}:00`;
}
