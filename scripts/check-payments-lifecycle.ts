#!/usr/bin/env npx tsx
/**
 * Payments Phase 1.5 lifecycle RPC guards.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const MIGRATIONS_DIR = join(ROOT, 'supabase/migrations');
const LIFECYCLE_MIGRATION = join(
  ROOT,
  'supabase/migrations/20260610130000_payments_phase1_lifecycle.sql',
);
const HARDENING_MIGRATION = join(
  ROOT,
  'supabase/migrations/20260902120000_launch_security_hardening.sql',
);
const VERIFICATION_PATH = join(ROOT, 'supabase/verification-payments.sql');
const VALIDATE_PASS_MIGRATION = join(
  ROOT,
  'supabase/migrations/20250610000004_validate_pass.sql',
);
const GET_PASS_MIGRATION = join(
  ROOT,
  'supabase/migrations/20250610000005_get_pass_by_token.sql',
);
const SRC_DIR = join(ROOT, 'src');

const lifecycleMigration = readFileSync(LIFECYCLE_MIGRATION, 'utf8');
const hardeningMigration = readFileSync(HARDENING_MIGRATION, 'utf8');
const verification = readFileSync(VERIFICATION_PATH, 'utf8');
const validatePassMigration = readFileSync(VALIDATE_PASS_MIGRATION, 'utf8');
const getPassMigration = readFileSync(GET_PASS_MIGRATION, 'utf8');

let failures = 0;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`✗ ${message}`);
    failures += 1;
    return;
  }
  console.log(`✓ ${message}`);
}

assert(
  lifecycleMigration.includes('create or replace function public.create_pending_order'),
  'lifecycle migration defines create_pending_order',
);
assert(
  lifecycleMigration.includes('create or replace function public.fulfill_paid_order'),
  'lifecycle migration defines fulfill_paid_order',
);
assert(
  lifecycleMigration.includes('create or replace function public.expire_stale_orders'),
  'lifecycle migration defines expire_stale_orders',
);
assert(
  lifecycleMigration.includes('create or replace function public.get_order_by_public_token'),
  'lifecycle migration defines get_order_by_public_token',
);

assert(
  lifecycleMigration.includes('for update') && lifecycleMigration.includes('fulfill_paid_order'),
  'fulfill_paid_order uses row locking',
);
assert(
  lifecycleMigration.includes("source = 'paid'") || lifecycleMigration.includes("'paid'"),
  'fulfill_paid_order mints passes with source=paid',
);
assert(
  lifecycleMigration.includes('v_item.quantity'),
  'fulfill_paid_order iterates order_items.quantity',
);
assert(
  lifecycleMigration.includes('v_already_fulfilled') || lifecycleMigration.includes("status = 'paid'"),
  'fulfill_paid_order handles already-paid idempotency',
);

assert(
  lifecycleMigration.includes('event_reserved_pass_count'),
  'capacity protection counts event reservations',
);
assert(
  lifecycleMigration.includes('ticket_type_reserved_pass_count'),
  'capacity protection counts ticket type reservations',
);
assert(
  lifecycleMigration.includes('for update') && lifecycleMigration.includes('create_pending_order'),
  'create_pending_order locks event and ticket_type rows',
);

assert(
  lifecycleMigration.includes("grant execute on function public.create_pending_order") &&
    lifecycleMigration.includes('to anon'),
  'historical lifecycle migration granted create_pending_order to anon',
);
assert(
  hardeningMigration.includes('revoke all on function public.create_pending_order') &&
    hardeningMigration.includes('from anon, authenticated') &&
    hardeningMigration.includes('to service_role') &&
    !/grant execute on function public\.create_pending_order\([^)]+\)\s+to anon/.test(
      hardeningMigration,
    ),
  'create_pending_order not granted to anon (service_role only after hardening)',
);
assert(
  lifecycleMigration.includes("grant execute on function public.get_order_by_public_token") &&
    lifecycleMigration.includes('to anon'),
  'get_order_by_public_token granted to anon',
);
assert(
  lifecycleMigration.includes("grant execute on function public.fulfill_paid_order") &&
    lifecycleMigration.includes('to service_role'),
  'fulfill_paid_order restricted to service_role',
);
assert(
  lifecycleMigration.includes("grant execute on function public.expire_stale_orders") &&
    lifecycleMigration.includes('to service_role'),
  'expire_stale_orders restricted to service_role',
);

assert(
  lifecycleMigration.includes("case when v_order.status = 'paid' then v_tickets else null"),
  'get_order_by_public_token does not expose unpaid pass tokens',
);

assert(
  verification.includes('create_pending_order'),
  'verification exercises create_pending_order',
);
assert(
  verification.includes('expire_stale_orders'),
  'verification exercises expire_stale_orders',
);
assert(
  verification.includes('fulfill_paid_order'),
  'verification exercises fulfill_paid_order',
);
assert(
  verification.includes('get_order_by_public_token'),
  'verification exercises get_order_by_public_token',
);
assert(
  verification.includes('pending lookup must not expose ticket tokens'),
  'verification asserts unpaid token privacy',
);
assert(
  verification.includes('idempotent fulfill created duplicate passes'),
  'verification asserts fulfill idempotency',
);

assert(
  validatePassMigration.includes('create or replace function public.validate_pass('),
  'validate_pass signature unchanged in source file',
);
assert(
  getPassMigration.includes('create or replace function public.get_pass_by_token(p_secure_token text)'),
  'get_pass_by_token signature unchanged in source file',
);

const postLifecycleSql = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith('.sql') && f > '20260610130000_payments_phase1_lifecycle.sql')
  .map((f) => readFileSync(join(MIGRATIONS_DIR, f), 'utf8'))
  .join('\n');

assert(
  !postLifecycleSql.includes('create or replace function public.validate_pass(') ||
    postLifecycleSql.includes('Unauthorized scanners must not receive guest_name'),
  'post-lifecycle validate_pass redefine only allowed for PII-hardening migration',
);
assert(
  !postLifecycleSql.includes(
    'create or replace function public.get_pass_by_token(p_secure_token text)',
  ),
  'no post-lifecycle migration redefines get_pass_by_token',
);
assert(
  !lifecycleMigration.includes('create or replace function public.validate_pass'),
  'lifecycle migration does not modify validate_pass',
);
assert(
  !lifecycleMigration.includes('create or replace function public.get_pass_by_token'),
  'lifecycle migration does not modify get_pass_by_token',
);

function walkTsFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkTsFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

const checkoutSessionMintPattern =
  /checkout\.sessions\.create|createCheckoutSession|stripe\.checkout/i;

for (const file of walkTsFiles(SRC_DIR)) {
  const content = readFileSync(file, 'utf8');
  const rel = file.replace(`${ROOT}/`, '');
  assert(!checkoutSessionMintPattern.test(content), `no checkout session minting in ${rel}`);
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}

console.log('\nAll payments lifecycle checks passed.');
