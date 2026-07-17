#!/usr/bin/env npx tsx
/**
 * Launch stability: signup confirmation, password recovery UI, Resend SMTP docs,
 * and auth Playwright coverage (not inbox delivery).
 */
import { existsSync, readFileSync } from 'node:fs';
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

function warn(message: string) {
  console.warn(`! ${message}`);
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
const resendDoc = readFileSync(join(ROOT, 'docs/AUTH_EMAIL_RESEND.md'), 'utf8');
const authQa = readFileSync(join(ROOT, 'qa/tests/auth-web.spec.ts'), 'utf8');
const qaWeb = readFileSync(join(ROOT, 'scripts/qa-web.ts'), 'utf8');

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
    indexSource.includes('testID="auth-forgot-password"') &&
    indexSource.includes('requestPasswordReset') &&
    indexSource.includes('UpdatePasswordScreen') &&
    indexSource.includes('PasswordResetSentScreen') &&
    indexSource.includes('Send Reset Link') &&
    indexSource.includes('Update Password'),
  'login screen exposes visible forgot password, reset sent, and update password flows',
);

assert(
  launchDoc.includes(
    'Supabase Dashboard → Authentication → Providers → Email → Confirm Email must be ON.',
  ),
  'launch docs require Confirm Email ON in Supabase dashboard',
);

assert(
  resendDoc.includes('smtp.resend.com') &&
    resendDoc.includes('Port') &&
    resendDoc.includes('587') &&
    resendDoc.includes('Username') &&
    resendDoc.includes('resend') &&
    resendDoc.includes('Confirm Email: ON') &&
    resendDoc.includes('https://808tickets.com') &&
    resendDoc.includes('http://localhost:8081/**') &&
    resendDoc.includes('AUTH_SMTP_OPERATOR_CONFIRMED'),
  'AUTH_EMAIL_RESEND docs include Resend SMTP + redirect URL checklist',
);

assert(
  authQa.includes("getByTestId('auth-forgot-password')") &&
    authQa.includes('06-auth-default.png') &&
    authQa.includes('07-auth-forgot-password.png') &&
    authQa.includes('08-auth-reset-sent.png') &&
    authQa.includes('09-auth-check-email.png') &&
    authQa.includes('Check your email'),
  'Playwright auth-web QA covers forgot password + check-email with screenshots',
);

assert(
  qaWeb.includes('06-auth-default.png') &&
    qaWeb.includes('09-auth-check-email.png') &&
    qaWeb.includes('auth default page shows Forgot password'),
  'qa:web summary expects auth screenshot artifacts',
);

const operatorConfirmed = process.env.AUTH_SMTP_OPERATOR_CONFIRMED?.trim() === 'true';
const requireConfirmation = process.env.REQUIRE_AUTH_SMTP_CONFIRMATION?.trim() === 'true';

if (operatorConfirmed) {
  pass('AUTH_SMTP_OPERATOR_CONFIRMED=true (operator asserts Resend SMTP + Confirm Email configured)');
} else {
  warn(
    'AUTH_SMTP_OPERATOR_CONFIRMED is not true — inbox delivery via Resend SMTP is NOT verified by CI.',
  );
  warn(
    'Complete docs/AUTH_EMAIL_RESEND.md checklist on the hosted Supabase project, then set AUTH_SMTP_OPERATOR_CONFIRMED=true.',
  );

  if (requireConfirmation) {
    fail(
      'REQUIRE_AUTH_SMTP_CONFIRMATION=true but AUTH_SMTP_OPERATOR_CONFIRMED is not true (external SMTP blocker)',
    );
  }
}

if (failures > 0) {
  console.error(`\ncheck-auth-launch-stability: ${failures} failure(s)`);
  process.exit(1);
}

console.log('\ncheck-auth-launch-stability: all checks passed');
