#!/usr/bin/env npx tsx
/**
 * Validates pass link URL building (src/lib/pass-link.core.ts).
 * Run: npm run check:links
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  buildAbsolutePassLinkUrl,
  buildPassRoutePath,
  normalizePassLinkBaseUrl,
} from '../src/lib/pass-link.core';

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
    return false;
  }
  pass(message);
  return true;
}

assert(
  normalizePassLinkBaseUrl('808tix.vercel.app') === 'https://808tix.vercel.app',
  'prepends https:// when protocol is missing',
);

assert(
  normalizePassLinkBaseUrl('https://808tix.vercel.app/') === 'https://808tix.vercel.app',
  'removes trailing slash from base URL',
);

assert(
  normalizePassLinkBaseUrl('http://localhost:8081') === 'http://localhost:8081',
  'preserves http:// for local development',
);

const productionUrl = buildAbsolutePassLinkUrl('https://808tix.vercel.app', 'abc-123');

assert(
  productionUrl === 'https://808tix.vercel.app/pass/abc-123',
  'creates absolute /pass/{token} URL',
);

assert(/^https?:\/\//.test(productionUrl), 'pass URL always includes protocol');

const normalized = normalizePassLinkBaseUrl('808tix.vercel.app')!;
const fixedUrl = buildAbsolutePassLinkUrl(normalized, 'tok');

assert(!fixedUrl.includes('/events/'), 'pass URL is not nested under /events/{eventId}');

assert(!fixedUrl.startsWith('/pass/'), 'pass URL is not a root-relative path');

assert(
  fixedUrl === 'https://808tix.vercel.app/pass/tok',
  'bare host env does not produce route-relative pass links',
);

const relativeStyle = '808tix.vercel.app/pass/tok';
const simulatedCurrent =
  'http://localhost:8081/events/11111111-1111-1111-1111-111111111111/passes';
const resolvedRelative = new URL(relativeStyle, simulatedCurrent).href;

assert(
  fixedUrl !== resolvedRelative,
  'absolute pass URL differs from path-relative resolution under /events/.../passes',
);

if (resolvedRelative.includes('/events/') && resolvedRelative.includes('808tix.vercel.app')) {
  pass('confirmed relative host-only URLs would break under event routes (regression guard)');
}

const encoded = buildAbsolutePassLinkUrl('https://808tix.vercel.app', 'a b/c');

assert(encoded === 'https://808tix.vercel.app/pass/a%20b%2Fc', 'encodes token in path segment');

assert(
  buildPassRoutePath('abc-123') === '/pass/abc-123',
  'buildPassRoutePath returns in-app /pass/{token} route',
);

const passRowSource = readFileSync(
  join(process.cwd(), 'src/components/organizer/event-pass-list-row.tsx'),
  'utf8',
);

assert(
  passRowSource.includes('getPassRoute'),
  'View Guest Pass uses getPassRoute helper',
);

assert(
  passRowSource.includes('router.push(getPassRoute(pass.secure_token))'),
  'View Guest Pass navigates in-app via router.push',
);

assert(
  !passRowSource.includes('Linking.openURL(passUrl)'),
  'View Guest Pass does not open public pass URL via Linking',
);

assert(
  !passRowSource.includes('808tix.vercel.app'),
  'View Guest Pass row does not hardcode production pass origin',
);

assert(
  passRowSource.includes('buildPassLinkUrl(pass.secure_token)'),
  'share/SMS still uses centralized public pass URL helper',
);

if (failures > 0) {
  console.error(`\ncheck-pass-links: ${failures} failure(s)`);
  process.exit(1);
}

console.log('\ncheck-pass-links: all checks passed');
