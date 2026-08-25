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
  stripeWebhook.includes("from '../_shared/order-email.ts'") ||
    stripeWebhook.includes('from "../_shared/order-email.ts"'),
  'stripe-webhook imports order-email shared helper',
);

assert(
  stripeWebhook.includes('sendOrderConfirmationEmail'),
  'stripe-webhook calls sendOrderConfirmationEmail',
);

assert(
  stripeWebhook.includes('await triggerOrderConfirmationEmail(orderId)'),
  'stripe-webhook triggers order confirmation email after fulfillment',
);

const checkoutHandlerStart = stripeWebhook.indexOf('async function handleCheckoutSessionCompleted');
const checkoutHandlerEnd = stripeWebhook.indexOf('async function handleCheckoutSessionExpired');
const checkoutHandlerBody = stripeWebhook.slice(checkoutHandlerStart, checkoutHandlerEnd);

assert(
  checkoutHandlerBody.includes('fulfill_paid_order') &&
    checkoutHandlerBody.includes('triggerOrderConfirmationEmail') &&
    checkoutHandlerBody.indexOf('fulfill_paid_order') <
      checkoutHandlerBody.indexOf('triggerOrderConfirmationEmail'),
  'stripe-webhook sends email after fulfill_paid_order in checkout handler',
);

assert(
  stripeWebhook.includes('triggerOrderConfirmationEmail'),
  'stripe-webhook isolates order confirmation email in helper',
);

assert(
  stripeWebhook.includes('try {') && stripeWebhook.includes('catch (error)'),
  'stripe-webhook catches email errors without failing fulfillment',
);

assert(
  stripeWebhook.includes('maskRecipientEmail'),
  'stripe-webhook masks recipient email in logs',
);

const webhookLogLines = stripeWebhook
  .split('\n')
  .filter(
    (line) =>
      line.includes('console.log') || line.includes('console.error') || line.includes('console.warn'),
  );

for (const line of webhookLogLines) {
  assert(
    !line.includes('secure_token'),
    'stripe-webhook logs must not include secure_token',
  );
  assert(!line.includes('pass_url'), 'stripe-webhook logs must not include pass_url');
  assert(
    !line.includes('public_access_token'),
    'stripe-webhook logs must not include public_access_token',
  );
}

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

const ORDER_EMAIL_TEMPLATE = join(
  ROOT,
  'supabase/functions/_shared/order-email-template.ts',
);
assert(existsSync(ORDER_EMAIL_TEMPLATE), 'order-email-template shared module exists');
const orderEmailTemplate = readFileSync(ORDER_EMAIL_TEMPLATE, 'utf8');

assert(
  orderEmailShared.includes('SERVICE_FEE_LABEL') &&
    orderEmailShared.includes('PROCESSING_FEE_LABEL') &&
    orderEmailTemplate.includes('808Tickets service fee') &&
    orderEmailTemplate.includes('Payment processing fee'),
  'order confirmation email itemizes transparent fee labels',
);

assert(
  orderEmailShared.includes("from './order-email-template.ts'") ||
    orderEmailShared.includes('from "./order-email-template.ts"'),
  'order-email imports branded template module',
);

assert(
  orderEmailTemplate.includes('renderOrderConfirmationHtml') &&
    orderEmailTemplate.includes('renderOrderConfirmationText'),
  'template module renders HTML and plain-text bodies',
);

assert(
  orderEmailTemplate.includes('<!DOCTYPE html>') &&
    orderEmailTemplate.includes('808Tickets') &&
    orderEmailTemplate.includes('Open Tickets') &&
    orderEmailTemplate.includes('max-width:560px'),
  'HTML email is branded single-column with Open Tickets CTA',
);

assert(
  orderEmailTemplate.includes('808Tickets service fee') &&
    orderEmailTemplate.includes('Payment processing fee') &&
    orderEmailTemplate.includes('Ticket subtotal') &&
    orderEmailTemplate.includes('Total paid'),
  'HTML + text templates include transparent fee labels and totals',
);

