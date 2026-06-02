import { isValidDateInput } from '@/lib/event-form';
import { formatEventDateLong } from '@/lib/event-datetime-display';

/** Format a local calendar date as YYYY-MM-DD (Postgres date). */
export function formatDateToYyyyMmDd(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Local calendar today as YYYY-MM-DD (for create-event validation). */
export function getTodayYyyyMmDdLocal(): string {
  return formatDateToYyyyMmDd(new Date());
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
  return formatEventDateLong(value) ?? value;
}
