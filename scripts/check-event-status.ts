#!/usr/bin/env npx tsx
/**
 * Draft vs Live event status guards and UI wiring.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { EventStatus } from '../src/lib/database.types';
import {
  canIssuePassesForEvent,
  canScanPassesForEvent,
  filterDashboardEventsByStatus,
  getEventStatusPillLabel,
  getIssuePassBlockedMessage,
  getScanBlockedMessage,
  isEventDraft,
  isEventLive,
  PUBLISH_BEFORE_ISSUE_MESSAGE,
} from '../src/lib/event-status';

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

function eventStatus(status: EventStatus) {
  return { status };
}

assert(isEventLive('published'), 'published → live');
assert(!isEventLive('draft'), 'draft → not live');
assert(isEventDraft('draft'), 'draft → draft');
assert(!isEventDraft('published'), 'published → not draft');

assert(canIssuePassesForEvent('published'), 'published can issue');
assert(!canIssuePassesForEvent('draft'), 'draft cannot issue');
assert(canScanPassesForEvent('published'), 'published can scan');
assert(!canScanPassesForEvent('draft'), 'draft cannot scan');

assert(getEventStatusPillLabel('published') === 'LIVE', 'pill label LIVE');
assert(getEventStatusPillLabel('draft') === 'DRAFT', 'pill label DRAFT');

assert(
  getIssuePassBlockedMessage('draft') === PUBLISH_BEFORE_ISSUE_MESSAGE,
  'issue blocked message for draft',
);
assert(getIssuePassBlockedMessage('published') === null, 'issue not blocked when live');

assert(getScanBlockedMessage('draft') !== null, 'scan blocked message for draft');
assert(getScanBlockedMessage('published') === null, 'scan not blocked when live');

const mixed = [
  eventStatus('draft'),
  eventStatus('published'),
  eventStatus('draft'),
  eventStatus('completed'),
];

assert(
  filterDashboardEventsByStatus(mixed, 'live').length === 1,
  'dashboard live filter returns published only',
);
assert(
  filterDashboardEventsByStatus(mixed, 'draft').length === 2,
  'dashboard draft filter returns drafts only',
);
assert(filterDashboardEventsByStatus(mixed, 'all').length === 4, 'dashboard all filter unchanged');

const issuePassSource = readFileSync(join(process.cwd(), 'src/lib/issue-pass.ts'), 'utf8');
assert(
  issuePassSource.includes('getIssuePassBlockedMessage'),
  'issuePass checks event status before insert',
);
assert(
  issuePassSource.includes(PUBLISH_BEFORE_ISSUE_MESSAGE) ||
    issuePassSource.includes('getIssuePassBlockedMessage'),
  'issuePass uses publish-before-issue guard',
);

const validateScanSource = readFileSync(join(process.cwd(), 'src/lib/validate-pass-scan.ts'), 'utf8');
assert(validateScanSource.includes('canScanPassesForEvent'), 'validatePassScan checks event status');
assert(validateScanSource.includes('event_not_live'), 'validatePassScan returns event_not_live');

const dashboardSource = readFileSync(
  join(process.cwd(), 'src/components/organizer/organizer-dashboard.tsx'),
  'utf8',
);
assert(dashboardSource.includes('filterDashboardEventsByStatus'), 'dashboard uses status filter helper');
assert(dashboardSource.includes("statusFilter"), 'dashboard tracks status filter state');
assert(dashboardSource.includes("'all', 'live', 'draft'"), 'dashboard renders All/Live/Draft chips');
assert(dashboardSource.includes('getEventStatusPillLabel'), 'dashboard event cards show status pill');

const eventDetailSource = readFileSync(join(process.cwd(), 'src/app/events/[eventId]/index.tsx'), 'utf8');
assert(eventDetailSource.includes('publishEvent'), 'event detail can publish');
assert(eventDetailSource.includes('Publish Event'), 'event detail shows Publish Event CTA');
assert(eventDetailSource.includes('PUBLISH_BEFORE_SCAN_MESSAGE'), 'event detail shows draft hint');
assert(eventDetailSource.includes('actionDisabledButton'), 'event detail disables issue/scan when draft');

const issueScreenSource = readFileSync(join(process.cwd(), 'src/app/events/[eventId]/issue.tsx'), 'utf8');
assert(issueScreenSource.includes('canIssuePassesForEvent'), 'issue screen blocks draft events');

const scanScreenSource = readFileSync(join(process.cwd(), 'src/app/events/[eventId]/scan.tsx'), 'utf8');
assert(scanScreenSource.includes('canScanPassesForEvent'), 'scan screen blocks draft events');

const createEventSource = readFileSync(join(process.cwd(), 'src/app/events/create.tsx'), 'utf8');
assert(createEventSource.includes("status: 'draft'"), 'new events start as draft');

if (failures > 0) {
  console.error(`\ncheck-event-status: ${failures} failure(s)`);
  process.exit(1);
}

console.log('\ncheck-event-status: all checks passed');
