#!/usr/bin/env npx tsx
/**
 * Issue Pass screen visual wiring (src/app/events/[eventId]/issue.tsx).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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

const source = readFileSync(join(process.cwd(), 'src/app/events/[eventId]/issue.tsx'), 'utf8');

assert(source.includes('MOBILE_VIEWPORT_WIDTH = 390'), 'issue pass uses 390px mobile viewport');
assert(source.includes('MobileViewport'), 'issue pass wraps content in MobileViewport');
assert(source.includes('formatEventDateTimeLong'), 'issue pass shows canonical event date with year');
assert(source.includes('ArtworkEnvironment'), 'issue pass uses artwork environment when available');
assert(source.includes('passScreen.credential'), 'issue pass uses credential command panel tokens');
assert(source.includes('canIssuePassesForEvent'), 'issue pass draft/live guard preserved');
assert(source.includes('issuePass({'), 'issue pass still calls issuePass mutation');
assert(source.includes('validateIssuePassForm'), 'issue pass validation rules unchanged');

if (failures > 0) {
  console.error(`\ncheck-issue-pass-screen: ${failures} failure(s)`);
  process.exit(1);
}

console.log('\ncheck-issue-pass-screen: all checks passed');
