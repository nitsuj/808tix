#!/usr/bin/env npx tsx
/**
 * Launch security hardening guards (checkout token, create_pending_order grants,
 * pass token integrity, validate_pass PII, fee-config anon access).
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const MIGRATION = join(
  ROOT,
  'supabase/migrations/20260902120000_launch_security_hardening.sql',
);
const CHECKOUT_FN = join(ROOT, 'supabase/functions/create-checkout-session/index.ts');
const PASS_LINK = join(ROOT, 'supabase/functions/_shared/pass-link-server.ts');
const CLIENT_CHECKOUT = join(ROOT, 'src/lib/create-checkout-session.ts');
const BUY_ROUTE = join(ROOT, 'src/app/events/[eventId]/buy.tsx');
const SMOKE_LOCAL = join(ROOT, 'scripts/smoke-payments-local.ts');
const SMOKE_PREVIEW = join(ROOT, 'scripts/smoke-payments-preview.ts');
const LIFECYCLE_CHECK = join(ROOT, 'scripts/check-payments-lifecycle.ts');
const STRIPE_CHECK = join(ROOT, 'scripts/check-payments-stripe-functions.ts');
const SRC_DIR = join(ROOT, 'src');

let failures = 0;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`✗ ${message}`);
    failures += 1;
    return;
  }
  console.log(`✓ ${message}`);
}

assert(existsSync(MIGRATION), 'launch security hardening migration exists');

const migration = readFileSync(MIGRATION, 'utf8');
const checkoutFn = readFileSync(CHECKOUT_FN, 'utf8');
const passLink = readFileSync(PASS_LINK, 'utf8');
const clientCheckout = readFileSync(CLIENT_CHECKOUT, 'utf8');
const buyRoute = readFileSync(BUY_ROUTE, 'utf8');
const smokeLocal = readFileSync(SMOKE_LOCAL, 'utf8');
const smokePreview = readFileSync(SMOKE_PREVIEW, 'utf8');
const lifecycleCheck = readFileSync(LIFECYCLE_CHECK, 'utf8');
const stripeCheck = readFileSync(STRIPE_CHECK, 'utf8');

// H1 — no pre-payment token in Edge response
assert(
  !/order_public_access_token:\s*publicAccessToken/.test(checkoutFn) &&
    !checkoutFn.includes("order_public_access_token: publicAccessToken"),
  'create-checkout-session does not return order_public_access_token',
);
assert(
  checkoutFn.includes('checkout_session_id: checkoutSession.id') ||
    checkoutFn.includes('checkout_session_id: checkoutSession'),
  'create-checkout-session returns checkout_session_id',
);
assert(
  checkoutFn.includes('resolveCheckoutSiteOrigin') || checkoutFn.includes('isAllowedCheckoutOrigin'),
  'create-checkout-session builds allowlisted redirect origin',
);
assert(
  checkoutFn.includes('Allowlisted local PUBLIC_SITE_URL') ||
    checkoutFn.includes('isLocalHostname(parsed.hostname)'),
  'local PUBLIC_SITE_URL preferred for checkout redirects',
);
assert(
  smokePreview.includes('EXPO_WEB_URL') &&
    smokePreview.includes('Preview smoke always redirects buyers to local Expo web'),
  'smoke:payments:preview forces local PUBLIC_SITE_URL',
);
assert(
  checkoutFn.includes('808tickets.com') && checkoutFn.includes('127.0.0.1'),
  'create-checkout-session allowlist includes hosted + local origins',
);
assert(
  checkoutFn.includes('buildPurchaseSuccessUrl') && passLink.includes('order_token'),
  'success URL built server-side with order_token',
);
assert(
  checkoutFn.includes('/buy') || checkoutFn.includes('buildCheckoutCancelUrl'),
  'cancel URL built server-side to buy page',
);
assert(
  checkoutFn.includes('Client-supplied success/cancel') ||
    checkoutFn.includes('Ignored for redirect') ||
    checkoutFn.includes('open-redirect'),
  'client success/cancel URLs are ignored',
);
assert(!clientCheckout.includes('successUrl'), 'client checkout helper does not send successUrl');
assert(!clientCheckout.includes('cancelUrl'), 'client checkout helper does not send cancelUrl');
assert(
  clientCheckout.includes('order_public_access_token') &&
    clientCheckout.includes('exposed a pre-payment order token'),
  'client rejects leaked pre-payment tokens',
);
assert(!buyRoute.includes('successUrl:'), 'buy route does not pass successUrl');
assert(
  smokeLocal.includes('evil.example') && smokeLocal.includes('leaked a pre-payment order token'),
  'smoke asserts untrusted redirects ignored and tokens not leaked',
);

// H2 — anon revoked
assert(
  migration.includes('revoke all on function public.create_pending_order') &&
    migration.includes('from anon, authenticated'),
  'migration revokes create_pending_order from anon/authenticated',
);
assert(
  migration.includes(
    'grant execute on function public.create_pending_order(uuid, text, uuid, integer, text, text) to service_role',
  ),
  'migration grants create_pending_order to service_role only',
);
assert(
  migration.includes('quantity cannot exceed') && migration.includes('v_max_quantity'),
  'create_pending_order enforces max quantity',
);
assert(
  checkoutFn.includes('createServiceClient') &&
    (checkoutFn.includes("'create_pending_order'") || checkoutFn.includes('"create_pending_order"')),
  'Edge Function still creates pending orders via service-role client',
);
assert(
  lifecycleCheck.includes('service_role') && lifecycleCheck.includes('not granted to anon'),
  'lifecycle check expects service_role-only create_pending_order',
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

let frontendCallsCreatePending = false;
for (const file of walkTsFiles(SRC_DIR)) {
  const content = readFileSync(file, 'utf8');
  if (
    content.includes("rpc('create_pending_order'") ||
    content.includes('rpc("create_pending_order"')
  ) {
    frontendCallsCreatePending = true;
    console.error(`✗ frontend calls create_pending_order directly (${file.replace(`${ROOT}/`, '')})`);
  }
}
assert(!frontendCallsCreatePending, 'frontend does not call create_pending_order directly');

// H3 — pass token hardening
assert(
  migration.includes('Always overwrite client-supplied tokens') ||
    migration.includes('gen_random_bytes(32)'),
  'pass secure_token always server-generated on insert',
);
assert(
  migration.includes('new.secure_token := old.secure_token'),
  'pass secure_token preserved on update',
);
assert(
  migration.includes('prevent_paid_pass_delete') &&
    migration.includes('Paid tickets cannot be deleted'),
  'paid passes cannot be deleted by clients',
);
assert(
  migration.includes("old.source = 'paid'") && migration.includes('new.order_id := old.order_id'),
  'paid pass identity fields locked on update',
);

// M1
assert(
  migration.includes('Unauthorized scanners must not receive guest_name') ||
    migration.includes('must not receive guest_name'),
  'validate_pass unauthorized path documented as no-PII',
);
assert(
  /if not found or v_event_organizer_id is distinct from v_scanned_by then[\s\S]*return jsonb_build_object\('result', 'invalid'\);/.test(
    migration,
  ),
  'unauthorized validate_pass returns only result=invalid',
);
assert(
  migration.includes("v_result := 'valid'") && migration.includes("'already_used'"),
  'authorized validate_pass paths preserved',
);

// M2
assert(
  migration.includes('revoke all on function public.resolve_effective_fee_config(uuid) from anon'),
  'resolve_effective_fee_config revoked from anon',
);
assert(
  migration.includes(
    'grant execute on function public.resolve_effective_fee_config(uuid) to authenticated, service_role',
  ),
  'resolve_effective_fee_config granted to authenticated + service_role',
);

assert(
  stripeCheck.includes('does not return order_public_access_token') ||
    stripeCheck.includes('no pre-payment order token'),
  'stripe function check covers pre-payment token hardening',
);

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}

console.log('\nAll launch security hardening checks passed.');
