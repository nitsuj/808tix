#!/usr/bin/env npx tsx
/**
 * Organizer auth form validation (src/lib/organizer-auth-form.ts).
 */
import {
  MIN_PASSWORD_LENGTH,
  validatePasswordResetRequest,
  validateResendConfirmationEmail,
  validateSignInForm,
  validateSignUpForm,
  validateUpdatePasswordForm,
} from '../src/lib/organizer-auth-form';

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

assert(
  Object.keys(validateSignInForm({ email: '', password: '' })).length >= 2,
  'sign in requires email and password',
);

assert(
  validateSignInForm({ email: 'organizer@venue.com', password: 'secret123' }).email === undefined,
  'valid sign in passes',
);

assert(
  validateSignUpForm({
    email: 'bad',
    password: 'short',
    confirmPassword: 'short',
  }).email === 'Enter a valid email address.',
  'invalid signup email blocked',
);

assert(
  validateSignUpForm({
    email: 'new@venue.com',
    password: 'a'.repeat(MIN_PASSWORD_LENGTH - 1),
    confirmPassword: 'a'.repeat(MIN_PASSWORD_LENGTH - 1),
  }).password === `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
  'short signup password blocked',
);

assert(
  validateSignUpForm({
    email: 'new@venue.com',
    password: 'password123',
    confirmPassword: 'password124',
  }).confirmPassword === 'Passwords do not match.',
  'mismatched passwords blocked',
);

assert(
  Object.keys(
    validateSignUpForm({
      email: 'new@venue.com',
      password: 'password123',
      confirmPassword: 'password123',
    }),
  ).length === 0,
  'valid signup passes',
);

assert(validateResendConfirmationEmail('') === 'Email is required.', 'resend requires email');

assert(
  validateResendConfirmationEmail('organizer@venue.com') === null,
  'valid resend email passes',
);

assert(validatePasswordResetRequest('') === 'Email is required.', 'password reset requires email');

assert(
  validatePasswordResetRequest('organizer@venue.com') === null,
  'valid password reset email passes',
);

assert(
  validateUpdatePasswordForm({ password: 'short', confirmPassword: 'short' }).password ===
    `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
  'short update password blocked',
);

assert(
  validateUpdatePasswordForm({ password: 'password123', confirmPassword: 'password124' })
    .confirmPassword === 'Passwords do not match.',
  'mismatched update passwords blocked',
);

assert(
  Object.keys(
    validateUpdatePasswordForm({ password: 'password123', confirmPassword: 'password123' }),
  ).length === 0,
  'valid update password passes',
);

if (failures > 0) {
  console.error(`\ncheck-organizer-auth-form: ${failures} failure(s)`);
  process.exit(1);
}

console.log('\ncheck-organizer-auth-form: all checks passed');
