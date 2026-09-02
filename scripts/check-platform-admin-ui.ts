#!/usr/bin/env npx tsx
/**
 * Platform admin cockpit (/admin + /admin/events/:eventId) + monetization RPC guards.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const MIGRATION = join(
  ROOT,
  'supabase/migrations/20260825120000_platform_admin_cockpit.sql',
);
const EVENT_DETAIL_MIGRATION = join(
  ROOT,
  'supabase/migrations/20260825140000_platform_admin_event_detail.sql',
);
const ADMIN_PAGE = join(ROOT, 'src/app/admin/index.tsx');
const GLOBAL_DASHBOARD_VIEW = join(ROOT, 'src/components/dashboard/global-admin-dashboard-view.tsx');
const ADMIN_EVENT_PAGE = join(ROOT, 'src/app/admin/events/[eventId].tsx');
const ADMIN_SUPPORT = join(ROOT, 'src/lib/admin-support.ts');
const HOME = join(ROOT, 'src/app/home.tsx');
const INDEX = join(ROOT, 'src/app/index.tsx');
const VERCEL = join(ROOT, 'vercel.json');
const LAYOUT = join(ROOT, 'src/app/_layout.tsx');
const BUY_ROUTE = join(ROOT, 'src/app/events/[eventId]/buy.tsx');
const SCAN_ROUTE = join(ROOT, 'src/app/events/[eventId]/scan.tsx');
const PASS_ROUTE = join(ROOT, 'src/app/pass/[token].tsx');

let failures = 0;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`✗ ${message}`);
    failures += 1;
    return;
  }
  console.log(`✓ ${message}`);
}

assert(existsSync(MIGRATION), 'admin cockpit migration exists');
assert(existsSync(EVENT_DETAIL_MIGRATION), 'admin event-detail migration exists');
assert(existsSync(ADMIN_PAGE), '/admin route file exists');
assert(existsSync(ADMIN_EVENT_PAGE), '/admin/events/:eventId route file exists');
assert(existsSync(ADMIN_SUPPORT), 'admin-support helpers exist');
assert(!existsSync(join(ROOT, 'src/app/admin.tsx')), 'flat admin.tsx removed (folder route)');
assert(existsSync(BUY_ROUTE), 'buy route exists for support links');
assert(existsSync(SCAN_ROUTE), 'scan route exists for support links');
assert(existsSync(PASS_ROUTE), 'pass route exists for ticket links');

const migration = readFileSync(MIGRATION, 'utf8');
const eventDetailMigration = readFileSync(EVENT_DETAIL_MIGRATION, 'utf8');
const adminPage = readFileSync(ADMIN_PAGE, 'utf8');
const globalDashboardView = readFileSync(GLOBAL_DASHBOARD_VIEW, 'utf8');
const adminUiSurface = adminPage + '\n' + globalDashboardView;
const adminEventPage = readFileSync(ADMIN_EVENT_PAGE, 'utf8');
const adminSupport = readFileSync(ADMIN_SUPPORT, 'utf8');
const home = readFileSync(HOME, 'utf8');
const indexPage = readFileSync(INDEX, 'utf8');
const vercel = readFileSync(VERCEL, 'utf8');
const layout = readFileSync(LAYOUT, 'utf8');
const eventIndexRoute = readFileSync(join(ROOT, 'src/app/events/[eventId]/index.tsx'), 'utf8');

assert(migration.includes('create table if not exists public.platform_fee_config'), 'platform_fee_config table');
assert(migration.includes('create table if not exists public.organizer_fee_overrides'), 'organizer_fee_overrides table');
assert(migration.includes('use_custom_fees'), 'events.use_custom_fees');
assert(migration.includes('fee_config_source'), 'orders.fee_config_source snapshot');
assert(migration.includes('platform_fee_bps_used'), 'orders platform fee bps snapshot');
assert(migration.includes('resolve_effective_fee_config'), 'resolve_effective_fee_config RPC');
assert(migration.includes("'event'") && migration.includes("'organizer'") && migration.includes("'global'"), 'fee precedence sources');
assert(migration.includes('admin_dashboard_summary'), 'admin_dashboard_summary');
assert(migration.includes('admin_list_events'), 'admin_list_events');
assert(migration.includes('admin_list_recent_orders'), 'admin_list_recent_orders');
assert(migration.includes('admin_get_monetization_settings'), 'admin_get_monetization_settings');
assert(migration.includes('admin_update_global_fee_config'), 'admin_update_global_fee_config');
assert(migration.includes('admin_upsert_organizer_fee_override'), 'admin_upsert_organizer_fee_override');
assert(migration.includes('admin_set_event_custom_fees'), 'admin_set_event_custom_fees');

for (const fn of [
  'admin_dashboard_summary',
  'admin_list_events',
  'admin_list_recent_orders',
  'admin_get_monetization_settings',
  'admin_update_global_fee_config',
  'admin_upsert_organizer_fee_override',
  'admin_set_event_custom_fees',
]) {
  assert(
    migration.includes(`create or replace function public.${fn}`) &&
      migration.includes('is_platform_admin()'),
    `${fn} is platform-admin gated`,
  );
  assert(
    migration.includes(`grant execute on function public.${fn}`) &&
      !new RegExp(`grant execute on function public\\.${fn}[^;]*to anon`, 'i').test(migration),
    `${fn} not granted to anon`,
  );
}

for (const fn of [
  'admin_get_event_detail',
  'admin_list_event_orders',
  'admin_get_event_monetization',
]) {
  assert(
    eventDetailMigration.includes(`create or replace function public.${fn}`) &&
      eventDetailMigration.includes('is_platform_admin()'),
    `${fn} is platform-admin gated`,
  );
  assert(
    eventDetailMigration.includes(`grant execute on function public.${fn}`) &&
      !new RegExp(`grant execute on function public\\.${fn}[^;]*to anon`, 'i').test(
        eventDetailMigration,
      ),
    `${fn} not granted to anon`,
  );
}

assert(migration.includes('create_pending_order') && migration.includes('resolve_effective_fee_config'), 'create_pending_order uses effective fee config');
assert(migration.includes("fee_config_source") && migration.includes('v_source'), 'orders snapshot fee source at create');

assert(adminPage.includes('is_platform_admin') || adminPage.includes('AdminGate'), 'admin UI gates on platform admin');
assert(adminEventPage.includes('AdminGate'), 'event admin uses AdminGate');
assert(
  readFileSync(join(ROOT, 'src/components/admin/admin-gate.tsx'), 'utf8').includes('Not authorized'),
  'unauthorized state present',
);
assert(
  readFileSync(join(ROOT, 'src/components/admin/admin-gate.tsx'), 'utf8').includes('/login'),
  'logged-out prompts login',
);
assert(adminPage.includes('GlobalAdminDashboardView'), 'production /admin uses shared global dashboard view');
assert(!adminPage.includes('REVIEW_SUMMARY'), 'production /admin does not use review mock summary');
assert(!adminPage.includes('design-review/dashboard-review-data'), 'production /admin does not import review mock data');
assert(adminPage.includes('admin_dashboard_summary'), 'admin UI calls dashboard summary RPC');
assert(adminPage.includes('admin_list_events'), 'admin UI calls events RPC');
assert(!adminPage.includes('admin_list_recent_orders'), 'global admin does not load recent orders list');
assert(!adminPage.includes('admin_list_payouts'), 'global admin does not load payout queue');
assert(adminPage.includes('admin_get_monetization_settings'), 'admin UI calls monetization RPC');
assert(!adminPage.includes('admin_set_payout_status'), 'global admin does not set payout status');
assert(adminPage.includes('admin_update_global_fee_config'), 'admin UI can update global fees');
assert(
  adminUiSurface.includes('808Tickets service fee') && adminUiSurface.includes('Payment processing fee'),
  'exact fee labels in admin UI',
);
assert(
  adminUiSurface.includes('Gross ticket sales') || adminUiSurface.includes('Ticket subtotal'),
  'global admin uses gross ticket sales / ticket subtotal language',
);
assert(!adminUiSurface.includes('Gross Merchandise Value'), 'global admin does not use Gross Merchandise Value');
assert(!/\bGMV\b/.test(adminUiSurface), 'global admin does not use GMV');
assert(
  adminUiSurface.includes('Platform operations') || adminUiSurface.includes('event performance'),
  'global admin has operational subtitle',
);
assert(
  adminPage.includes('TicketSalesChartCard') ||
    adminPage.includes('GlobalAdminDashboardView') ||
    adminPage.includes('Ticket sales over time'),
  'global admin includes ticket sales chart section',
);
assert(adminPage.includes('downloadCsv') || adminUiSurface.includes('Export CSV'), 'CSV export available');
assert(adminPage.includes('buildAdminCockpitEventPath'), 'global admin links event names to event cockpit');
assert(
  !adminPage.includes('label="Buy"') &&
    !adminPage.includes('label="Scanner"') &&
    !adminPage.includes("label='Buy'") &&
    !adminPage.includes("label='Scanner'"),
  'global admin events table has no Buy/Scanner action buttons',
);
assert(!adminPage.includes('buildAdminEventBuyUrl'), 'global admin does not render buy support links');
assert(!adminPage.includes('buildAdminEventScanUrl'), 'global admin does not render scanner support links');
assert(
  !adminPage.includes('Copy event ID') && !adminPage.includes('Copy organizer email'),
  'global admin event rows have no copy ID/email buttons',
);
assert(
  !adminPage.includes('Recent orders') && !adminPage.includes('admin_list_recent_orders'),
  'global admin does not show Recent Orders table',
);
assert(
  !adminPage.includes('Payout queue') && !adminPage.includes('admin_list_payouts'),
  'global admin does not show Payout Queue table',
);
assert(
  !adminPage.includes('No organizer overrides') && !adminPage.includes('Organizer overrides'),
  'global admin does not show organizer overrides block',
);
assert(!adminPage.includes('status=') && !adminPage.includes('sales='), 'global admin avoids raw key=value status text');
assert(adminPage.includes('formatAdminStatusLabel') || adminPage.includes('AdminBadge'), 'global admin uses human status presentation');
assert(adminPage.includes('Sales on') || adminPage.includes('formatAdminSalesLabel'), 'global admin uses human sales labels');

assert(adminEventPage.includes('admin_get_event_detail'), 'event admin calls detail RPC');
assert(adminEventPage.includes('admin_list_event_orders'), 'event admin calls event orders RPC');
assert(adminEventPage.includes('admin_get_event_monetization'), 'event admin calls event monetization RPC');
assert(adminEventPage.includes('admin_list_payouts'), 'event admin lists payouts');
assert(adminEventPage.includes('admin_set_event_custom_fees'), 'event admin can mutate event fees');
assert(adminEventPage.includes('admin_set_payout_status'), 'event admin can set payout status');
assert(adminEventPage.includes('EventAdminDashboardView'), 'event admin uses shared EventAdminDashboardView');
assert(adminEventPage.includes('AdminGate'), 'event admin remains AdminGate gated');
assert(
  !adminEventPage.includes('design-review') &&
    !adminEventPage.includes('admin-event-detail-review-data') &&
    !adminEventPage.includes('EVENT_REVIEW_'),
  'event admin does not import mock review data',
);
assert(adminEventPage.includes('buildAdminEventBuyUrl'), 'event admin has buy support link');
assert(adminEventPage.includes('buildAdminEventScanUrl'), 'event admin has scanner support link');
assert(!adminEventPage.includes('buildAdminEventDetailUrl'), 'event admin omits organizer-only event detail as public link');
assert(
  eventIndexRoute.includes('useOrganizerAuthGate'),
  '/events/:eventId is organizer-gated (not a public buyer page)',
);
const eventView = readFileSync(
  join(ROOT, 'src/components/dashboard/event-admin-dashboard-view.tsx'),
  'utf8',
);
assert(
  eventView.includes('808Tickets service fee') && eventView.includes('Payment processing fee'),
  'exact fee labels on shared event admin view',
);
assert(eventView.includes('Existing orders are not recalculated'), 'event fee copy warns existing orders');
assert(eventView.includes('breadcrumbLink') || eventView.includes('Admin'), 'event admin breadcrumb back to /admin');
assert(!adminEventPage.includes('Back to global admin'), 'event admin has no large Back to global admin support link');
assert(!adminEventPage.includes('Public event page'), 'event admin has no public event page support link');
assert(!adminEventPage.includes('status=') && !adminEventPage.includes('sales='), 'event admin avoids raw key=value status text');
assert(!/\bGMV\b/.test(adminEventPage + eventView) && !(adminEventPage + eventView).includes('Gross Merchandise Value'), 'event admin has no GMV language');
assert(adminEventPage.includes('buildAdminPassUrl'), 'event admin can link tickets via /pass/:token');
assert(!adminEventPage.includes('chartSeries'), 'event admin does not inject mock chart series');

assert(adminSupport.includes('buildAdminCockpitEventPath'), 'admin cockpit event path helper');
assert(adminSupport.includes('/admin/events/'), 'event cockpit path uses /admin/events/');
assert(adminSupport.includes('/events/') && adminSupport.includes('/buy'), 'buy support link uses real route');
assert(adminSupport.includes('/scan'), 'scanner support link uses real route');
assert(adminSupport.includes('/pass/'), 'ticket support link uses real route');
assert(!adminSupport.includes('buildAdminEventDetailUrl'), 'no public event detail support helper');
assert(!adminSupport.includes('808tix.vercel.app'), 'no legacy vercel host in admin links');
assert(!adminSupport.includes('localhost:8081'), 'no hardcoded localhost in admin-support helpers');
assert(adminSupport.includes('buildAbsoluteAppUrl'), 'admin links use app origin helper');

assert(!home.includes('/admin') && !home.includes('href="/admin"'), 'home has no public /admin nav link');
assert(!indexPage.includes('href="/admin"') && !indexPage.includes("push('/admin')"), 'organizer index has no /admin nav');
assert(!layout.includes('/admin'), 'root layout does not advertise /admin nav');

assert(
  vercel.includes('"source": "/admin"') && vercel.includes('"destination": "/admin/index.html"'),
  'vercel rewrite for /admin clean URL',
);
assert(
  vercel.includes('"source": "/admin/events/:eventId"') &&
    vercel.includes('"destination": "/admin/events/[eventId].html"'),
  'vercel rewrite for /admin/events/:eventId',
);

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}

console.log('\nAll platform admin UI checks passed.');
