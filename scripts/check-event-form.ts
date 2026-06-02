#!/usr/bin/env npx tsx
/**
 * Event form — time digits (1, 15, 930, 1230, 1900, 2400, 2560) + past date QA.
 */
import {
  isEventDateTodayOrFuture,
  normalizeTimeInput,
  validateCreateEventForm,
} from '../src/lib/event-form';
import { prepareEventFormForSubmit } from '../src/lib/event-form-submit';
import {
  normalizeTimeDisplayFromDigits,
  normalizeTimeDisplayFromInput,
  normalizeTimeFieldOnBlur,
  stripTimeInputDigits,
} from '../src/lib/event-time-input';

const QA_TODAY = '2026-05-31';
const QA_PAST_DATE = '2025-01-01';

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

function assertTimeDigits(digits: string, expected: string) {
  assert(
    normalizeTimeDisplayFromDigits(digits) === expected,
    `${digits} → ${expected}`,
  );
}

function assertTimeInvalid(digits: string) {
  assert(
    normalizeTimeDisplayFromDigits(digits) === null,
    `${digits} → invalid`,
  );
}

assertTimeDigits('1', '01:00');
assertTimeDigits('15', '15:00');
assertTimeDigits('930', '09:30');
assertTimeDigits('1230', '12:30');
assertTimeDigits('1900', '19:00');
assertTimeInvalid('2400');
assertTimeInvalid('2560');

assert(normalizeTimeDisplayFromInput('1900') === '19:00', 'input 1900 → 19:00');
assert(normalizeTimeDisplayFromInput('930') === '09:30', 'input 930 → 09:30');
assert(normalizeTimeDisplayFromInput('19:00') === '19:00', 'formatted 19:00 re-normalized');
assert(normalizeTimeFieldOnBlur('15') === '15:00', 'blur 15 → 15:00');
assert(normalizeTimeFieldOnBlur('1500') === '15:00', 'blur 1500 → 15:00 (not 01:50)');
assert(
  stripTimeInputDigits('01:5000') === '0150',
  'strip corrupt 01:5000 → digits only (max 4)',
);

assert(normalizeTimeInput('1900') === '19:00:00', 'DB 1900 → 19:00:00');
assert(normalizeTimeInput('930') === '09:30:00', 'DB 930 → 09:30:00');
assert(normalizeTimeInput('15') === '15:00:00', 'DB 15 → 15:00:00');

const submit1900 = prepareEventFormForSubmit(
  {
    eventName: 'QA',
    venueName: 'Venue',
    eventDate: QA_TODAY,
    startTime: '1900',
    maxPasses: '10',
  },
  { todayYmd: QA_TODAY },
);

assert(submit1900.values.startTime === '19:00', 'submit path 1900 → 19:00');
assert(submit1900.normalizedStartTime === '19:00:00', 'submit path stores 19:00:00');

const submit15 = prepareEventFormForSubmit(
  {
    eventName: 'QA',
    venueName: 'Venue',
    eventDate: QA_TODAY,
    startTime: '15',
    maxPasses: '10',
  },
  { todayYmd: QA_TODAY },
);

assert(submit15.values.startTime === '15:00', 'submit path 15 → 15:00');
assert(submit15.normalizedStartTime === '15:00:00', 'submit stores 15:00:00');

const submitInvalid = prepareEventFormForSubmit(
  {
    eventName: 'QA',
    venueName: 'Venue',
    eventDate: QA_TODAY,
    startTime: '2400',
    maxPasses: '10',
  },
  { todayYmd: QA_TODAY },
);

assert(
  submitInvalid.errors.startTime === 'Enter a valid time between 00:00 and 23:59.',
  'submit blocks 2400 after normalization',
);

const submitPast = prepareEventFormForSubmit(
  {
    eventName: 'QA',
    venueName: 'Venue',
    eventDate: QA_PAST_DATE,
    startTime: '19:00',
    maxPasses: '10',
  },
  { todayYmd: QA_TODAY },
);

assert(
  submitPast.errors.eventDate === 'Event date must be today or in the future.',
  'QA past date 2025-01-01 blocked on submit',
);

assert(!isEventDateTodayOrFuture(QA_PAST_DATE, QA_TODAY), '2025-01-01 is before QA today');

assert(
  validateCreateEventForm(
    {
      eventName: 'QA',
      venueName: 'Venue',
      eventDate: QA_PAST_DATE,
      startTime: '19:00',
      maxPasses: '10',
    },
    QA_TODAY,
  ).eventDate === 'Event date must be today or in the future.',
  'validateCreateEventForm blocks 2025-01-01 with fixed today',
);

if (failures > 0) {
  console.error(`\ncheck-event-form: ${failures} failure(s)`);
  process.exit(1);
}

console.log('\ncheck-event-form: all checks passed');
