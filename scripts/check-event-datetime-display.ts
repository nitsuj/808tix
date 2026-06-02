#!/usr/bin/env npx tsx
/**
 * Canonical date/time formatting (src/lib/event-datetime-display.ts).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  formatEventDateLong,
  formatEventDateTimeLong,
  formatEventDateTimeTicketUpper,
} from '../src/lib/event-datetime-display';

let failures = 0;

function fail(message: string) {
  console.error(`✗ ${message}`);
  failures += 1;
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    fail(message);
  } else {
    console.log(`✓ ${message}`);
  }
}

const EVENT_DATE = '2026-06-10';

assert(formatEventDateLong(EVENT_DATE) === 'Jun 10, 2026', 'organizer date includes year');

assert(
  formatEventDateTimeLong(EVENT_DATE, '19:00:00') === 'Jun 10, 2026 · 7:00 PM',
  'organizer datetime uses canonical separators + year',
);

assert(
  formatEventDateTimeLong(EVENT_DATE, '19:00') === 'Jun 10, 2026 · 7:00 PM',
  'organizer datetime accepts HH:MM start time',
);

assert(
  (() => {
    const actual = formatEventDateTimeTicketUpper(EVENT_DATE, '19:00:00');
    const expected = 'WED, JUN 10, 2026 · 7:00 PM';
    if (actual !== expected) {
      console.error(`Expected ticket datetime: ${expected}`);
      console.error(`Actual ticket datetime:   ${actual}`);
    }
    return actual === expected;
  })(),
  'ticket datetime includes weekday + year (uppercase, canonical)',
);

assert(
  formatEventDateTimeTicketUpper(EVENT_DATE, null) === 'WED, JUN 10, 2026',
  'ticket date without start time still includes year',
);

const guestPassSource = readFileSync(join(process.cwd(), 'src/app/pass/[token].tsx'), 'utf8');
assert(
  guestPassSource.includes('formatEventDateTimeTicketUpper'),
  'guest pass uses canonical ticket date formatter',
);

const walletSource = readFileSync(
  join(process.cwd(), 'supabase/functions/wallet-apple/pass-model.ts'),
  'utf8',
);
assert(
  walletSource.includes('const year = parsed.getFullYear();'),
  'apple wallet header formatter includes event year',
);

if (failures > 0) {
  console.error(`\ncheck-event-datetime-display: ${failures} failure(s)`);
  process.exit(1);
}

console.log('\ncheck-event-datetime-display: all checks passed');

