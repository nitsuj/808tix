#!/usr/bin/env npx tsx
/**
 * Command Center event visibility (src/lib/organizer-dashboard-events.ts).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Event } from '../src/lib/database.types';
import {
  filterOrganizerDashboardEvents,
  isOrganizerDashboardEvent,
} from '../src/lib/organizer-dashboard-events';

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

function event(overrides: Partial<Event> & Pick<Event, 'status' | 'event_date'>): Event {
  return {
    id: 'e1',
    organizer_id: 'o1',
    slug: 'test',
    name: 'Test',
    venue_name: 'Venue',
    start_time: '19:00:00',
    capacity: 100,
    image_url: null,
    created_at: '',
    updated_at: '',
    ...overrides,
  };
}

const pastDraft = event({ status: 'draft', event_date: '2020-01-01' });
const futureDraft = event({ status: 'draft', event_date: '2099-12-31', id: 'e2' });
const completed = event({ status: 'completed', event_date: '2099-12-31', id: 'e3' });
const cancelled = event({ status: 'cancelled', event_date: '2099-12-31', id: 'e4' });
const pastPublished = event({ status: 'published', event_date: '2019-06-01', id: 'e5' });

assert(isOrganizerDashboardEvent(pastDraft), 'past draft event → visible');
assert(isOrganizerDashboardEvent(futureDraft), 'future draft event → visible');
assert(isOrganizerDashboardEvent(pastPublished), 'past published event → visible');
assert(!isOrganizerDashboardEvent(completed), 'completed event → hidden');
assert(!isOrganizerDashboardEvent(cancelled), 'cancelled event → hidden');

const visible = filterOrganizerDashboardEvents([
  pastDraft,
  futureDraft,
  completed,
  cancelled,
  pastPublished,
]);

assert(visible.length === 3, 'dashboard list includes past draft/published + future draft');
assert(visible.some((row) => row.id === pastDraft.id), 'past draft in dashboard list');
assert(!visible.some((row) => row.id === completed.id), 'completed not in dashboard list');

const hookSource = readFileSync(join(process.cwd(), 'src/hooks/use-organizer-events.ts'), 'utf8');

assert(hookSource.includes('useEffect'), 'organizer events hook loads on mount');
assert(hookSource.includes('filterOrganizerDashboardEvents'), 'hook uses dashboard filter');

const dashboardSource = readFileSync(
  join(process.cwd(), 'src/components/organizer/organizer-dashboard.tsx'),
  'utf8',
);

assert(dashboardSource.includes('dashboardEvents'), 'dashboard renders dashboardEvents');
assert(
  dashboardSource.includes('formatEventDateTimeLong'),
  'dashboard uses canonical event date formatter',
);
assert(dashboardSource.includes('filterDashboardEventsByStatus'), 'dashboard filters by draft/live');
assert(dashboardSource.includes("'all', 'live', 'draft'"), 'dashboard has All/Live/Draft chips');

const emptyStateIndex = dashboardSource.indexOf('No events yet');
const createButtonIndex = dashboardSource.indexOf('+ Create Event');
assert(
  emptyStateIndex > -1 && createButtonIndex > -1 && emptyStateIndex < createButtonIndex,
  'no-events empty state appears before Create Event CTA',
);

if (failures > 0) {
  console.error(`\ncheck-organizer-dashboard-events: ${failures} failure(s)`);
  process.exit(1);
}

console.log('\ncheck-organizer-dashboard-events: all checks passed');
