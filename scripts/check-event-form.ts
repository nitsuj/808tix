#!/usr/bin/env npx tsx
/**
 * Event form validation and time normalization (src/lib/event-form.ts).
 */
import { getTodayYyyyMmDdLocal } from '../src/lib/event-date';
import {
  formatTimeInputForDisplay,
  isEventDateTodayOrFuture,
  normalizeTimeInput,
  validateCreateEventForm,
} from '../src/lib/event-form';

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

const today = getTodayYyyyMmDdLocal();

assert(normalizeTimeInput('1900') === '19:00:00', '1900 normalizes to 19:00:00');
assert(normalizeTimeInput('930') === '09:30:00', '930 normalizes to 09:30:00');
assert(formatTimeInputForDisplay('1900') === '19:00', '1900 displays as 19:00');
assert(normalizeTimeInput('25:00') === null, 'invalid hour blocked');

assert(isEventDateTodayOrFuture(today), 'today is allowed');
assert(!isEventDateTodayOrFuture('2020-01-01'), 'past date rejected');

assert(
  validateCreateEventForm({
    eventName: 'Test',
    venueName: 'Venue',
    eventDate: '2020-01-01',
    startTime: '19:00',
    maxPasses: '10',
  }).eventDate === 'Event date must be today or in the future.',
  'create form blocks past date',
);

assert(
  Object.keys(
    validateCreateEventForm({
      eventName: 'Test',
      venueName: 'Venue',
      eventDate: today,
      startTime: '1900',
      maxPasses: '10',
    }),
  ).length === 0,
  'create form accepts today with compact time',
);

if (failures > 0) {
  console.error(`\ncheck-event-form: ${failures} failure(s)`);
  process.exit(1);
}

console.log('\ncheck-event-form: all checks passed');
