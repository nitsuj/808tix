#!/usr/bin/env npx tsx
/**
 * Local admin QA safety guards:
 * - design review remains mock-only
 * - local QA helper is localhost + local Supabase gated
 * - production /admin still requires AdminGate / platform admin
 * - no service-role key in frontend
 * - qa:admin command documents lanes
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();

const LOCAL_QA = join(ROOT, 'src/lib/local-admin-qa.ts');
const ADMIN_GATE = join(ROOT, 'src/components/admin/admin-gate.tsx');
const ADMIN_INDEX = join(ROOT, 'src/app/admin/index.tsx');
const REVIEW_ROUTE = join(ROOT, 'src/app/design/admin-dashboard-review.tsx');
const REVIEW_SHELL = join(ROOT, 'src/components/design-review/admin-dashboard-review-shell.tsx');
const REVIEW_DATA = join(ROOT, 'src/components/design-review/dashboard-review-data.ts');
const QA_ADMIN_SCRIPT = join(ROOT, 'scripts/qa-admin.ts');
const SEED = join(ROOT, 'scripts/seed-qa-purchase-fixtures.ts');
const CAPTURE = join(ROOT, 'scripts/capture-admin-dashboard-screenshots.ts');
const PACKAGE_JSON = join(ROOT, 'package.json');
const HOME = join(ROOT, 'src/app/home.tsx');
const INDEX = join(ROOT, 'src/app/index.tsx');
const LAYOUT = join(ROOT, 'src/app/_layout.tsx');
const COCKPIT_MIGRATION = join(
  ROOT,
  'supabase/migrations/20260825120000_platform_admin_cockpit.sql',
);

let failures = 0;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`✗ ${message}`);
    failures += 1;
    return;
  }
  console.log(`✓ ${message}`);
}

assert(existsSync(LOCAL_QA), 'local-admin-qa helper exists');
assert(existsSync(QA_ADMIN_SCRIPT), 'qa-admin script exists');
assert(existsSync(REVIEW_ROUTE), 'design review route exists');

const localQa = readFileSync(LOCAL_QA, 'utf8');
const adminGate = readFileSync(ADMIN_GATE, 'utf8');
const adminIndex = readFileSync(ADMIN_INDEX, 'utf8');
const reviewRoute = readFileSync(REVIEW_ROUTE, 'utf8');
const reviewShell = readFileSync(REVIEW_SHELL, 'utf8');
const reviewData = readFileSync(REVIEW_DATA, 'utf8');
const qaAdmin = readFileSync(QA_ADMIN_SCRIPT, 'utf8');
const seed = readFileSync(SEED, 'utf8');
const capture = readFileSync(CAPTURE, 'utf8');
const pkg = readFileSync(PACKAGE_JSON, 'utf8');
const home = readFileSync(HOME, 'utf8');
const indexPage = readFileSync(INDEX, 'utf8');
const layout = readFileSync(LAYOUT, 'utf8');
const cockpitMigration = readFileSync(COCKPIT_MIGRATION, 'utf8');

assert(localQa.includes('isLocalAdminQaEnabled'), 'local QA enable helper exported');
assert(localQa.includes('localhost'), 'local QA checks localhost host');
assert(localQa.includes('127.0.0.1'), 'local QA checks 127.0.0.1 host');
assert(localQa.includes('getSupabaseTargetInfo'), 'local QA checks Supabase target');
assert(localQa.includes('isLocal'), 'local QA requires local Supabase');
assert(localQa.includes('platform-admin@808tix.test'), 'local QA email constant');
assert(localQa.includes('qa-admin-password'), 'local QA password constant');
assert(!localQa.includes('SERVICE_ROLE'), 'local QA has no service role key');
assert(!localQa.includes('service_role'), 'local QA has no service_role reference');

assert(adminGate.includes('AdminGate'), 'AdminGate exists');
assert(adminGate.includes('isLocalAdminQaEnabled'), 'AdminGate uses local QA gate');
assert(adminGate.includes('Continue as local platform admin'), 'AdminGate has local QA button');
assert(adminGate.includes('qaAdmin') || adminGate.includes('LOCAL_QA_ADMIN_PARAM'), 'AdminGate supports qaAdmin param');
assert(adminGate.includes('signInWithEmail'), 'local QA uses normal Auth sign-in');
assert(adminGate.includes('is_platform_admin'), 'AdminGate still requires platform admin');
assert(adminGate.includes('/login'), 'logged-out still prompts login');
assert(adminGate.includes('Not authorized'), 'unauthorized state present');

assert(adminIndex.includes('AdminGate'), 'production /admin still wrapped in AdminGate');
assert(adminIndex.includes('supabase.rpc'), 'production /admin still uses live RPCs');
assert(adminIndex.includes('admin_dashboard_summary'), 'production /admin calls dashboard summary');
assert(!adminIndex.includes('REVIEW_SUMMARY'), 'production /admin does not use review mock data');

assert(reviewShell.includes('Design Review — Mock Data'), 'review labeled Design Review — Mock Data');
assert(!reviewShell.includes('supabase.rpc'), 'review shell does not call supabase RPCs');
assert(!reviewRoute.includes('supabase.rpc'), 'review route does not call supabase RPCs');
assert(reviewData.includes('REVIEW_EVENTS'), 'review uses static mock events');

assert(seed.includes('platform-admin@808tix.test'), 'qa:seed creates platform-admin@808tix.test');
assert(seed.includes('qa-admin-password'), 'qa:seed sets platform admin password');
assert(seed.includes('is_platform_admin = true') || seed.includes('is_platform_admin,'), 'qa:seed sets is_platform_admin');
assert(seed.includes('assertLocalSupabase') || seed.includes('isLocalSupabaseUrl'), 'qa:seed refuses non-local Supabase');

assert(pkg.includes('"qa:admin"'), 'package.json has qa:admin script');
assert(qaAdmin.includes(LOCAL_ADMIN_URL_SNIPPET()), 'qa:admin documents local admin URL');
assert(qaAdmin.includes('/design/admin-dashboard-review'), 'qa:admin documents design review URL');
assert(qaAdmin.includes('https://808tickets.com/admin'), 'qa:admin documents hosted admin URL');
assert(qaAdmin.includes('mock data'), 'qa:admin documents mock vs real lanes');

assert(
  capture.includes('admin-dashboard-authenticated-desktop.png'),
  'screenshot script writes authenticated desktop artifact',
);
assert(
  capture.includes('admin-dashboard-authenticated-mobile.png'),
  'screenshot script writes authenticated mobile artifact',
);
assert(capture.includes('platform-admin@808tix.test'), 'screenshot script uses local QA admin');
assert(capture.includes('qaAdmin=1'), 'screenshot script uses qaAdmin auto-login path');

assert(!home.includes('/admin'), 'home has no public /admin nav');
assert(!home.includes('/design/admin-dashboard-review'), 'home has no review nav');
assert(!indexPage.includes('href="/admin"'), 'organizer index has no /admin nav');
assert(!layout.includes('/admin'), 'root layout does not advertise /admin');

assert(
  cockpitMigration.includes('admin_dashboard_summary') && cockpitMigration.includes('is_platform_admin()'),
  'admin_dashboard_summary remains platform-admin gated',
);

const srcTreeHasServiceRole = [
  join(ROOT, 'src/lib/local-admin-qa.ts'),
  join(ROOT, 'src/components/admin/admin-gate.tsx'),
  join(ROOT, 'src/app/admin/index.tsx'),
].some((path) => {
  const text = readFileSync(path, 'utf8');
  return /service[_-]?role|SERVICE_ROLE/i.test(text);
});
assert(!srcTreeHasServiceRole, 'admin QA frontend paths have no service role key');

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}

console.log('\nAll local admin QA checks passed.');

function LOCAL_ADMIN_URL_SNIPPET(): string {
  return '/admin?qaAdmin=1';
}
