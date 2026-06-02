export type PassStatusRow = { status: string };

const ISSUED_PASS_STATUSES = new Set(['active', 'checked_in']);

/** Pure helper for issued_count (active + checked_in). */
export function countPassRowsForEventStats(rows: PassStatusRow[]): {
  issuedCount: number;
  checkedInCount: number;
} {
  let issuedCount = 0;
  let checkedInCount = 0;

  for (const row of rows) {
    if (!ISSUED_PASS_STATUSES.has(row.status)) {
      continue;
    }

    issuedCount += 1;

    if (row.status === 'checked_in') {
      checkedInCount += 1;
    }
  }

  return { issuedCount, checkedInCount };
}
