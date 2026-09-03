#!/usr/bin/env npx tsx
/**
 * Platform admin scanner access + admin buyability / support-tools guards.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const MIGRATIONS_DIR = join(ROOT, 'supabase/migrations');
const MIGRATION = join(
  ROOT,
  'supabase/migrations/20260903120000_platform_admin_scanner_buyability.sql',
);
const EVENT_VIEW = join(ROOT, 'src/components/dashboard/event-admin-dashboard-view.tsx');
const ADMIN_EVENT = join(ROOT, 'src/app/admin/events/[eventId].tsx');
const ADMIN_PAGE = join(ROOT, 'src/app/admin/index.tsx');
const EVENT_LIST = join(ROOT, 'src/components/dashboard/event-list.tsx');
const ADMIN_SUPPORT = join(ROOT, 'src/lib/admin-support.ts');
const SMOKE = join(ROOT, 'scripts/smoke-checkin.ts');
const USE_EVENT_DETAIL = join(ROOT, 'src/hooks/use-event-detail.ts');
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

assert(existsSync(MIGRATION), 'platform admin scanner/buyability migration exists');

const migration = readFileSync(MIGRATION, 'utf8');
const eventView = readFileSync(EVENT_VIEW, 'utf8');
const adminEvent = readFileSync(ADMIN_EVENT, 'utf8');
const adminPage = readFileSync(ADMIN_PAGE, 'utf8');
const eventList = readFileSync(EVENT_LIST, 'utf8');
const adminSupport = readFileSync(ADMIN_SUPPORT, 'utf8');
const smoke = readFileSync(SMOKE, 'utf8');
const useEventDetail = readFileSync(USE_EVENT_DETAIL, 'utf8');
const scan = readFileSync(SCAN, 'utf8');

assert(
  migration.includes('events_select_platform_admin') &&
    migration.includes('passes_select_platform_admin'),
  'RLS SELECT policies for platform admin on events/passes',
);
assert(
  migration.includes('is_platform_admin()') &&
    migration.includes('create or replace function public.validate_pass'),
  'validate_pass updated for platform admin',
);
assert(
  migration.includes('Unauthorized scanners must not receive guest_name'),
  'unauthorized validate_pass remains PII-free',
);
assert(
  migration.includes('v_authorized') &&
    migration.includes('or public.is_platform_admin()'),
  'validate_pass authorizes organizer or platform admin',
);
assert(
  migration.includes('create or replace function public.get_event_stats') &&
    migration.includes('not public.is_platform_admin()'),
  'get_event_stats allows platform admin',
);
assert(
  migration.includes('create or replace function public.compute_event_buyability'),
  'compute_event_buyability helper exists',
);
assert(
  migration.includes("'selling'") &&
    migration.includes("'sales_off'") &&
    migration.includes("'sold_out'") &&
    migration.includes("'no_tickets'") &&
    migration.includes("'draft'"),
  'buyability statuses cover selling/sales_off/sold_out/no_tickets/draft',
);
assert(
  migration.includes('create or replace function public.admin_list_events') &&
    migration.includes('compute_event_buyability'),
  'admin_list_events returns buyability fields',
);
assert(
  migration.includes('create or replace function public.admin_get_event_detail') &&
    migration.includes('compute_event_buyability'),
  'admin_get_event_detail returns buyability fields',
);
assert(
  !/grant execute on function public\.compute_event_buyability[^;]*to anon/i.test(migration),
  'compute_event_buyability not granted to anon',
);

assert(!eventView.includes('Copy event ID'), 'event support tools omit Copy event ID');
assert(!eventView.includes('Copy organizer email'), 'event support tools omit Copy organizer email');
assert(eventView.includes('Buy page available') || eventView.includes('isBuyable'), 'buy availability state shown');
assert(eventView.includes('Scanner available'), 'scanner availability state shown');
assert(eventView.includes('Buy unavailable') || eventView.includes('buyabilityLabel'), 'non-buyable reason shown');
assert(eventView.includes('Open buy page'), 'buy action retained when available');
assert(eventView.includes('Open scanner'), 'scanner action retained');
assert(!eventView.includes('Public event page'), 'no public event page support link');

assert(adminEvent.includes('isAdminEventBuyable'), 'event admin gates buy href on buyability');
assert(adminEvent.includes('buildAdminEventBuyUrl'), 'event admin still builds buy URL when buyable');
assert(adminEvent.includes('buildAdminEventScanUrl'), 'event admin keeps scanner URL');
assert(adminEvent.includes('buyability_status') || adminEvent.includes('buyabilityStatus'), 'event admin maps buyability');

assert(adminPage.includes('buyabilityLabel') || adminPage.includes('formatAdminBuyabilityLabel'), 'global admin maps buyability');
assert(
  !adminPage.includes('label="Buy"') &&
    !adminPage.includes('label="Scanner"') &&
    !adminPage.includes('buildAdminEventBuyUrl') &&
    !adminPage.includes('buildAdminEventScanUrl'),
  'global admin has no Buy/Scanner row buttons',
);
assert(adminPage.includes('buildAdminCockpitEventPath'), 'global admin event names still link to cockpit');
assert(eventList.includes('buyabilityLabel'), 'event list shows buyability signal');
assert(!eventList.includes('salesLabel'), 'event list uses buyability instead of sales-only badge');

assert(adminSupport.includes('formatAdminBuyabilityLabel'), 'buyability label helper');
assert(adminSupport.includes('isAdminEventBuyable'), 'buyable predicate helper');
assert(!adminSupport.includes('808tix.vercel.app'), 'no legacy vercel host');
assert(!adminSupport.includes('localhost:8081'), 'no hardcoded localhost support links');

assert(useEventDetail.includes("from('events')"), 'scanner still loads events via table query');
assert(scan.includes('useEventDetail'), 'scan screen uses useEventDetail');
assert(
  smoke.includes('platform-admin@808tix.test') || smoke.includes('QA_PLATFORM_ADMIN'),
  'smoke:checkin covers platform admin path',
);
assert(
  smoke.includes('denied') || smoke.includes('unauthorized') || smoke.includes('non-owner'),
  'smoke:checkin covers unauthorized scanner path',
);

const laterSql = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith('.sql') && f > '20260902120000_launch_security_hardening.sql')
  .map((f) => readFileSync(join(MIGRATIONS_DIR, f), 'utf8'))
  .join('\n');

assert(
  !laterSql.includes('create or replace function public.validate_pass(') ||
    laterSql.includes('Unauthorized scanners must not receive guest_name'),
  'post-hardening validate_pass redefine preserves PII-free unauthorized path',
);

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}

console.log('\nAll platform admin scanner / buyability checks passed.');
