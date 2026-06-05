#!/usr/bin/env npx tsx
/**
 * Stale refresh token recovery — local session cleanup without breaking auth redirects.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { isStaleRefreshTokenError } from '../src/lib/auth-stale-token';

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

assert(
  isStaleRefreshTokenError({ message: 'Invalid Refresh Token: Refresh Token Not Found' }),
  'detects Invalid Refresh Token: Refresh Token Not Found',
);
assert(
  isStaleRefreshTokenError({ code: 'refresh_token_not_found', message: 'Refresh token not found' }),
  'detects refresh_token_not_found code',
);
assert(
  !isStaleRefreshTokenError({ message: 'Invalid login credentials' }),
  'does not treat invalid login credentials as stale refresh token',
);
assert(
  !isStaleRefreshTokenError({ message: 'Network request failed' }),
  'does not treat network errors as stale refresh token',
);

const authContext = readFileSync(join(ROOT, 'src/contexts/auth-context.tsx'), 'utf8');
const authCallback = readFileSync(join(ROOT, 'src/lib/auth-callback-url.ts'), 'utf8');
const redirectHook = readFileSync(join(ROOT, 'src/hooks/use-organizer-auth-redirect.ts'), 'utf8');

assert(
  authContext.includes('isStaleRefreshTokenError') &&
    authContext.includes('clearStaleLocalAuthSession') &&
    authContext.includes('recoverFromStaleRefreshToken'),
  'auth context implements stale refresh token recovery',
);
assert(
  authContext.match(/getSession\(\)[\s\S]*sessionError/) &&
    authContext.match(/isStaleRefreshTokenError\(sessionError\)/),
  'auth bootstrap handles getSession refresh errors',
);
assert(
  authContext.match(/refreshSession[\s\S]*isStaleRefreshTokenError\(error\)/),
  'refreshSession clears stale local session instead of throwing',
);
assert(
  authContext.match(/signOut[\s\S]*isStaleRefreshTokenError\(error\)/) &&
    authContext.includes('throw error'),
  'signOut still throws unexpected auth errors',
);
assert(
  authCallback.includes('isStaleRefreshTokenError') &&
    authCallback.includes('clearStaleLocalAuthSession'),
  'auth callback clears stale local session on getSession refresh failure',
);
assert(
  redirectHook.includes('useEffect') && redirectHook.includes("authState === 'unauthenticated'"),
  'organizer auth redirect remains effect-based',
);
assert(
  readFileSync(join(ROOT, 'src/lib/auth-session-recovery.ts'), 'utf8').includes(
    "signOut({ scope: 'local' })",
  ),
  'clearStaleLocalAuthSession uses local signOut scope',
);

if (failures > 0) {
  console.error(`\ncheck-auth-session-recovery: ${failures} failure(s)`);
  process.exit(1);
}

console.log('\ncheck-auth-session-recovery: all checks passed');
