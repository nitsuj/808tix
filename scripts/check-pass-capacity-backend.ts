#!/usr/bin/env npx tsx
/**
 * Server-side atomic pass capacity enforcement.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const MIGRATION_PATH = join(
  ROOT,
  'supabase/migrations/20260605143000_pass_capacity_atomic_lock.sql',
);
const ORIGINAL_CAPACITY_MIGRATION = join(
  ROOT,
  'supabase/migrations/20250610000009_passes_capacity_on_insert.sql',
);
const PUBLISHED_GUARD_MIGRATION = join(
  ROOT,
  'supabase/migrations/20260602143000_enforce_published_event_pass_ops.sql',
);
const VERIFICATION_PATH = join(ROOT, 'supabase/verification-capacity.sql');
const CAPACITY_COLUMN_MIGRATION = join(
  ROOT,
  'supabase/migrations/20250610000008_events_capacity.sql',
);

const migration = readFileSync(MIGRATION_PATH, 'utf8');
const originalCapacity = readFileSync(ORIGINAL_CAPACITY_MIGRATION, 'utf8');
const publishedGuard = readFileSync(PUBLISHED_GUARD_MIGRATION, 'utf8');
const verification = readFileSync(VERIFICATION_PATH, 'utf8');
const capacityColumn = readFileSync(CAPACITY_COLUMN_MIGRATION, 'utf8');

let failures = 0;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`✗ ${message}`);
    failures += 1;
    return;
  }
  console.log(`✓ ${message}`);
}

assert(
  migration.includes('create or replace function public.prevent_pass_over_capacity'),
  'migration replaces prevent_pass_over_capacity',
);
assert(
  migration.includes('for update'),
  'capacity trigger locks parent event row with FOR UPDATE',
);
assert(
  migration.includes('event_issued_pass_count(new.event_id)'),
  'capacity check uses existing issued pass count helper',
);
assert(
  migration.includes("'Event is at capacity (% of % passes issued)'"),
  'capacity error message preserved',
);
assert(
  !migration.toLowerCase().includes('drop trigger'),
  'capacity migration does not remove existing trigger',
);

assert(
  capacityColumn.includes("and status in ('active', 'checked_in')"),
  'issued count excludes voided passes',
);

assert(
  publishedGuard.includes('passes_prevent_unpublished_event_insert'),
  'published-event insert guard remains in prior migration',
);
assert(
  !migration.includes('prevent_pass_insert_unpublished_event'),
  'capacity migration does not alter published-event guard',
);

assert(
  verification.includes("'published'"),
  'capacity verification uses published events for pass inserts',
);
assert(
  verification.includes('Expected third pass insert at capacity to fail'),
  'capacity verification asserts insert at capacity fails',
);
assert(
  verification.includes('SELECT ... FOR UPDATE'),
  'capacity verification documents FOR UPDATE race protection',
);
assert(
  verification.includes('Voided pass should not count toward capacity'),
  'capacity verification preserves voided-pass semantics',
);

assert(
  originalCapacity.includes('passes_prevent_over_capacity'),
  'original capacity trigger name unchanged',
);

if (failures > 0) {
  console.error(`\ncheck-pass-capacity-backend: ${failures} failure(s)`);
  process.exit(1);
}

console.log('\ncheck-pass-capacity-backend: all checks passed');
