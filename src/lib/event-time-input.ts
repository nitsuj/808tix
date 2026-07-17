/** Strip non-digits for legacy time entry (never mutate formatted strings in place). */
export function stripTimeInputDigits(input: string): string {
  return input.replace(/\D/g, '').slice(0, 4);
}

/**
 * Build HH:MM from raw digits only.
 * 1 → 01:00, 15 → 15:00, 930 → 09:30, 1230 → 12:30, 1900 → 19:00.
 * Returns null when out of range (e.g. 2400, 2560, 9999).
 */
export function normalizeTimeDisplayFromDigits(digits: string): string | null {
  const trimmed = digits.trim();

  if (!trimmed) {
    return null;
  }

  if (!/^\d+$/.test(trimmed) || trimmed.length > 4) {
    return null;
  }

  let hours: number;
  let minutes: number;

  if (trimmed.length === 1) {
    hours = Number(trimmed);
    minutes = 0;
  } else if (trimmed.length === 2) {
    hours = Number(trimmed);
    minutes = 0;
  } else if (trimmed.length === 3) {
    const padded = trimmed.padStart(4, '0');
    hours = Number(padded.slice(0, 2));
    minutes = Number(padded.slice(2, 4));
  } else {
    hours = Number(trimmed.slice(0, 2));
    minutes = Number(trimmed.slice(2, 4));
  }

  if (hours > 23 || minutes > 59) {
    return null;
  }

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/** Strip digits from any input, then produce a fresh HH:MM (or null if invalid). */
export function normalizeTimeDisplayFromInput(input: string): string | null {
  const trimmed = input.trim();

  if (/^\d{2}:\d{2}$/.test(trimmed)) {
    const hours = Number(trimmed.slice(0, 2));
    const minutes = Number(trimmed.slice(3, 5));
    if (hours <= 23 && minutes <= 59) {
      return trimmed;
    }
    return null;
  }

  const digits = stripTimeInputDigits(input);

  if (!digits) {
    return null;
  }

  return normalizeTimeDisplayFromDigits(digits);
}

/** Normalize for blur/submit; leaves partial digit input unchanged when not yet valid. */
export function normalizeTimeFieldOnBlur(input: string): string {
  const normalized = normalizeTimeDisplayFromInput(input);

  if (normalized) {
    return normalized;
  }

  return stripTimeInputDigits(input);
}

/** Parse stored HH:MM (24-hour) into a Date for time pickers. */
export function parseHhMmToLocalDate(value: string): Date | null {
  const normalized = normalizeTimeDisplayFromInput(value);
  if (!normalized) {
    return null;
  }

  const hours = Number(normalized.slice(0, 2));
  const minutes = Number(normalized.slice(3, 5));
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

/** Format a Date as HH:MM (24-hour) for form storage. */
export function formatDateToHhMm(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** Display HH:MM as 12-hour AM/PM (e.g. 7:00 PM). */
export function formatHhMmTo12HourDisplay(value: string): string | null {
  const parsed = parseHhMmToLocalDate(value);
  if (!parsed) {
    return null;
  }

  return parsed.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}
