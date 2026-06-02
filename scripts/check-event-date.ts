#!/usr/bin/env npx tsx
/**
 * Event date helpers (src/lib/event-date.ts).
 */
import {
  formatDateToYyyyMmDd,
  formatEventDateForDisplay,
  parseYyyyMmDdToLocalDate,
} from '../src/lib/event-date';

let failures = 0;

function fail(message: string) {
  console.error(`✗ ${message}`);
  failures += 1;
}

function pass(message: string) {
  console.log(`✓ ${message}`);
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    fail(message);
    return;
  }
  pass(message);
}

const sample = new Date(2026, 5, 10, 15, 30, 0);

assert(formatDateToYyyyMmDd(sample) === '2026-06-10', 'formatDateToYyyyMmDd uses YYYY-MM-DD');

assert(
  parseYyyyMmDdToLocalDate('2026-06-10')?.getFullYear() === 2026,
  'parseYyyyMmDdToLocalDate parses valid date',
);

assert(parseYyyyMmDdToLocalDate('2026-13-40') === null, 'invalid date returns null');

assert(
  formatEventDateForDisplay('2026-06-10').includes('2026'),
  'formatEventDateForDisplay includes year',
);

if (failures > 0) {
  console.error(`\ncheck-event-date: ${failures} failure(s)`);
  process.exit(1);
}

console.log('\ncheck-event-date: all checks passed');
