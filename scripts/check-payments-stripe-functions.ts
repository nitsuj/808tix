#!/usr/bin/env npx tsx
/**
 * Stripe Edge Function guards for Payments Phase 1.5.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const SRC_DIR = join(ROOT, 'src');
const CHECKOUT_FN = join(ROOT, 'supabase/functions/create-checkout-session/index.ts');
const WEBHOOK_FN = join(ROOT, 'supabase/functions/stripe-webhook/index.ts');
const SHARED_STRIPE = join(ROOT, 'supabase/functions/_shared/stripe.ts');
const CONFIG_TOML = join(ROOT, 'supabase/config.toml');
const DOCS = join(ROOT, 'docs/STRIPE_PAYMENTS.md');

const checkoutFn = readFileSync(CHECKOUT_FN, 'utf8');
const webhookFn = readFileSync(WEBHOOK_FN, 'utf8');
const sharedStripe = readFileSync(SHARED_STRIPE, 'utf8');
const configToml = readFileSync(CONFIG_TOML, 'utf8');
const docs = existsSync(DOCS) ? readFileSync(DOCS, 'utf8') : '';

let failures = 0;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`✗ ${message}`);
    failures += 1;
    return;
  }
  console.log(`✓ ${message}`);
}

assert(existsSync(CHECKOUT_FN), 'create-checkout-session function exists');
assert(existsSync(WEBHOOK_FN), 'stripe-webhook function exists');

assert(
  checkoutFn.includes("createServiceClient") || checkoutFn.includes('createServiceClient()'),
  'create-checkout-session uses service-role Supabase client',
);
assert(
  checkoutFn.includes("'create_pending_order'") || checkoutFn.includes('"create_pending_order"'),
  'create-checkout-session calls create_pending_order RPC',
);
assert(
  checkoutFn.includes("status: 'checkout_open'"),
  'create-checkout-session sets checkout_open after Stripe session creation',
);
assert(
  checkoutFn.includes('order_token'),
  'create-checkout-session appends order_token to success/cancel URLs',
);
assert(
  !checkoutFn.includes('fulfill_paid_order'),
  'create-checkout-session does not call fulfill_paid_order',
);
assert(
  !checkoutFn.includes("from('passes')") && !checkoutFn.includes('.from("passes")'),
  'create-checkout-session does not insert passes directly',
);

assert(
  webhookFn.includes('verifyStripeWebhookSignature'),
  'stripe-webhook verifies Stripe-Signature',
);
assert(
  webhookFn.includes('Stripe-Signature'),
  'stripe-webhook reads Stripe-Signature header',
);
assert(
  webhookFn.includes("'fulfill_paid_order'") || webhookFn.includes('"fulfill_paid_order"'),
  'stripe-webhook calls fulfill_paid_order RPC',
);
assert(
  webhookFn.includes('checkout.session.completed'),
  'stripe-webhook handles checkout.session.completed',
);
assert(
  webhookFn.includes('checkout.session.expired'),
  'stripe-webhook handles checkout.session.expired',
);
assert(
  webhookFn.includes("from('payment_events')") || webhookFn.includes('.from("payment_events")'),
  'stripe-webhook records payment_events',
);
assert(
  webhookFn.includes('metadata.order_id') || webhookFn.includes("'order_id'"),
  'stripe-webhook reads order_id from session metadata',
);
assert(
  !webhookFn.includes("from('passes')") && !webhookFn.includes('.from("passes")'),
  'stripe-webhook does not insert passes directly',
);

assert(
  sharedStripe.includes('/checkout/sessions'),
  'shared stripe helper calls Stripe Checkout API',
);

assert(
  configToml.includes('[functions.create-checkout-session]') &&
    configToml.includes('verify_jwt = false'),
  'create-checkout-session has verify_jwt = false',
);
assert(
  configToml.includes('[functions.stripe-webhook]') && configToml.includes('verify_jwt = false'),
  'stripe-webhook has verify_jwt = false',
);

assert(docs.includes('STRIPE_SECRET_KEY'), 'docs mention STRIPE_SECRET_KEY');
assert(docs.includes('STRIPE_WEBHOOK_SECRET'), 'docs mention STRIPE_WEBHOOK_SECRET');
assert(docs.includes('stripe listen'), 'docs include Stripe CLI webhook forwarding');

assert(
  sharedStripe.includes('processingFeeCents') &&
    sharedStripe.includes('808Tickets service fee') &&
    sharedStripe.includes('Payment processing fee'),
  'Stripe checkout creates separate labeled service + processing fee line items',
);
assert(
  checkoutFn.includes('processingFeeCents') || checkoutFn.includes('processing_fee_cents'),
  'create-checkout-session passes processing fee to Stripe helper',
);

const smokeLocal = readFileSync(join(ROOT, 'scripts/smoke-payments-local.ts'), 'utf8');
const smokePreview = readFileSync(join(ROOT, 'scripts/smoke-payments-preview.ts'), 'utf8');
assert(
  smokeLocal.includes('GUEST_WEB_ORIGIN') && smokeLocal.includes('stripe-webhook reachable'),
  'smoke:payments:local preflights Expo web + webhook reachability',
);
assert(
  smokeLocal.includes('processing_fee_cents') && smokeLocal.includes('platform_fee_cents'),
  'smoke:payments:local asserts transparent fee columns',
);
assert(
  smokeLocal.includes('autoPayCheckout') || smokeLocal.includes('autoCompleteCheckoutViaPlaywright'),
  'smoke:payments:local supports automatic Stripe Checkout payment',
);
assert(
  smokePreview.includes('127.0.0.1:8081') && smokePreview.includes('assertSuccessPageReachable'),
  'smoke:payments:preview uses exact redirect origin and success-page preflight',
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

const stripeSecretPattern = /sk_(live|test)_[a-zA-Z0-9]+/;
const webhookSecretPattern = /whsec_[a-zA-Z0-9]+/;

for (const file of walkTsFiles(SRC_DIR)) {
  const content = readFileSync(file, 'utf8');
  const rel = file.replace(`${ROOT}/`, '');
  assert(!stripeSecretPattern.test(content), `no Stripe secret key in ${rel}`);
  assert(!webhookSecretPattern.test(content), `no Stripe webhook secret in ${rel}`);
  assert(!content.includes('STRIPE_SECRET_KEY'), `no STRIPE_SECRET_KEY reference in ${rel}`);
  assert(!content.includes('STRIPE_WEBHOOK_SECRET'), `no STRIPE_WEBHOOK_SECRET reference in ${rel}`);
}

const checkoutMintPattern =
  /checkout\.sessions\.create|createCheckoutSession|stripe\.checkout/i;
const successMintPattern = /mint.*pass|insert.*passes/i;

for (const file of walkTsFiles(SRC_DIR)) {
  const content = readFileSync(file, 'utf8');
  const rel = file.replace(`${ROOT}/`, '');
  assert(!checkoutMintPattern.test(content), `no client checkout session minting in ${rel}`);
  assert(!successMintPattern.test(content), `no client pass minting in ${rel}`);
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}

console.log('\nAll payments Stripe function checks passed.');
