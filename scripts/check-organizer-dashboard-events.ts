#!/usr/bin/env npx tsx
/**
 * Command Center event list rules (src/lib/organizer-dashboard-events.ts).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Event } from '../src/lib/database.types';
import { isOrganizerDashboardEvent } from '../src/lib/organizer-dashboard-events';

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

const base = {
  id: 'e1',
  organizer_id: 'o1',
  slug: 'test',
  name: 'Test',
  venue_name: 'Venue',
  event_date: '2020-01-01',
  start_time: '19:00:00',
  capacity: 100,
  image_url: null,
  created_at: '',
  updated_at: '',
} satisfies Event;

assert(isOrganizerDashboardEvent({ ...base, status: 'draft' }), 'draft event shown');
assert(isOrganizerDashboardEvent({ ...base, status: 'published' }), 'published event shown');
assert(!isOrganizerDashboardEvent({ ...base, status: 'completed' }), 'completed hidden');
assert(!isOrganizerDashboardEvent({ ...base, status: 'cancelled' }), 'cancelled hidden');

const dashboardSource = readFileSync(
  join(process.cwd(), 'src/components/organizer/organizer-dashboard.tsx'),
  'utf8',
);

assert(dashboardSource.includes('dashboardEvents'), 'dashboard uses dashboardEvents list');
assert(!dashboardSource.includes('upcomingEvents'), 'dashboard no longer filters by upcoming date only');

if (failures > 0) {
  console.error(`\ncheck-organizer-dashboard-events: ${failures} failure(s)`);
  process.exit(1);
}

console.log('\ncheck-organizer-dashboard-events: all checks passed');
