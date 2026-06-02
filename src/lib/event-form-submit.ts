import { getTodayYyyyMmDdLocal } from '@/lib/event-date';

import {
  normalizeTimeInput,
  type CreateEventFieldErrors,
  type CreateEventFormValues,
  validateCreateEventForm,
} from '@/lib/event-form';
import { normalizeTimeDisplayFromInput, stripTimeInputDigits } from '@/lib/event-time-input';

export type PreparedEventForm = {
  values: CreateEventFormValues;
  errors: CreateEventFieldErrors;
  normalizedStartTime: string | null;
};

/**
 * Normalize time + validate before create/edit submit.
 * Always run this; do not call validateCreateEventForm on raw UI state alone.
 */
export function prepareEventFormForSubmit(
  raw: CreateEventFormValues,
  options?: { todayYmd?: string },
): PreparedEventForm {
  const todayYmd = options?.todayYmd;
  const normalizedDisplay = normalizeTimeDisplayFromInput(raw.startTime);
  const values: CreateEventFormValues = {
    ...raw,
    startTime: normalizedDisplay ?? stripTimeInputDigits(raw.startTime),
  };

  const errors = validateCreateEventForm(values, todayYmd);
  const normalizedStartTime = normalizeTimeInput(raw.startTime);

  if (!errors.startTime && raw.startTime.trim() && !normalizedStartTime) {
    errors.startTime = 'Enter a valid time between 00:00 and 23:59.';
  }

  return { values, errors, normalizedStartTime };
}

export function isCreateEventFormSubmittable(prepared: PreparedEventForm): boolean {
  return (
    Object.keys(prepared.errors).length === 0 &&
    prepared.normalizedStartTime !== null &&
    isEventDateAllowedForSubmit(prepared.values.eventDate, getTodayYyyyMmDdLocal())
  );
}

export function isEventDateAllowedForSubmit(
  eventDate: string,
  todayYmd: string = getTodayYyyyMmDdLocal(),
): boolean {
  const trimmed = eventDate.trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return false;
  }

  return trimmed >= todayYmd;
}
