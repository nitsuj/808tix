/**
 * Canonical event date/time formatting for organizer + guest surfaces.
 *
 * Rules:
 * - Organizer formatter always includes the year.
 * - Ticket formatter may be uppercase and always includes the year.
 * - Uses local time parsing (no UTC drift) and deterministic `en-US` month/day formatting.
 */

function normalizeStartTimeForDateString(startTime: string | null | undefined): string | null {
  const trimmed = (startTime ?? '').trim();
  if (!trimmed) {
    return null;
  }

  // Stored in DB as HH:MM:SS; organizer form typically uses HH:MM.
  if (/^\d{2}:\d{2}$/.test(trimmed)) {
    return `${trimmed}:00`;
  }

  if (/^\d{2}:\d{2}:\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

function parseLocalEventDateTime(
  eventDate: string | null | undefined,
  startTime: string | null | undefined,
): Date | null {
  const dateTrimmed = (eventDate ?? '').trim();
  if (!dateTrimmed) {
    return null;
  }

  const normalizedStartTime = normalizeStartTimeForDateString(startTime);
  if (!normalizedStartTime) {
    return null;
  }

  const parsed = new Date(`${dateTrimmed}T${normalizedStartTime}`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function parseLocalDateAtNoon(eventDate: string | null | undefined): Date | null {
  const dateTrimmed = (eventDate ?? '').trim();
  if (!dateTrimmed) {
    return null;
  }

  const parsed = new Date(`${dateTrimmed}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

/** e.g. `Jun 10, 2026` */
export function formatEventDateLong(eventDate: string | null | undefined): string | null {
  const parsed = parseLocalDateAtNoon(eventDate);
  if (!parsed) {
    return null;
  }

  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** e.g. `Jun 10, 2026 · 7:00 PM` */
export function formatEventDateTimeLong(
  eventDate: string | null | undefined,
  startTime: string | null | undefined,
): string | null {
  const dateLong = formatEventDateLong(eventDate);
  if (!dateLong) {
    return null;
  }

  const normalizedStartTime = normalizeStartTimeForDateString(startTime);
  if (!normalizedStartTime) {
    return dateLong;
  }

  const parsed = parseLocalEventDateTime(eventDate, startTime);
  if (!parsed) {
    return dateLong;
  }

  const timePart = parsed.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return `${dateLong} · ${timePart}`;
}

/**
 * Guest-facing ticket format.
 * e.g. `TUE, JUN 10, 2026 · 7:00 PM`
 */
export function formatEventDateTimeTicketUpper(
  eventDate: string | null | undefined,
  startTime: string | null | undefined,
): string | null {
  const normalizedStartTime = normalizeStartTimeForDateString(startTime);
  const parsed = normalizedStartTime
    ? parseLocalEventDateTime(eventDate, startTime)
    : parseLocalDateAtNoon(eventDate);
  if (!parsed) {
    return null;
  }

  const weekdayAndDate = parsed.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  if (!normalizedStartTime) {
    return weekdayAndDate.toUpperCase();
  }

  const timePart = parsed.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return `${weekdayAndDate.toUpperCase()} · ${timePart.toUpperCase()}`;
}

