#!/usr/bin/env npx tsx
/**
 * Buyer purchase UI guards (routes + thin client helpers only).
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import {
  findPurchaseTicketType,
  parsePublicEventPurchaseOptions,
  purchaseIdsEqual,
} from '../src/lib/get-public-purchase-options.core';

const ROOT = process.cwd();
const SRC_DIR = join(ROOT, 'src');

const BUY_ROUTE = join(SRC_DIR, 'app/events/[eventId]/buy.tsx');
const PURCHASE_OPTIONS_HELPER = join(SRC_DIR, 'lib/get-public-purchase-options.ts');
const PURCHASE_OPTIONS_CORE = join(SRC_DIR, 'lib/get-public-purchase-options.core.ts');
const SUCCESS_ROUTE = join(SRC_DIR, 'app/purchase/success.tsx');
const CANCEL_ROUTE = join(SRC_DIR, 'app/purchase/cancel.tsx');
const CREATE_CHECKOUT_HELPER = join(SRC_DIR, 'lib/create-checkout-session.ts');
const GET_ORDER_HELPER = join(SRC_DIR, 'lib/get-order-by-public-token.ts');
const PURCHASE_URLS = join(SRC_DIR, 'lib/purchase-urls.ts');
const APP_BASE_URL = join(SRC_DIR, 'lib/app-base-url.ts');
const ORDER_HOOK = join(SRC_DIR, 'hooks/use-order-confirmation.ts');

const purchaseRouteFiles = [BUY_ROUTE, SUCCESS_ROUTE, CANCEL_ROUTE];
const purchaseLibFiles = [
  CREATE_CHECKOUT_HELPER,
  GET_ORDER_HELPER,
  PURCHASE_OPTIONS_HELPER,
  PURCHASE_OPTIONS_CORE,
  PURCHASE_URLS,
  APP_BASE_URL,
  ORDER_HOOK,
];

let failures = 0;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`✗ ${message}`);
    failures += 1;
    return;
  }
  console.log(`✓ ${message}`);
}

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

function listPurchaseSourceFiles(): string[] {
  const componentDir = join(SRC_DIR, 'components/purchase');
  const componentFiles = existsSync(componentDir)
    ? readdirSync(componentDir)
        .filter((name) => name.endsWith('.tsx') || name.endsWith('.ts'))
        .map((name) => join(componentDir, name))
    : [];

  return [...purchaseRouteFiles, ...purchaseLibFiles, ...componentFiles].filter((path) =>
    existsSync(path),
  );
}

for (const path of purchaseRouteFiles) {
  assert(existsSync(path), `purchase route exists: ${path.replace(`${ROOT}/`, '')}`);
}

const buyRoute = read(BUY_ROUTE);
const purchaseOptionsHelper = read(PURCHASE_OPTIONS_HELPER);
const purchaseOptionsCore = read(PURCHASE_OPTIONS_CORE);
const successRoute = read(SUCCESS_ROUTE);
const cancelRoute = read(CANCEL_ROUTE);
const createCheckoutHelper = read(CREATE_CHECKOUT_HELPER);
const getOrderHelper = read(GET_ORDER_HELPER);
const purchaseUrls = read(PURCHASE_URLS);

assert(
  buyRoute.includes("from '@/lib/get-public-purchase-options'") &&
    buyRoute.includes('fetchPublicEventPurchaseOptions'),
  'purchase page loads options through get-public-purchase-options helper',
);
assert(
  purchaseOptionsCore.includes('parsePublicEventPurchaseOptions') &&
    purchaseOptionsHelper.includes("supabase.rpc('get_public_event_purchase_options'"),
  'purchase options helper calls RPC directly and parses jsonb payload',
);
assert(
  !purchaseOptionsCore.includes('data.result') &&
    !purchaseOptionsHelper.includes('data.result') &&
    !buyRoute.includes('data.result'),
  'purchase flow does not expect RPC data.result wrapper',
);
assert(
  buyRoute.includes('normalizeRouteParam') && purchaseOptionsCore.includes('normalizeRouteParam'),
  'purchase flow normalizes array route/search params',
);
assert(
  purchaseOptionsCore.includes('purchaseIdsEqual') &&
    purchaseOptionsCore.includes('findPurchaseTicketType'),
  'purchase flow matches ticket type by exact id',
);
assert(
  buyRoute.includes('unavailableCopy') &&
    buyRoute.includes('ticket_type_not_found') &&
    buyRoute.includes('sold_out'),
  'purchase page has distinct unavailable reasons',
);
assert(
  buyRoute.includes('logPurchaseOptionsDiagnostics'),
  'purchase page includes dev diagnostics helper',
);
assert(
  buyRoute.includes("from '@/lib/create-checkout-session'") &&
    buyRoute.includes('startCheckoutSession('),
  'purchase page calls create-checkout-session helper',
);
assert(
  successRoute.includes("from '@/lib/get-order-by-public-token'") ||
    successRoute.includes('useOrderConfirmation'),
  'success page uses order confirmation flow',
);
assert(
  successRoute.includes("order?.status === 'paid'"),
  'success page guards ticket rendering behind status === paid',
);
assert(
  cancelRoute.includes('getOrderByPublicToken'),
  'cancel page calls get_order_by_public_token helper',
);
assert(
  !buyRoute.includes('useOrganizerAuthGate') && !buyRoute.includes('useOrganizerAuthRedirect'),
  'purchase route does not import organizer auth hooks',
);
assert(
  createCheckoutHelper.includes('/functions/v1/create-checkout-session'),
  'create-checkout-session helper posts to Edge Function',
);
assert(
  !createCheckoutHelper.includes('STRIPE_SECRET') &&
    !createCheckoutHelper.includes('sk_test') &&
    !createCheckoutHelper.includes('sk_live') &&
    !createCheckoutHelper.includes('whsec'),
  'create-checkout-session helper has no Stripe secrets',
);
assert(
  getOrderHelper.includes("supabase.rpc('get_order_by_public_token'"),
  'get-order-by-public-token helper wraps RPC',
);
assert(
  purchaseUrls.includes('buildPurchaseSuccessUrl') &&
    purchaseUrls.includes('buildPurchaseCancelUrl') &&
    purchaseUrls.includes('buildEventBuyUrl'),
  'purchase URL helpers exist',
);
assert(
  read(join(SRC_DIR, 'components/purchase/purchase-ticket-link-list.tsx')).includes('getPassRoute'),
  'ticket links use existing pass route helper',
);

const samplePayload = {
  event: {
    id: '406bc791-b643-4abf-88d4-56dd4ea7cc06',
    name: 'PO Test Event',
    venue_name: null,
    event_date: null,
    start_time: null,
    description: null,
    image_url: null,
    currency: 'usd',
    capacity: 20,
    ticketing_mode: 'paid',
    sales_enabled: true,
    platform_fee_bps: 300,
    platform_fee_fixed_cents: 50,
  },
  ticket_types: [
    {
      id: 'c6604a50-d43e-448a-ae8f-a5ffa7549bee',
      name: 'GA',
      description: null,
      price_cents: 2500,
      currency: 'usd',
      capacity: 10,
      quantity_available: 10,
      sales_start_at: null,
      sales_end_at: null,
      sort_order: 0,
    },
  ],
};

const parsed = parsePublicEventPurchaseOptions(samplePayload);
assert(parsed !== null && parsed.event.name === 'PO Test Event', 'parser accepts direct RPC object');
assert(
  findPurchaseTicketType(parsed!, 'c6604a50-d43e-448a-ae8f-a5ffa7549bee')?.name === 'GA',
  'parser finds ticket type by exact id',
);
assert(
  purchaseIdsEqual(
    'C6604A50-D43E-448A-AE8F-A5FFA7549BEE',
    'c6604a50-d43e-448a-ae8f-a5ffa7549bee',
  ),
  'purchase id comparison is case-insensitive',
);
assert(
  parsePublicEventPurchaseOptions({ result: samplePayload }) !== null,
  'parser unwraps accidental result wrapper without treating valid payload as unavailable',
);

const forbiddenHardcodedHosts = ['127.0.0.1', 'localhost:8081', '808tix.vercel.app'];

for (const filePath of listPurchaseSourceFiles()) {
  const source = read(filePath);
  const relative = filePath.replace(`${ROOT}/`, '');

  if (relative === 'src/lib/app-base-url.ts') {
    continue;
  }

  for (const host of forbiddenHardcodedHosts) {
    assert(!source.includes(host), `${relative} does not hardcode ${host}`);
  }
}

function walkSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...walkSourceFiles(fullPath));
      continue;
    }

    if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

const purchaseAndAppSources = [
  ...listPurchaseSourceFiles(),
  ...walkSourceFiles(join(SRC_DIR, 'app/purchase')),
  BUY_ROUTE,
].filter((path, index, all) => all.indexOf(path) === index);

for (const filePath of purchaseAndAppSources) {
  const source = read(filePath);
  const relative = filePath.replace(`${ROOT}/`, '');

  assert(
    !source.includes('fulfill_paid_order'),
    `${relative} does not reference fulfill_paid_order`,
  );
  assert(!source.includes(".from('passes').insert"), `${relative} does not insert passes`);
}

const allSrcFiles = walkSourceFiles(SRC_DIR);

for (const filePath of allSrcFiles) {
  const source = read(filePath);
  const relative = filePath.replace(`${ROOT}/`, '');

  assert(!source.includes('STRIPE_SECRET'), `${relative} has no STRIPE_SECRET string`);
  assert(!source.includes('sk_test'), `${relative} has no sk_test string`);
  assert(!source.includes('sk_live'), `${relative} has no sk_live string`);
  assert(!source.includes('whsec'), `${relative} has no whsec string`);
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}

console.log('\nAll purchase UI checks passed.');
