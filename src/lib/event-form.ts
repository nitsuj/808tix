export type CreateEventFormValues = {
  eventName: string;
  venueName: string;
  eventDate: string;
  startTime: string;
};

export type CreateEventFieldErrors = Partial<Record<keyof CreateEventFormValues, string>>;

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
  }

  if (!values.startTime.trim()) {
    errors.startTime = 'Start time is required.';
  } else if (!normalizeTimeInput(values.startTime)) {
    errors.startTime = 'Use 24-hour format HH:MM (e.g. 21:00).';
  }

  return errors;
}

export function isValidDateInput(input: string): boolean {
  const trimmed = input.trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return false;
  }

  const parsed = new Date(`${trimmed}T12:00:00`);

  return !Number.isNaN(parsed.getTime());
}

/** Returns Postgres-compatible time string HH:MM:SS or null if invalid. */
export function normalizeTimeInput(input: string): string | null {
  const trimmed = input.trim();
  const match = /^(\d{1,2}):(\d{2})$/.exec(trimmed);

  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours > 23 || minutes > 59) {
    return null;
  }

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
}
