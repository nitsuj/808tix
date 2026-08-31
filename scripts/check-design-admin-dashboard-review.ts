#!/usr/bin/env npx tsx
/**
 * Design-review route guardrails for /design/admin-dashboard-review.
 * Ensures mock dashboard review stays off public nav and decoupled from production /admin RPCs.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const REVIEW_ROUTE = join(ROOT, 'src/app/design/admin-dashboard-review.tsx');
const REVIEW_SHELL = join(ROOT, 'src/components/design-review/admin-dashboard-review-shell.tsx');
const REVIEW_DATA = join(ROOT, 'src/components/design-review/dashboard-review-data.ts');
const HOME = join(ROOT, 'src/app/home.tsx');
const INDEX = join(ROOT, 'src/app/index.tsx');
const LAYOUT = join(ROOT, 'src/app/_layout.tsx');
const VERCEL = join(ROOT, 'vercel.json');
const ADMIN_INDEX = join(ROOT, 'src/app/admin/index.tsx');
const ADMIN_EVENT = join(ROOT, 'src/app/admin/events/[eventId].tsx');
const BUY = join(ROOT, 'src/app/events/[eventId]/buy.tsx');
const SCAN = join(ROOT, 'src/app/events/[eventId]/scan.tsx');
const CAPTURE_SCRIPT = join(ROOT, 'scripts/capture-admin-dashboard-screenshots.ts');

let failures = 0;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`✗ ${message}`);
    failures += 1;
    return;
  }
  console.log(`✓ ${message}`);
}

assert(existsSync(REVIEW_ROUTE), 'admin dashboard review route file exists');
assert(existsSync(REVIEW_SHELL), 'admin dashboard review shell exists');
assert(existsSync(REVIEW_DATA), 'admin dashboard review mock data exists');

const reviewRoute = readFileSync(REVIEW_ROUTE, 'utf8');
const reviewShell = readFileSync(REVIEW_SHELL, 'utf8');
const reviewData = readFileSync(REVIEW_DATA, 'utf8');
const home = readFileSync(HOME, 'utf8');
const indexPage = readFileSync(INDEX, 'utf8');
const layout = readFileSync(LAYOUT, 'utf8');
const vercel = readFileSync(VERCEL, 'utf8');
const adminIndex = readFileSync(ADMIN_INDEX, 'utf8');
const adminEvent = readFileSync(ADMIN_EVENT, 'utf8');
const buy = readFileSync(BUY, 'utf8');
const scan = readFileSync(SCAN, 'utf8');
const captureScript = readFileSync(CAPTURE_SCRIPT, 'utf8');

assert(reviewRoute.includes('AdminDashboardReviewShell'), 'review route renders review shell');
assert(reviewShell.includes('GlobalAdminDashboardView'), 'review shell uses shared global dashboard view');
assert(reviewShell.includes('REVIEW_SUMMARY'), 'review shell uses static mock summary');
assert(
  reviewShell.includes('Design Review — Mock Data'),
  'review shell labeled Design Review — Mock Data',
);

assert(!reviewShell.includes('supabase.rpc'), 'review shell does not call supabase RPCs');
assert(!reviewRoute.includes('supabase.rpc'), 'review route does not call supabase RPCs');
assert(!reviewShell.includes('admin_dashboard_summary'), 'review shell does not call admin RPCs');
assert(reviewData.includes('REVIEW_EVENTS'), 'review data is static mock');
assert(!reviewData.includes('supabase'), 'review data file has no supabase');

assert(!home.includes('/design/admin-dashboard-review'), 'home has no review route nav');
assert(!indexPage.includes('/design/admin-dashboard-review'), 'organizer index has no review nav');
assert(!layout.includes('/design/admin-dashboard-review'), 'root layout does not advertise review route');

assert(
  vercel.includes('"source": "/design/admin-dashboard-review"') &&
    vercel.includes('"destination": "/design/admin-dashboard-review.html"'),
  'vercel rewrite for admin dashboard review',
);

assert(adminIndex.includes('AdminGate'), 'production /admin still requires AdminGate');
assert(adminIndex.includes('supabase.rpc'), 'production /admin still uses live RPCs');
assert(adminIndex.includes('admin_dashboard_summary'), 'production /admin calls dashboard summary RPC');
assert(!adminIndex.includes('design-review/dashboard-review-data'), 'production /admin not coupled to review mock data');
assert(adminIndex.includes('GlobalAdminDashboardView'), 'production /admin uses shared global dashboard view');
assert(!adminEvent.includes('design-review'), 'production admin event not coupled to review');

assert(!buy.includes('design-review'), 'buy page not changed for review workflow');
assert(!scan.includes('design-review'), 'scanner page not changed for review workflow');

assert(
  captureScript.includes('/design/admin-dashboard-review'),
  'screenshot script captures review route',
);
assert(
  captureScript.includes('admin-dashboard-review-desktop.png'),
  'screenshot script writes desktop review artifact',
);
assert(
  captureScript.includes('admin-dashboard-review-mobile.png'),
  'screenshot script writes mobile review artifact',
);

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}

console.log('\nAll admin dashboard review checks passed.');
