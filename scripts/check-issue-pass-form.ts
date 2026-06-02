#!/usr/bin/env npx tsx
/**
 * Issue Pass contact validation tests (src/lib/issue-pass-form.ts).
 */
import {
  combineGuestName,
  CONTACT_REQUIRED_MESSAGE,
  validateIssuePassForm,
  type IssuePassFormValues,
} from '../src/lib/issue-pass-form';

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

const base: IssuePassFormValues = {
  guestFirstName: 'Alex',
  guestLastName: 'Rivera',
  passType: 'General Admission',
  guestEmail: '',
  guestPhone: '',
};

assert(combineGuestName('Alex', 'Rivera') === 'Alex Rivera', 'combineGuestName joins first and last');

assert(
  validateIssuePassForm({ ...base, guestFirstName: '', guestLastName: '' }).guestFirstName ===
    'First name is required.',
  'missing first name → blocked',
);

assert(
  validateIssuePassForm({ ...base, guestLastName: '' }).guestLastName === 'Last name is required.',
  'missing last name → blocked',
);

assert(
  validateIssuePassForm({ ...base, guestEmail: '', guestPhone: '' }).guestPhone ===
    CONTACT_REQUIRED_MESSAGE,
  'no phone + no email → blocked',
);

assert(
  Object.keys(
    validateIssuePassForm({ ...base, guestEmail: '', guestPhone: '808-555-0100' }),
  ).length === 0,
  'valid first + last + phone → validation passes',
);

assert(
  Object.keys(
    validateIssuePassForm({ ...base, guestEmail: 'alex@example.com', guestPhone: '' }),
  ).length === 0,
  'valid first + last + email → validation passes',
);

assert(
  validateIssuePassForm({ ...base, guestEmail: 'not-an-email', guestPhone: '' }).guestEmail ===
    'Enter a valid email address.',
  'invalid email only → blocked',
);

assert(
  Boolean(
    validateIssuePassForm({ ...base, guestEmail: '', guestPhone: '123' }).guestPhone,
  ),
  'invalid phone only → blocked',
);

assert(
  Object.keys(
    validateIssuePassForm({
      ...base,
      guestEmail: 'alex@example.com',
      guestPhone: '808-555-0100',
    }),
  ).length === 0,
  'valid phone + valid email → pass issued (validation passes)',
);

if (failures > 0) {
  console.error(`\ncheck-issue-pass-form: ${failures} failure(s)`);
  process.exit(1);
}

console.log('\ncheck-issue-pass-form: all checks passed');
