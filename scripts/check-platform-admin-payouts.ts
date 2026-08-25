#!/usr/bin/env npx tsx
/**
 * Platform admin identity, fee lock, transparent fees, payout RPC guards.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const MIGRATIONS_DIR = join(ROOT, 'supabase/migrations');
const ADMIN_MIGRATION = join(
  ROOT,
  'supabase/migrations/20260824140000_platform_admin_fees_payout_rpcs.sql',
);
const VERIFICATION_PATH = join(ROOT, 'supabase/verification-payments.sql');
const PAYOUT_DOC = join(ROOT, 'docs/PAYOUT_RULES.md');
const P0_DOC = join(ROOT, 'docs/P0_ACCEPTANCE.md');
const RUNBOOK = join(ROOT, 'docs/EVENT_DAY_RUNBOOK.md');
const TICKET_FEES = join(ROOT, 'src/lib/ticket-fees.ts');
const BUY_ROUTE = join(ROOT, 'src/app/events/[eventId]/buy.tsx');
const FEE_SUMMARY = join(ROOT, 'src/components/purchase/purchase-fee-summary.tsx');
const ORDER_EMAIL = join(ROOT, 'supabase/functions/_shared/order-email.ts');
const ORDER_EMAIL_TEMPLATE = join(
  ROOT,
  'supabase/functions/_shared/order-email-template.ts',
);
const SHARED_STRIPE = join(ROOT, 'supabase/functions/_shared/stripe.ts');

const adminMigration = readFileSync(ADMIN_MIGRATION, 'utf8');
const verification = readFileSync(VERIFICATION_PATH, 'utf8');
const payoutDoc = readFileSync(PAYOUT_DOC, 'utf8');
const p0Doc = readFileSync(P0_DOC, 'utf8');
const runbook = readFileSync(RUNBOOK, 'utf8');
const ticketFees = readFileSync(TICKET_FEES, 'utf8');
const buyRoute = readFileSync(BUY_ROUTE, 'utf8');
const feeSummary = readFileSync(FEE_SUMMARY, 'utf8');
const orderEmail = readFileSync(ORDER_EMAIL, 'utf8');
const orderEmailTemplate = readFileSync(ORDER_EMAIL_TEMPLATE, 'utf8');
const sharedStripe = readFileSync(SHARED_STRIPE, 'utf8');

let failures = 0;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`✗ ${message}`);
    failures += 1;
    return;
  }
  console.log(`✓ ${message}`);
}

assert(existsSync(ADMIN_MIGRATION), 'platform admin / fee migration exists');
assert(existsSync(PAYOUT_DOC), 'docs/PAYOUT_RULES.md exists');
assert(existsSync(TICKET_FEES), 'src/lib/ticket-fees.ts exists');

assert(
  adminMigration.includes('is_platform_admin boolean not null default false'),
  'profiles.is_platform_admin default false',
);
assert(
  adminMigration.includes('create or replace function public.is_platform_admin'),
  'is_platform_admin() helper exists',
);
assert(
  adminMigration.includes('enforce_platform_admin_flag'),
  'is_platform_admin self-promotion blocked by trigger',
);
assert(
  adminMigration.includes('alter column platform_fee_bps set default 250'),
  'default service fee bps is 250 (2.5%)',
);
assert(
  adminMigration.includes('alter column platform_fee_fixed_cents set default 99'),
  'default service fee fixed is 99¢ per ticket',
);
assert(
  adminMigration.includes('processing_fee_bps integer not null default 290'),
  'processing fee bps column exists (2.9%)',
);
assert(
  adminMigration.includes('processing_fee_fixed_cents integer not null default 30'),
  'processing fee fixed column exists ($0.30)',
);
assert(
  adminMigration.includes('enforce_event_fee_lock'),
  'event fee lock trigger exists',
);
assert(
  adminMigration.includes('create or replace function public.calculate_order_fees'),
  'calculate_order_fees helper exists',
);
assert(
  adminMigration.includes('processing_fee_cents'),
  'create_pending_order tracks processing_fee_cents',
);
assert(
  adminMigration.includes('create or replace function public.admin_list_payouts'),
  'admin_list_payouts exists',
);
assert(
  adminMigration.includes('create or replace function public.admin_set_payout_status'),
  'admin_set_payout_status exists',
);
assert(
  adminMigration.includes("raise exception 'Platform admin required'"),
  'admin payout RPCs reject non-admins',
);
assert(
  /grant execute on function public\.admin_list_payouts\([^)]+\)\s+to authenticated, service_role/.test(
    adminMigration,
  ),
  'admin_list_payouts granted to authenticated + service_role only',
);
assert(
  !/grant execute on function public\.admin_list_payouts\([^)]+\)\s+to[^;]*anon/.test(adminMigration),
  'admin_list_payouts is not granted to anon',
);

assert(
  verification.includes('Non-admin must not change platform_fee_bps') ||
    verification.includes('Platform admin required'),
  'verification covers non-admin fee lock / admin RPC denial',
);
assert(
  verification.includes('admin_set_payout_status'),
  'verification covers admin_set_payout_status',
);
assert(
  verification.includes('platform fee mismatch') && verification.includes('323'),
  'verification expects launch service fee math (323¢ for $50 / 2 tickets)',
);
assert(
  verification.includes('processing fee mismatch') && verification.includes('190'),
  'verification expects processing fee math (190¢)',
);

assert(ticketFees.includes("SERVICE_FEE_LABEL = '808Tickets service fee'"), 'service fee label constant');
assert(
  ticketFees.includes("PROCESSING_FEE_LABEL = 'Payment processing fee'"),
  'processing fee label constant',
);
assert(buyRoute.includes('SERVICE_FEE_LABEL'), 'buy page uses service fee label');
assert(buyRoute.includes('PROCESSING_FEE_LABEL'), 'buy page uses processing fee label');
assert(feeSummary.includes('SERVICE_FEE_LABEL'), 'success fee summary uses service fee label');
assert(feeSummary.includes('PROCESSING_FEE_LABEL'), 'success fee summary uses processing fee label');
assert(
  orderEmail.includes('SERVICE_FEE_LABEL') &&
    orderEmailTemplate.includes('808Tickets service fee'),
  'order email labels service fee',
);
assert(
  orderEmail.includes('PROCESSING_FEE_LABEL') &&
    orderEmailTemplate.includes('Payment processing fee'),
  'order email labels processing fee',
);
assert(sharedStripe.includes('808Tickets service fee'), 'Stripe line item labels service fee');
assert(sharedStripe.includes('Payment processing fee'), 'Stripe line item labels processing fee');

assert(payoutDoc.includes('2.5%'), 'PAYOUT_RULES documents 2.5% service fee');
assert(payoutDoc.includes('$0.99'), 'PAYOUT_RULES documents $0.99 per ticket');
assert(payoutDoc.includes('3 business days'), 'PAYOUT_RULES documents T+3 payout timing');
assert(payoutDoc.includes('Stripe Connect'), 'PAYOUT_RULES notes Connect deferred');
assert(payoutDoc.includes('is_platform_admin'), 'PAYOUT_RULES documents admin promotion');
assert(p0Doc.includes('PAYOUT_RULES.md'), 'P0_ACCEPTANCE links PAYOUT_RULES');
assert(runbook.includes('PAYOUT_RULES.md'), 'EVENT_DAY_RUNBOOK links PAYOUT_RULES');

const laterMigrations = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith('.sql') && f > '20260824140000_platform_admin_fees_payout_rpcs.sql')
  .map((f) => readFileSync(join(MIGRATIONS_DIR, f), 'utf8'))
  .join('\n');

assert(
  !laterMigrations.includes('create or replace function public.validate_pass('),
  'no later migration redefines validate_pass',
);

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}

console.log('\nAll platform admin / payout fee checks passed.');
