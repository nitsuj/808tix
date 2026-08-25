#!/usr/bin/env npx tsx
/**
 * Guards for get_public_event_purchase_options (public buyer purchase read RPC).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const MIGRATIONS_DIR = join(ROOT, 'supabase/migrations');
const RPC_MIGRATION = join(
  ROOT,
  'supabase/migrations/20260610150000_payments_public_purchase_options.sql',
);
const RLS_MIGRATION = join(
  ROOT,
  'supabase/migrations/20260610120001_payments_phase1_rls.sql',
);
const VERIFICATION_PATH = join(ROOT, 'supabase/verification-payments.sql');

const rpcMigration = readFileSync(RPC_MIGRATION, 'utf8');
const rlsMigration = readFileSync(RLS_MIGRATION, 'utf8');
const verification = readFileSync(VERIFICATION_PATH, 'utf8');

function extractFunctionSql(sql: string, functionName: string): string | null {
  const marker = `create or replace function public.${functionName}`;
  const start = sql.toLowerCase().lastIndexOf(marker);
  if (start === -1) {
    return null;
  }

  const fromStart = sql.slice(start);
  const revokeIdx = fromStart.toLowerCase().indexOf(`revoke all on function public.${functionName}`);
  if (revokeIdx === -1) {
    return fromStart.slice(0, 8000);
  }

  // Include grants immediately after revoke for execute permission checks.
  const afterRevoke = fromStart.slice(revokeIdx);
  const grantEnd = afterRevoke.indexOf(';', afterRevoke.toLowerCase().indexOf('grant execute'));
  if (grantEnd === -1) {
    return fromStart.slice(0, revokeIdx + 500);
  }

  return fromStart.slice(0, revokeIdx + grantEnd + 1);
}

const migrationFiles = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort();

const latestPurchaseOptionsEntry = [...migrationFiles]
  .reverse()
  .map((f) => ({
    name: f,
    sql: readFileSync(join(MIGRATIONS_DIR, f), 'utf8'),
  }))
  .find((entry) =>
    entry.sql.includes('create or replace function public.get_public_event_purchase_options'),
  );

if (!latestPurchaseOptionsEntry) {
  console.error('✗ could not find get_public_event_purchase_options definition');
  process.exit(1);
}

const rpcLatest =
  extractFunctionSql(
    latestPurchaseOptionsEntry.sql,
    'get_public_event_purchase_options',
  ) ?? latestPurchaseOptionsEntry.sql;

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
  rpcMigration.includes('create or replace function public.get_public_event_purchase_options'),
  'migration defines get_public_event_purchase_options',
);
assert(
  rpcLatest.includes('security definer'),
  'get_public_event_purchase_options is SECURITY DEFINER',
);
assert(
  rpcLatest.includes('set search_path = public'),
  'get_public_event_purchase_options uses fixed search_path',
);
assert(
  rpcLatest.includes(
    "grant execute on function public.get_public_event_purchase_options(uuid) to anon, authenticated",
  ),
  'get_public_event_purchase_options granted to anon and authenticated',
);
assert(
  rpcLatest.includes("v_event.status <> 'published'"),
  'function checks event.status = published',
);
assert(rpcLatest.includes('not v_event.sales_enabled'), 'function checks sales_enabled = true');
assert(
  rpcLatest.includes("v_event.ticketing_mode not in ('paid', 'mixed')"),
  'function checks ticketing_mode in paid/mixed',
);
assert(
  rpcLatest.includes('event_issued_pass_count'),
  'function uses event_issued_pass_count for quantity_available',
);
assert(
  rpcLatest.includes('event_reserved_pass_count'),
  'function uses event_reserved_pass_count for quantity_available',
);
assert(
  rpcLatest.includes('ticket_type_issued_pass_count'),
  'function uses ticket_type_issued_pass_count for quantity_available',
);
assert(
  rpcLatest.includes('ticket_type_reserved_pass_count'),
  'function uses ticket_type_reserved_pass_count for quantity_available',
);
assert(rpcLatest.includes('tt.is_active = true'), 'function filters inactive ticket types');
assert(
  rpcLatest.includes('sales_start_at') && rpcLatest.includes('sales_end_at'),
  'function filters ticket types by sales window',
);
assert(
  rpcLatest.includes('processing_fee_bps') && rpcLatest.includes('processing_fee_fixed_cents'),
  'latest purchase options expose processing fee rates for transparent checkout',
);
assert(
  !rpcLatest.includes('stripe_checkout_session_id'),
  'function does not expose stripe_checkout_session_id',
);
assert(
  !rpcLatest.includes('stripe_payment_intent_id'),
  'function does not expose stripe_payment_intent_id',
);
assert(
  !rpcLatest.includes('public_access_token'),
  'function does not expose order public_access_token',
);
assert(!rpcLatest.includes('organizer_id'), 'function does not expose organizer_id');
assert(
  !rlsMigration.includes('on public.orders') || !rlsMigration.includes('to anon'),
  'no broad anon SELECT policy on orders',
);
assert(
  !rlsMigration.includes('on public.payments') || !rlsMigration.includes('to anon'),
  'no broad anon SELECT policy on payments',
);
assert(
  verification.includes('get_public_event_purchase_options'),
  'verification exercises get_public_event_purchase_options',
);
assert(
  verification.includes('purchase options leaked stripe field'),
  'verification asserts no stripe fields in purchase options JSON',
);
assert(
  latestPurchaseOptionsEntry.name.endsWith('platform_admin_cockpit.sql') ||
    latestPurchaseOptionsEntry.name.endsWith('platform_admin_fees_payout_rpcs.sql') ||
    latestPurchaseOptionsEntry.name === '20260610150000_payments_public_purchase_options.sql',
  `latest purchase options definition is tracked (${latestPurchaseOptionsEntry.name})`,
);

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}

console.log('\nAll public purchase options checks passed.');
