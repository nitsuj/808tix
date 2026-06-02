#!/usr/bin/env npx tsx
/**
 * Auth callback URL parsing (src/lib/auth-callback-url.core.ts).
 */
import {
  getAuthCallbackIntent,
  hasSupabaseAuthCallbackParams,
  parseAuthCallbackParams,
  stripAuthCallbackFromUrl,
} from '../src/lib/auth-callback-url.core';

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

const hashSignup =
  'https://808tix.vercel.app/#access_token=abc&refresh_token=def&expires_in=3600&token_type=bearer&type=signup';

const hashParams = parseAuthCallbackParams(hashSignup);

assert(hasSupabaseAuthCallbackParams(hashParams), 'detects access_token in hash');
assert(getAuthCallbackIntent(hashParams).isSignupConfirmation, 'signup hash is signup confirmation');

const pkceUrl = 'https://808tix.vercel.app/?code=auth-code-123';

assert(hasSupabaseAuthCallbackParams(parseAuthCallbackParams(pkceUrl)), 'detects PKCE code in query');

const tokenHashUrl = 'https://808tix.vercel.app/?token_hash=th123&type=email';

assert(
  getAuthCallbackIntent(parseAuthCallbackParams(tokenHashUrl)).isSignupConfirmation,
  'token_hash email type is signup confirmation',
);

assert(
  stripAuthCallbackFromUrl(hashSignup) === 'https://808tix.vercel.app/',
  'strips hash tokens from URL',
);

assert(
  stripAuthCallbackFromUrl('https://808tix.vercel.app/?code=abc&type=signup') ===
    'https://808tix.vercel.app/',
  'strips query auth params',
);

const errorUrl = 'https://808tix.vercel.app/#error=access_denied&error_description=Expired';

assert(getAuthCallbackIntent(parseAuthCallbackParams(errorUrl)).hasError, 'detects error callback');

assert(
  !hasSupabaseAuthCallbackParams(parseAuthCallbackParams('https://808tix.vercel.app/')),
  'plain app URL is not a callback',
);

if (failures > 0) {
  console.error(`\ncheck-auth-callback-url: ${failures} failure(s)`);
  process.exit(1);
}

console.log('\ncheck-auth-callback-url: all checks passed');
