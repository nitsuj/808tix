#!/usr/bin/env npx tsx
/**
 * Post-purchase email delivery guards (Phase 1.6 foundation + provider wrapper).
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const MIGRATIONS_DIR = join(ROOT, 'supabase/migrations');
const OUTBOUND_MIGRATION = join(
  ROOT,
  'supabase/migrations/20260610170000_outbound_messages.sql',
);
const VERIFICATION_PATH = join(ROOT, 'supabase/verification-outbound-messages.sql');
const LIFECYCLE_MIGRATION = join(
  ROOT,
  'supabase/migrations/20260610130000_payments_phase1_lifecycle.sql',
);
const STRIPE_WEBHOOK = join(ROOT, 'supabase/functions/stripe-webhook/index.ts');
const CHECKOUT_FN = join(ROOT, 'supabase/functions/create-checkout-session/index.ts');
const ORDER_EMAIL_SHARED = join(ROOT, 'supabase/functions/_shared/order-email.ts');
const PASS_LINK_SERVER = join(ROOT, 'supabase/functions/_shared/pass-link-server.ts');
const SEND_ORDER_EMAIL_FN = join(
  ROOT,
  'supabase/functions/send-order-confirmation-email/index.ts',
);
const CONFIG_TOML = join(ROOT, 'supabase/config.toml');
const SRC_DIR = join(ROOT, 'src');
const ENV_EXAMPLE = join(ROOT, 'supabase/functions/.env.example');
const STRIPE_PAYMENTS_DOC = join(ROOT, 'docs/STRIPE_PAYMENTS.md');

const outboundMigration = readFileSync(OUTBOUND_MIGRATION, 'utf8');
const verification = readFileSync(VERIFICATION_PATH, 'utf8');
const lifecycleMigration = readFileSync(LIFECYCLE_MIGRATION, 'utf8');
const stripeWebhook = readFileSync(STRIPE_WEBHOOK, 'utf8');
const checkoutFn = readFileSync(CHECKOUT_FN, 'utf8');
const orderEmailShared = readFileSync(ORDER_EMAIL_SHARED, 'utf8');
const passLinkServer = readFileSync(PASS_LINK_SERVER, 'utf8');
const sendOrderEmailFn = readFileSync(SEND_ORDER_EMAIL_FN, 'utf8');
const configToml = readFileSync(CONFIG_TOML, 'utf8');
const envExample = readFileSync(ENV_EXAMPLE, 'utf8');
const stripePaymentsDoc = readFileSync(STRIPE_PAYMENTS_DOC, 'utf8');

let failures = 0;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`✗ ${message}`);
    failures += 1;
    return;
  }
  console.log(`✓ ${message}`);
}

const requiredColumns = [
  'order_id',
  'recipient',
  'channel',
  'message_type',
  'status',
  'provider',
  'provider_message_id',
  'error',
  'attempt_count',
  'idempotency_key',
  'payload_snapshot',
  'sent_at',
  'created_at',
  'updated_at',
];

assert(existsSync(OUTBOUND_MIGRATION), 'outbound_messages migration exists');
assert(existsSync(ORDER_EMAIL_SHARED), 'order-email shared helper exists');
assert(existsSync(PASS_LINK_SERVER), 'pass-link-server shared helper exists');
assert(existsSync(SEND_ORDER_EMAIL_FN), 'send-order-confirmation-email function exists');

assert(
  outboundMigration.includes('create table public.outbound_messages'),
  'migration creates public.outbound_messages',
);

for (const column of requiredColumns) {
  assert(outboundMigration.includes(column), `outbound_messages includes column ${column}`);
}

assert(
  outboundMigration.includes('outbound_messages_idempotency_key_unique') ||
    outboundMigration.includes('unique (idempotency_key)'),
  'idempotency_key has unique constraint',
);

assert(
  outboundMigration.includes("channel in ('email', 'sms')"),
  'channel check supports email and sms',
);

assert(
  outboundMigration.includes("'pending'") &&
    outboundMigration.includes("'sent'") &&
    outboundMigration.includes("'failed'") &&
    outboundMigration.includes("'skipped'"),
  'status check supports pending/sent/failed/skipped',
);

assert(
  outboundMigration.includes('enable row level security'),
  'outbound_messages RLS enabled',
);

assert(
  !outboundMigration.includes('to anon') && !outboundMigration.includes('to authenticated'),
  'outbound_messages migration has no anon/authenticated policies',
);

assert(
  verification.includes('duplicate idempotency_key should be rejected'),
  'verification covers idempotency_key uniqueness',
);

assert(
  !outboundMigration.includes('create or replace function public.fulfill_paid_order'),
  'outbound migration does not modify fulfill_paid_order',
);

assert(
  lifecycleMigration.includes('create or replace function public.fulfill_paid_order'),
  'fulfill_paid_order remains defined in lifecycle migration only',
);

assert(
  !stripeWebhook.includes('order-email') &&
    !stripeWebhook.includes('sendOrderConfirmationEmail') &&
    !stripeWebhook.includes('outbound_messages'),
  'stripe-webhook is not wired for email delivery yet',
);

assert(
  !checkoutFn.includes('order-email') && !checkoutFn.includes('sendOrderConfirmationEmail'),
  'create-checkout-session is not wired for email delivery',
);

assert(
  orderEmailShared.includes('buildOrderConfirmationEmail') &&
    orderEmailShared.includes('sendOrderConfirmationEmail') &&
    orderEmailShared.includes('claimOutboundMessage') &&
    orderEmailShared.includes('markOutboundMessageSent') &&
    orderEmailShared.includes('markOutboundMessageFailed'),
  'order-email shared helper includes builder, sender, and outbound claim helpers',
);

assert(
  orderEmailShared.includes('order_confirmation:${orderId}') ||
    orderEmailShared.includes('`order_confirmation:${orderId.trim()}`'),
  'idempotency key uses order_confirmation:{order_id}',
);

assert(
  orderEmailShared.includes('claimOutboundMessage') &&
    orderEmailShared.indexOf('claimOutboundMessage') <
      orderEmailShared.indexOf('sendEmailWithResend'),
  'provider call happens after outbound_messages claim',
);

assert(
  (orderEmailShared.includes('isPreviewDeliveryMode') ||
    passLinkServer.includes('EMAIL_DELIVERY_MODE')) &&
    orderEmailShared.includes("provider: 'preview'"),
  'preview mode exists in order-email helper',
);

assert(
  orderEmailShared.includes('EMAIL_OVERRIDE_TO'),
  'EMAIL_OVERRIDE_TO override exists in order-email helper',
);

assert(
  passLinkServer.includes('PUBLIC_SITE_URL') &&
    passLinkServer.includes('buildPassLinkUrl') &&
    passLinkServer.includes('buildPurchaseSuccessUrl') &&
    !passLinkServer.includes('EXPO_PUBLIC_'),
  'pass-link-server uses PUBLIC_SITE_URL without EXPO_PUBLIC_*',
);

assert(
  orderEmailShared.includes('sendEmailWithResend') &&
    orderEmailShared.includes('api.resend.com/emails'),
  'order-email uses Resend REST API without package dependency',
);

const sendOrderEmailSuccessResponse = sendOrderEmailFn.slice(
  sendOrderEmailFn.indexOf('already_sent: sendResult.already_sent'),
);

assert(
  sendOrderEmailFn.includes('assertServiceRoleAuth') &&
    sendOrderEmailFn.includes('maskRecipientEmail') &&
    !sendOrderEmailSuccessResponse.includes('secure_token') &&
    !sendOrderEmailSuccessResponse.includes('pass_url'),
  'send-order-confirmation-email requires service role and does not return secure tokens or pass URLs',
);

assert(
  configToml.includes('[functions.send-order-confirmation-email]') &&
    configToml.includes('verify_jwt = false'),
  'send-order-confirmation-email registered with verify_jwt = false',
);

assert(
  envExample.includes('RESEND_API_KEY') &&
    envExample.includes('EMAIL_FROM') &&
    envExample.includes('PUBLIC_SITE_URL') &&
    envExample.includes('EMAIL_DELIVERY_MODE') &&
    envExample.includes('EMAIL_OVERRIDE_TO'),
  '.env.example documents email env vars',
);

assert(
  stripePaymentsDoc.includes('outbound_messages') &&
    stripePaymentsDoc.includes('send-order-confirmation-email'),
  'STRIPE_PAYMENTS.md documents manual email test flow',
);

function walkTsFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const full = join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...walkTsFiles(full));
      continue;
    }

    if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(full);
    }
  }

  return files;
}

const forbiddenClientPaths = [join(SRC_DIR, 'app'), join(SRC_DIR, 'components')];

for (const baseDir of forbiddenClientPaths) {
  if (!existsSync(baseDir)) {
    continue;
  }

  for (const file of walkTsFiles(baseDir)) {
    const content = readFileSync(file, 'utf8');
    const rel = file.replace(`${ROOT}/`, '');

    assert(!content.includes('RESEND_API_KEY'), `${rel} does not reference RESEND_API_KEY`);
    assert(!content.includes('EMAIL_OVERRIDE_TO'), `${rel} does not reference EMAIL_OVERRIDE_TO`);
    assert(
      !content.includes('EXPO_PUBLIC_RESEND') && !content.includes('EXPO_PUBLIC_EMAIL'),
      `${rel} does not expose email secrets via EXPO_PUBLIC_*`,
    );
  }
}

const postOutboundMigrations = readdirSync(MIGRATIONS_DIR)
  .filter((name) => name.endsWith('.sql') && name > '20260610170000_outbound_messages.sql')
  .map((name) => readFileSync(join(MIGRATIONS_DIR, name), 'utf8'))
  .join('\n');

assert(
  !postOutboundMigrations.includes('create or replace function public.fulfill_paid_order'),
  'no migration after outbound_messages redefines fulfill_paid_order',
);

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}

console.log('\nAll order email checks passed.');
