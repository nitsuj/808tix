#!/usr/bin/env npx tsx
/**
 * Event date helpers (src/lib/event-date.ts).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  formatDateToYyyyMmDd,
  formatEventDateForDisplay,
  isValidDateInput,
  parseYyyyMmDdToLocalDate,
} from '../src/lib/event-date';

const ROOT = process.cwd();
const eventDateSource = readFileSync(join(ROOT, 'src/lib/event-date.ts'), 'utf8');
const eventFormSource = readFileSync(join(ROOT, 'src/lib/event-form.ts'), 'utf8');

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

assert(isValidDateInput('2026-06-10'), 'isValidDateInput accepts valid date');
assert(!isValidDateInput('2026-13-40'), 'isValidDateInput rejects invalid date');

assert(
  !eventDateSource.includes("from '@/lib/event-form'"),
  'event-date does not import event-form (require cycle broken)',
);
assert(
  eventFormSource.includes("from '@/lib/event-date'") &&
    eventFormSource.includes('isValidDateInput'),
  'event-form imports isValidDateInput from event-date',
);
assert(
  eventDateSource.includes('export function isValidDateInput'),
  'isValidDateInput is defined in event-date',
);
assert(
  !eventFormSource.includes('export function isValidDateInput'),
  'isValidDateInput is not duplicated in event-form',
);

const dateFieldSource = readFileSync(
  join(ROOT, 'src/components/organizer/event-date-form-field.tsx'),
  'utf8',
);
assert(
  dateFieldSource.includes('setShowPicker') &&
    dateFieldSource.includes('onPress={() => setShowPicker(true)}') &&
    dateFieldSource.includes('openWebDatePicker'),
  'EventDateFormField has native and web picker open triggers',
);

if (failures > 0) {
  console.error(`\ncheck-event-date: ${failures} failure(s)`);
  process.exit(1);
}

console.log('\ncheck-event-date: all checks passed');
