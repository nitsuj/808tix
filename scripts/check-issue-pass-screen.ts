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

assert(source.includes('ORGANIZER_MOBILE_VIEWPORT_WIDTH'), 'issue pass uses shared 390px mobile viewport');
assert(source.includes('OrganizerMobileViewport'), 'issue pass wraps content in OrganizerMobileViewport');
assert(
  source.match(/OrganizerMobileViewport[\s\S]*background=\{[\s\S]*EventScreenBackground/),
  'issue pass hoists EventScreenBackground to full viewport frame',
);
assert(source.includes('formatEventDateTimeLong'), 'issue pass shows canonical event date with year');
assert(source.includes('EventScreenBackground'), 'issue pass uses shared event screen background');
assert(source.includes('passScreen.credential'), 'issue pass uses credential command panel tokens');
assert(source.includes('canIssuePassesForEvent'), 'issue pass draft/live guard preserved');
assert(source.includes('issuePass({'), 'issue pass still calls issuePass mutation');
assert(source.includes('validateIssuePassForm'), 'issue pass validation rules unchanged');

if (failures > 0) {
  console.error(`\ncheck-issue-pass-screen: ${failures} failure(s)`);
  process.exit(1);
}

console.log('\ncheck-issue-pass-screen: all checks passed');
