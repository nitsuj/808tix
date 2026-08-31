#!/usr/bin/env npx tsx
/**
 * Design prototype route guardrails (global dashboard + event detail).
 * Ensures prototypes exist, stay off public nav, and stay decoupled from production surfaces.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const DASHBOARD_ROUTE = join(ROOT, 'src/app/design/admin-dashboard-prototype.tsx');
const EVENT_ROUTE = join(ROOT, 'src/app/design/admin-event-detail-prototype.tsx');
const DASHBOARD_SHELL = join(ROOT, 'src/components/design-prototype/prototype-dashboard-shell.tsx');
const EVENT_SHELL = join(ROOT, 'src/components/design-prototype/prototype-event-detail-shell.tsx');
const HOME = join(ROOT, 'src/app/home.tsx');
const INDEX = join(ROOT, 'src/app/index.tsx');
const LAYOUT = join(ROOT, 'src/app/_layout.tsx');
const VERCEL = join(ROOT, 'vercel.json');
const ADMIN_INDEX = join(ROOT, 'src/app/admin/index.tsx');
const ADMIN_EVENT = join(ROOT, 'src/app/admin/events/[eventId].tsx');
const BUY = join(ROOT, 'src/app/events/[eventId]/buy.tsx');
const SCAN = join(ROOT, 'src/app/events/[eventId]/scan.tsx');

let failures = 0;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`✗ ${message}`);
    failures += 1;
    return;
  }
  console.log(`✓ ${message}`);
}

assert(existsSync(DASHBOARD_ROUTE), 'dashboard prototype route file exists');
assert(existsSync(EVENT_ROUTE), 'event-detail prototype route file exists');
assert(existsSync(DASHBOARD_SHELL), 'dashboard prototype shell exists');
assert(existsSync(EVENT_SHELL), 'event-detail prototype shell exists');

const dashboardRoute = readFileSync(DASHBOARD_ROUTE, 'utf8');
const eventRoute = readFileSync(EVENT_ROUTE, 'utf8');
const dashboardShell = readFileSync(DASHBOARD_SHELL, 'utf8');
const eventShell = readFileSync(EVENT_SHELL, 'utf8');
const home = readFileSync(HOME, 'utf8');
const indexPage = readFileSync(INDEX, 'utf8');
const layout = readFileSync(LAYOUT, 'utf8');
const vercel = readFileSync(VERCEL, 'utf8');
const adminIndex = readFileSync(ADMIN_INDEX, 'utf8');
const adminEvent = readFileSync(ADMIN_EVENT, 'utf8');
const buy = readFileSync(BUY, 'utf8');
const scan = readFileSync(SCAN, 'utf8');

assert(dashboardRoute.includes('PrototypeDashboardShell'), 'dashboard route renders shell');
assert(eventRoute.includes('PrototypeEventDetailShell'), 'event-detail route renders shell');
assert(dashboardShell.includes('Global Admin Overview'), 'dashboard uses Global Admin Overview title');
assert(eventShell.includes('Orders / tickets'), 'event-detail includes orders section');
assert(eventShell.includes('Monetization'), 'event-detail includes monetization section');
assert(eventShell.includes('Payouts'), 'event-detail includes payouts section');
assert(eventShell.includes('breadcrumbLink') || eventShell.includes('Admin'), 'event-detail has Admin breadcrumb');
assert(
  readFileSync(join(ROOT, 'src/components/design-prototype/prototype-chart-card.tsx'), 'utf8').includes(
    'GMV Over Time',
  ),
  'chart section titled GMV Over Time',
);
assert(
  readFileSync(join(ROOT, 'src/components/design-prototype/prototype-data.ts'), 'utf8').includes(
    'PROTOTYPE_EVENT_DETAIL',
  ),
  'prototype event detail uses static fake data',
);

assert(!dashboardShell.includes('supabase.rpc'), 'dashboard shell does not call supabase RPCs');
assert(!eventShell.includes('supabase.rpc'), 'event-detail shell does not call supabase RPCs');
assert(!dashboardRoute.includes('supabase.rpc'), 'dashboard route does not call supabase RPCs');
assert(!eventRoute.includes('supabase.rpc'), 'event-detail route does not call supabase RPCs');

assert(!home.includes('/design/admin-dashboard-prototype'), 'home has no dashboard prototype nav');
assert(!home.includes('/design/admin-event-detail-prototype'), 'home has no event prototype nav');
assert(!indexPage.includes('/design/admin-dashboard-prototype'), 'organizer index has no dashboard prototype nav');
assert(!indexPage.includes('/design/admin-event-detail-prototype'), 'organizer index has no event prototype nav');
assert(!layout.includes('/design/admin-dashboard-prototype'), 'root layout does not advertise dashboard prototype');
assert(!layout.includes('/design/admin-event-detail-prototype'), 'root layout does not advertise event prototype');

assert(
  vercel.includes('"source": "/design/admin-dashboard-prototype"') &&
    vercel.includes('"destination": "/design/admin-dashboard-prototype.html"'),
  'vercel rewrite for dashboard prototype',
);
assert(
  vercel.includes('"source": "/design/admin-event-detail-prototype"') &&
    vercel.includes('"destination": "/design/admin-event-detail-prototype.html"'),
  'vercel rewrite for event-detail prototype',
);

assert(!adminIndex.includes('design-prototype'), 'production admin index not coupled to prototype');
assert(!adminEvent.includes('design-prototype'), 'production admin event page not coupled to prototype');
assert(!buy.includes('design-prototype'), 'buy page not coupled to prototype');
assert(!scan.includes('design-prototype'), 'scanner page not coupled to prototype');

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}

console.log('\nAll design prototype checks passed.');
