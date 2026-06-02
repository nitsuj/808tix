#!/usr/bin/env npx tsx
/**
 * Event stats counting (src/lib/event-stats.ts).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { countPassRowsForEventStats } from '../src/lib/event-stats.core';

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

const counts = countPassRowsForEventStats([
  { status: 'active' },
  { status: 'active' },
  { status: 'checked_in' },
  { status: 'voided' },
]);

assert(counts.issuedCount === 3, 'issued_count includes active + checked_in only');
assert(counts.checkedInCount === 1, 'checked_in_count counts checked_in rows');

const afterIssue = countPassRowsForEventStats([{ status: 'active' }]);

assert(afterIssue.issuedCount === 1, 'issued_count increments when active pass exists');

const statsSource = readFileSync(join(process.cwd(), 'src/lib/event-stats.ts'), 'utf8');
const detailHookSource = readFileSync(join(process.cwd(), 'src/hooks/use-event-detail.ts'), 'utf8');
const issueSource = readFileSync(join(process.cwd(), 'src/app/events/[eventId]/issue.tsx'), 'utf8');
const indexSource = readFileSync(join(process.cwd(), 'src/app/events/[eventId]/index.tsx'), 'utf8');

assert(statsSource.includes('get_event_stats'), 'stats module calls get_event_stats RPC');
assert(detailHookSource.includes('useFocusEffect'), 'event detail refetches on focus');
assert(indexSource.includes('refreshStats'), 'event detail refetches when returning from issue');
assert(issueSource.includes('refreshStats=1'), 'issue pass navigates with refreshStats');

if (failures > 0) {
  console.error(`\ncheck-event-stats: ${failures} failure(s)`);
  process.exit(1);
}

console.log('\ncheck-event-stats: all checks passed');
