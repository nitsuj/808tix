#!/usr/bin/env npx tsx
/**
 * Payments Phase 1.5 schema guards (migrations only — no runtime Stripe code).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const MIGRATIONS_DIR = join(ROOT, 'supabase/migrations');
const TABLES_MIGRATION = join(
  ROOT,
  'supabase/migrations/20260610120000_payments_phase1_tables.sql',
);
const RLS_MIGRATION = join(
  ROOT,
  'supabase/migrations/20260610120001_payments_phase1_rls.sql',
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

const tablesMigration = readFileSync(TABLES_MIGRATION, 'utf8');
const rlsMigration = readFileSync(RLS_MIGRATION, 'utf8');
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

const requiredTables = [
  'ticket_types',
  'orders',
  'order_items',
  'payments',
  'payment_events',
  'organizer_payouts',
];

for (const table of requiredTables) {
  assert(
    tablesMigration.includes(`create table public.${table}`),
    `tables migration creates public.${table}`,
  );
}

assert(
  tablesMigration.includes("add column source text not null default 'comp'"),
  'passes.source defaults to comp',
);
assert(
  tablesMigration.includes("add column ticketing_mode text not null default 'comp_only'"),
  'events.ticketing_mode defaults to comp_only',
);
assert(
  tablesMigration.includes('add column sales_enabled boolean not null default false'),
  'events.sales_enabled defaults to false',
);
assert(
  tablesMigration.includes('passes_source_order_check'),
  'passes enforces comp/paid order_id constraint',
);
assert(
  tablesMigration.includes('passes_order_item_id_sequence_unique_idx'),
  'passes has unique (order_item_id, sequence) partial index',
);
assert(
  tablesMigration.includes('create or replace function public.generate_public_access_token'),
  'generate_public_access_token helper exists',
);

assert(
  rlsMigration.includes('alter table public.orders enable row level security'),
  'orders RLS enabled',
);
assert(
  !rlsMigration.includes('to anon'),
  'payments RLS migration has no broad anon table policies',
);

assert(
  verification.includes('Comp pass should default source=comp'),
  'verification covers comp flow defaults',
);
assert(
  verification.includes('quantity') || verification.includes(', 2,'),
  'verification covers order_item quantity > 1',
);
assert(
  verification.includes('validate_pass comp pass'),
  'verification covers validate_pass on comp pass',
);
assert(
  verification.includes('validate_pass paid pass'),
  'verification covers validate_pass on paid pass',
);

assert(
  validatePassMigration.includes('create or replace function public.validate_pass('),
  'validate_pass migration signature unchanged in source file',
);
assert(
  getPassMigration.includes('create or replace function public.get_pass_by_token(p_secure_token text)'),
  'get_pass_by_token migration signature unchanged in source file',
);

const postPaymentMigrationSql = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith('.sql') && f > '20260610120001_payments_phase1_rls.sql')
  .map((f) => readFileSync(join(MIGRATIONS_DIR, f), 'utf8'))
  .join('\n');

assert(
  !postPaymentMigrationSql.includes('create or replace function public.validate_pass('),
  'no post-payments migration redefines validate_pass',
);
assert(
  !postPaymentMigrationSql.includes(
    'create or replace function public.get_pass_by_token(p_secure_token text)',
  ),
  'no post-payments migration redefines get_pass_by_token',
);

// Payments migrations must not redefine scanner/guest RPCs
assert(
  !tablesMigration.includes('create or replace function public.validate_pass'),
  'payments tables migration does not modify validate_pass',
);
assert(
  !tablesMigration.includes('create or replace function public.get_pass_by_token'),
  'payments tables migration does not modify get_pass_by_token',
);
assert(
  !rlsMigration.includes('create or replace function public.validate_pass'),
  'payments RLS migration does not modify validate_pass',
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

const srcFiles = walkTsFiles(SRC_DIR);
const stripeSecretPattern = /sk_(live|test)_[a-zA-Z0-9]+/;
const checkoutSessionMintPattern =
  /checkout\.sessions\.create|createCheckoutSession|stripe\.checkout/i;

for (const file of srcFiles) {
  const content = readFileSync(file, 'utf8');
  const rel = file.replace(`${ROOT}/`, '');
  assert(!stripeSecretPattern.test(content), `no Stripe secret in ${rel}`);
  assert(
    !checkoutSessionMintPattern.test(content),
    `no checkout session minting in ${rel}`,
  );
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}

console.log('\nAll payments schema checks passed.');
