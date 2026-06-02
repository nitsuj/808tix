#!/usr/bin/env npx tsx
/**
 * Auth email redirect URL tests (src/lib/auth-redirect-url.core.ts).
 */
import {
  buildAuthEmailRedirectUrl,
  resolveAuthEmailRedirectOriginFromSources,
} from '../src/lib/auth-redirect-url.core';

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
  resolveAuthEmailRedirectOriginFromSources('https://808tix.vercel.app', null) ===
    'https://808tix.vercel.app',
  'web origin used when present',
);

assert(
  resolveAuthEmailRedirectOriginFromSources(null, '808tix.vercel.app') === 'https://808tix.vercel.app',
  'env fallback prepends https',
);

assert(
  resolveAuthEmailRedirectOriginFromSources('http://localhost:8081', '808tix.vercel.app') ===
    'http://localhost:8081',
  'web origin wins over env for local dev',
);

assert(
  buildAuthEmailRedirectUrl('https://808tix.vercel.app') === 'https://808tix.vercel.app/',
  'redirect URL ends with slash',
);

if (failures > 0) {
  console.error(`\ncheck-auth-redirect-url: ${failures} failure(s)`);
  process.exit(1);
}

console.log('\ncheck-auth-redirect-url: all checks passed');
