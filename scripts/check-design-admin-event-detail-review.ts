#!/usr/bin/env npx tsx
/**
 * Design-review route guardrails for /design/admin-event-detail-review.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const REVIEW_ROUTE = join(ROOT, 'src/app/design/admin-event-detail-review.tsx');
const REVIEW_SHELL = join(ROOT, 'src/components/design-review/admin-event-detail-review-shell.tsx');
const REVIEW_DATA = join(ROOT, 'src/components/design-review/admin-event-detail-review-data.ts');
const EVENT_VIEW = join(ROOT, 'src/components/dashboard/event-admin-dashboard-view.tsx');
const ADMIN_EVENT = join(ROOT, 'src/app/admin/events/[eventId].tsx');
const HOME = join(ROOT, 'src/app/home.tsx');
const INDEX = join(ROOT, 'src/app/index.tsx');
const LAYOUT = join(ROOT, 'src/app/_layout.tsx');
const VERCEL = join(ROOT, 'vercel.json');
const BUY = join(ROOT, 'src/app/events/[eventId]/buy.tsx');
const SCAN = join(ROOT, 'src/app/events/[eventId]/scan.tsx');
const CAPTURE = join(ROOT, 'scripts/capture-admin-dashboard-screenshots.ts');

let failures = 0;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`✗ ${message}`);
    failures += 1;
    return;
  }
  console.log(`✓ ${message}`);
}

assert(existsSync(REVIEW_ROUTE), 'event detail review route exists');
assert(existsSync(REVIEW_SHELL), 'event detail review shell exists');
assert(existsSync(REVIEW_DATA), 'event detail review mock data exists');
assert(existsSync(EVENT_VIEW), 'shared EventAdminDashboardView exists');

const reviewRoute = readFileSync(REVIEW_ROUTE, 'utf8');
const reviewShell = readFileSync(REVIEW_SHELL, 'utf8');
const reviewData = readFileSync(REVIEW_DATA, 'utf8');
const eventView = readFileSync(EVENT_VIEW, 'utf8');
const adminEvent = readFileSync(ADMIN_EVENT, 'utf8');
const home = readFileSync(HOME, 'utf8');
const indexPage = readFileSync(INDEX, 'utf8');
const layout = readFileSync(LAYOUT, 'utf8');
const vercel = readFileSync(VERCEL, 'utf8');
const buy = readFileSync(BUY, 'utf8');
const scan = readFileSync(SCAN, 'utf8');
const capture = readFileSync(CAPTURE, 'utf8');

assert(reviewRoute.includes('AdminEventDetailReviewShell'), 'review route renders shell');
assert(reviewShell.includes('EventAdminDashboardView'), 'review shell uses shared event view');
assert(reviewShell.includes('Design Review — Mock Data'), 'review labeled Design Review — Mock Data');
assert(reviewShell.includes('EVENT_REVIEW_DETAIL'), 'review shell uses static mock detail');
assert(!reviewShell.includes('supabase.rpc'), 'review shell does not call supabase RPCs');
assert(!reviewRoute.includes('supabase.rpc'), 'review route does not call supabase RPCs');
assert(!reviewData.includes('supabase'), 'review data has no supabase');
assert(reviewData.includes('Test Paid Show'), 'mock event name present');
assert(eventView.includes('808Tickets service fee'), 'shared view has exact service fee label');
assert(eventView.includes('Payment processing fee'), 'shared view has exact processing fee label');
assert(eventView.includes('Gross ticket sales'), 'shared view uses Gross ticket sales');
assert(!/\bGMV\b/.test(eventView) && !eventView.includes('Gross Merchandise Value'), 'shared view has no GMV language');
assert(!/\bGMV\b/.test(reviewData) && !reviewData.includes('Gross Merchandise Value'), 'mock data has no GMV language');

assert(!home.includes('/design/admin-event-detail-review'), 'home has no event detail review nav');
assert(!indexPage.includes('/design/admin-event-detail-review'), 'organizer index has no event detail review nav');
assert(!layout.includes('/design/admin-event-detail-review'), 'root layout does not advertise event detail review');

assert(
  vercel.includes('"source": "/design/admin-event-detail-review"') &&
    vercel.includes('"destination": "/design/admin-event-detail-review.html"'),
  'vercel rewrite for event detail review',
);

assert(!adminEvent.includes('design-review'), 'production /admin/events/:eventId not coupled to review');
assert(!adminEvent.includes('EventAdminDashboardView'), 'production event admin not yet wired to shared view');
assert(!buy.includes('design-review'), 'buy page not coupled to review');
assert(!scan.includes('design-review'), 'scanner page not coupled to review');

assert(
  capture.includes('/design/admin-event-detail-review'),
  'screenshot script captures event detail review route',
);
assert(
  capture.includes('admin-event-detail-review-desktop.png'),
  'screenshot script writes desktop event detail review artifact',
);
assert(
  capture.includes('admin-event-detail-review-mobile.png'),
  'screenshot script writes mobile event detail review artifact',
);

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}

console.log('\nAll admin event detail review checks passed.');
