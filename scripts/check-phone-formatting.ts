#!/usr/bin/env npx tsx
/**
 * US phone formatting helpers (src/lib/phone-validation.ts).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  formatPhoneNumberForDisplay,
  formatPhoneNumberInput,
  normalizePhoneNumber,
} from '../src/lib/phone-validation';

const ROOT = process.cwd();

let failures = 0;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`✗ ${message}`);
    failures += 1;
    return;
  }
  console.log(`✓ ${message}`);
}

assert(
  formatPhoneNumberInput('8085551234') === '(808) 555-1234',
  'formatPhoneNumberInput formats full US number',
);
assert(
  formatPhoneNumberInput('808555') === '(808) 555',
  'formatPhoneNumberInput formats partial US number',
);
assert(
  formatPhoneNumberForDisplay('+18085551234') === '(808) 555-1234',
  'formatPhoneNumberForDisplay formats stored E.164 US number',
);
assert(
  formatPhoneNumberForDisplay('8085551234') === '(808) 555-1234',
  'formatPhoneNumberForDisplay formats raw digit string',
);
assert(
  normalizePhoneNumber('(808) 555-1234') === '+18085551234',
  'normalizePhoneNumber strips display formatting',
);
assert(normalizePhoneNumber('') === '', 'normalizePhoneNumber empty input');

const issuePassScreen = readFileSync(join(ROOT, 'src/app/events/[eventId]/issue.tsx'), 'utf8');
const passListRow = readFileSync(
  join(ROOT, 'src/components/organizer/event-pass-list-row.tsx'),
  'utf8',
);

assert(
  issuePassScreen.includes('formatPhoneNumberInput') &&
    issuePassScreen.includes('normalizePhoneNumber(guestPhone)'),
  'issue pass formats input and normalizes on submit',
);
assert(
  issuePassScreen.includes('formatPhoneNumberForDisplay(createdPass.guest_phone)'),
  'issue pass success shows formatted phone',
);
assert(
  passListRow.includes('formatPhoneNumberForDisplay(pass.guest_phone)'),
  'pass list row shows formatted phone',
);

if (failures > 0) {
  console.error(`\ncheck-phone-formatting: ${failures} failure(s)`);
  process.exit(1);
}

console.log('\ncheck-phone-formatting: all checks passed');
