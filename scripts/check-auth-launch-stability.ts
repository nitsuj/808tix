#!/usr/bin/env npx tsx
/**
 * Launch stability: signup confirmation, password recovery UI, no admin createUser.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();

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

const authContext = readFileSync(join(ROOT, 'src/contexts/auth-context.tsx'), 'utf8');
const indexSource = readFileSync(join(ROOT, 'src/app/index.tsx'), 'utf8');
const checkEmailSource = readFileSync(
  join(ROOT, 'src/components/organizer/signup-check-email-screen.tsx'),
  'utf8',
);
const launchDoc = readFileSync(join(ROOT, 'docs/LAUNCH_STABILITY.md'), 'utf8');

assert(
  authContext.includes('supabase.auth.signUp') &&
    authContext.includes('emailRedirectTo') &&
    authContext.includes('resolveAuthEmailRedirectUrl'),
  'signup uses signUp with emailRedirectTo from auth redirect helper',
);

assert(
  !authContext.includes('auth.admin') && !authContext.includes('createUser('),
  'auth context does not admin-create users for signup',
);

assert(
  authContext.includes('needsEmailConfirmation') &&
    authContext.includes('data.user && !data.session'),
  'signup surfaces needsEmailConfirmation when user exists without session',
);

assert(
  indexSource.includes('SignUpCheckEmailScreen') &&
    indexSource.includes('needsEmailConfirmation'),
  'index shows check-email screen when confirmation is required',
);

assert(
  /check your email|Check your email/i.test(checkEmailSource) ||
    /check your email|Check your email/i.test(indexSource),
  'copy indicates email verification when appropriate',
);

assert(
  authContext.includes('resetPasswordForEmail') &&
    authContext.includes('requestPasswordReset') &&
    authContext.includes('updateUser({ password })') &&
    authContext.includes('updatePassword') &&
    authContext.includes('PASSWORD_RECOVERY') &&
    authContext.includes('passwordRecoveryPending'),
  'password recovery uses resetPasswordForEmail, updateUser, and recovery pending state',
);

assert(
  indexSource.includes('Forgot password?') &&
    indexSource.includes('requestPasswordReset') &&
    indexSource.includes('UpdatePasswordScreen') &&
    indexSource.includes('PasswordResetSentScreen') &&
    indexSource.includes('Send Reset Link') &&
    indexSource.includes('Update Password'),
  'login screen exposes forgot password, reset sent, and update password flows',
);

assert(
  launchDoc.includes(
    'Supabase Dashboard → Authentication → Providers → Email → Confirm Email must be ON.',
  ),
  'launch docs require Confirm Email ON in Supabase dashboard',
);

if (failures > 0) {
  console.error(`\ncheck-auth-launch-stability: ${failures} failure(s)`);
  process.exit(1);
}

console.log('\ncheck-auth-launch-stability: all checks passed');
