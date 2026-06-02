#!/usr/bin/env npx tsx
/**
 * Event stats helpers (src/lib/event-stats.ts) — source guards only.
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

const statsSource = readFileSync(join(process.cwd(), 'src/lib/event-stats.ts'), 'utf8');
const detailHookSource = readFileSync(join(process.cwd(), 'src/hooks/use-event-detail.ts'), 'utf8');

assert(statsSource.includes('get_event_stats'), 'stats module calls get_event_stats RPC');
assert(statsSource.includes("'active', 'checked_in'"), 'issued counts active + checked_in');
assert(statsSource.includes('fetchEventStatsFromPasses'), 'passes table fallback exists');
assert(detailHookSource.includes('useFocusEffect'), 'event detail refetches on focus');
assert(detailHookSource.includes('silent'), 'event detail supports silent refetch');

if (failures > 0) {
  console.error(`\ncheck-event-stats: ${failures} failure(s)`);
  process.exit(1);
}

console.log('\ncheck-event-stats: all checks passed');
