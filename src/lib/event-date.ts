import { isValidDateInput } from '@/lib/event-form';

/** Format a local calendar date as YYYY-MM-DD (Postgres date). */
export function formatDateToYyyyMmDd(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Parse YYYY-MM-DD to local midnight (for pickers). */
export function parseYyyyMmDdToLocalDate(value: string): Date | null {
  const trimmed = value.trim();

  if (!isValidDateInput(trimmed)) {
    return null;
  }

  const [year, month, day] = trimmed.split('-').map((part) => Number(part));
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export function formatEventDateForDisplay(value: string): string {
  const parsed = parseYyyyMmDdToLocalDate(value);

  if (!parsed) {
    return value;
  }

  return parsed.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
