#!/usr/bin/env npx tsx
/**
 * Platform admin cockpit (/admin) + monetization RPC guards.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const MIGRATION = join(
  ROOT,
  'supabase/migrations/20260825120000_platform_admin_cockpit.sql',
);
const ADMIN_PAGE = join(ROOT, 'src/app/admin.tsx');
const ADMIN_SUPPORT = join(ROOT, 'src/lib/admin-support.ts');
const HOME = join(ROOT, 'src/app/home.tsx');
const INDEX = join(ROOT, 'src/app/index.tsx');
const VERCEL = join(ROOT, 'vercel.json');
const LAYOUT = join(ROOT, 'src/app/_layout.tsx');

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
assert(existsSync(ADMIN_PAGE), '/admin route file exists');
assert(existsSync(ADMIN_SUPPORT), 'admin-support helpers exist');

const migration = readFileSync(MIGRATION, 'utf8');
const adminPage = readFileSync(ADMIN_PAGE, 'utf8');
const adminSupport = readFileSync(ADMIN_SUPPORT, 'utf8');
const home = readFileSync(HOME, 'utf8');
const indexPage = readFileSync(INDEX, 'utf8');
const vercel = readFileSync(VERCEL, 'utf8');
const layout = readFileSync(LAYOUT, 'utf8');

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

assert(migration.includes('create_pending_order') && migration.includes('resolve_effective_fee_config'), 'create_pending_order uses effective fee config');
assert(migration.includes("fee_config_source") && migration.includes('v_source'), 'orders snapshot fee source at create');

assert(adminPage.includes("profile?.is_platform_admin"), 'admin UI gates on is_platform_admin');
assert(adminPage.includes('Not authorized') || adminPage.includes('not a platform admin'), 'unauthorized state present');
assert(adminPage.includes('Go to login') || adminPage.includes('/login'), 'logged-out prompts login');
assert(adminPage.includes('admin_dashboard_summary'), 'admin UI calls dashboard summary RPC');
assert(adminPage.includes('admin_list_events'), 'admin UI calls events RPC');
assert(adminPage.includes('admin_list_recent_orders'), 'admin UI calls orders RPC');
assert(adminPage.includes('admin_list_payouts'), 'admin UI calls payouts RPC');
assert(adminPage.includes('admin_get_monetization_settings'), 'admin UI calls monetization RPC');
assert(adminPage.includes('admin_set_payout_status'), 'admin UI can set payout status');
assert(adminPage.includes('admin_update_global_fee_config'), 'admin UI can update global fees');
assert(adminPage.includes('808Tickets service fee') && adminPage.includes('Payment processing fee'), 'exact fee labels in admin UI');
assert(adminPage.includes('Export CSV') || adminSupport.includes('downloadCsv'), 'CSV export available');

assert(adminSupport.includes('/events/') && adminSupport.includes('/buy'), 'buy support link uses real route');
assert(adminSupport.includes('/scan'), 'scanner support link uses real route');
assert(adminSupport.includes('/pass/'), 'ticket support link uses real route');
assert(!adminSupport.includes('808tix.vercel.app'), 'no legacy vercel host in admin links');
assert(!adminSupport.includes('localhost:8081'), 'no hardcoded localhost in admin-support helpers');
assert(adminSupport.includes('buildAbsoluteAppUrl'), 'admin links use app origin helper');

assert(!home.includes('/admin') && !home.includes('href="/admin"'), 'home has no public /admin nav link');
assert(!indexPage.includes('href="/admin"') && !indexPage.includes("push('/admin')"), 'organizer index has no /admin nav');
assert(!layout.includes('/admin'), 'root layout does not advertise /admin nav');

assert(
  vercel.includes('"source": "/admin"') && vercel.includes('"destination": "/admin.html"'),
  'vercel rewrite for /admin clean URL',
);

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}

console.log('\nAll platform admin UI checks passed.');