assert(
  orderEmailTemplate.includes('Apple Wallet') &&
    orderEmailTemplate.includes('Open on your phone'),
  'email copy mentions phone tickets and Apple Wallet',
);

assert(
  orderEmailShared.includes("content_format: 'html+text'") &&
    orderEmailShared.includes('has_html_body: true') &&
    orderEmailShared.includes('has_text_body: true') &&
    orderEmailShared.includes('has_open_tickets_cta: true') &&
    orderEmailShared.includes('primary_cta_label') &&
    orderEmailShared.includes('site_origin: siteOrigin') &&
    !orderEmailShared.includes('success_url: successUrl'),
  'payload_snapshot records HTML mode without tokenized success URLs',
);

assert(
  orderEmailShared.includes('assertOrderConfirmationBodies') &&
    orderEmailShared.includes('refusing text-only / invalid Resend payload'),
  'send path refuses text-only Resend payloads',
);

assert(
  orderEmailShared.includes('sendEmailWithResend') &&
    orderEmailShared.includes('html: params.html') &&
    orderEmailShared.includes('text: params.text') &&
    orderEmailShared.includes('subject: params.subject') &&
    orderEmailShared.includes('from: params.from') &&
    orderEmailShared.includes('to: [params.to]'),
  'Resend API payload includes from, to, subject, html, and text',
);

assert(
  stripeWebhook.includes('sendOrderConfirmationEmail') &&
    sendOrderEmailFn.includes('sendOrderConfirmationEmail') &&
    orderEmailShared.includes("from './order-email-template.ts'"),
  'stripe-webhook and send-order-confirmation-email both send via shared HTML template builder',
);

assert(
  orderEmailShared.includes('buildPassLinkUrl') &&
    orderEmailShared.includes('buildPurchaseSuccessUrl') &&
    orderEmailShared.includes('resolvePublicSiteUrl') &&
    orderEmailShared.includes('site_origin'),
  'order-email builds links via PUBLIC_SITE_URL / resolvePublicSiteUrl',
);

assert(
  !orderEmailTemplate.includes('808tix.vercel.app') &&
    !orderEmailTemplate.includes('localhost:8081') &&
    !orderEmailTemplate.includes('127.0.0.1'),
  'email templates do not hardcode localhost or legacy Vercel host',
);

assert(
  orderEmailShared.includes('EMAIL_PREVIEW_ARTIFACT_DIR'),
  'preview mode can write HTML/text artifacts for local inspection',
);

const previewOrderEmailScript = join(ROOT, 'scripts/preview-order-email.ts');
assert(existsSync(previewOrderEmailScript), 'preview:order-email script exists');
const previewScript = readFileSync(previewOrderEmailScript, 'utf8');
assert(
  previewScript.includes('renderOrderConfirmationHtml') &&
    previewScript.includes('qa/artifacts/email-preview'),
  'preview script writes HTML artifact under qa/artifacts/email-preview',
);

assert(
  stripePaymentsDoc.includes('preview:order-email') ||
    stripePaymentsDoc.includes('branded HTML'),
  'STRIPE_PAYMENTS.md documents branded HTML email preview',
);

assert(
  stripePaymentsDoc.includes('supabase functions deploy stripe-webhook') &&
    stripePaymentsDoc.includes('supabase functions deploy send-order-confirmation-email'),
  'STRIPE_PAYMENTS.md documents redeploy of stripe-webhook + send-order-confirmation-email',
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
    stripePaymentsDoc.includes('send-order-confirmation-email') &&
    stripePaymentsDoc.includes('stripe-webhook'),
  'STRIPE_PAYMENTS.md documents email delivery including webhook integration',
);

assert(
  stripePaymentsDoc.includes('non-blocking') || stripePaymentsDoc.includes('non blocking'),
  'STRIPE_PAYMENTS.md documents non-blocking email behavior',
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
