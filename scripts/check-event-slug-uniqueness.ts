#!/usr/bin/env npx tsx
/**
 * Slug uniqueness must be organizer-scoped.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATION_PATH = join(
  process.cwd(),
  'supabase/migrations/20260602000100_events_slug_unique_per_organizer.sql',
);
const SLUG_HELPER_PATH = join(process.cwd(), 'src/lib/event-slug.ts');
const CREATE_EVENT_PATH = join(process.cwd(), 'src/app/events/create.tsx');

const migration = readFileSync(MIGRATION_PATH, 'utf8');
const slugHelper = readFileSync(SLUG_HELPER_PATH, 'utf8');
const createEvent = readFileSync(CREATE_EVENT_PATH, 'utf8');

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
  migration.includes('drop constraint if exists events_slug_unique'),
  'migration drops legacy global slug unique constraint',
);
assert(
  migration.includes('unique (organizer_id, slug)'),
  'migration adds organizer-scoped slug uniqueness',
);
assert(
  slugHelper.includes(".eq('organizer_id', organizerId)"),
  'slug helper checks uniqueness within organizer',
);
assert(
  createEvent.includes('generateUniqueEventSlug(eventName, organizerId)'),
  'create event uses organizer-scoped slug generation',
);

if (failures > 0) {
  console.error(`\ncheck-event-slug-uniqueness: ${failures} failure(s)`);
  process.exit(1);
}

console.log('\ncheck-event-slug-uniqueness: all checks passed');

