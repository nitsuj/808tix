#!/usr/bin/env npx tsx
/**
 * P0 buyer path wiring — discovery, buy page, ticket type pricing, share copy.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  centsToDollarsInput,
  dollarsInputToCents,
  formatTicketPriceLabel,
  validateTicketTypeForm,
} from '../src/lib/ticket-type-price';

const ROOT = process.cwd();

let failures = 0;

function fail(message: string) {
  console.error(`✗ ${message}`);
  failures += 1;
}

function pass(message: string) {
  console.log(`✓ ${message}`);
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    fail(message);
    return;
  }
  pass(message);
}

assert(dollarsInputToCents('25') === 2500, 'dollarsInputToCents converts 25 → 2500');
assert(dollarsInputToCents('25.00') === 2500, 'dollarsInputToCents converts 25.00 → 2500');
assert(dollarsInputToCents('25.5') === 2550, 'dollarsInputToCents converts 25.5 → 2550');
assert(dollarsInputToCents('abc') === null, 'dollarsInputToCents rejects invalid input');
assert(centsToDollarsInput(2500) === '25.00', 'centsToDollarsInput formats 2500 → 25.00');
assert(formatTicketPriceLabel(0) === 'Free', 'zero cents labeled Free');
assert(formatTicketPriceLabel(2500).includes('25'), 'paid price formats from cents');
assert(
  Object.keys(
    validateTicketTypeForm({
      name: '',
      priceDollars: 'x',
      capacity: '0',
      isActive: true,
    }),
  ).length >= 3,
  'ticket type form validation blocks empty/invalid fields',
);

const buy = readFileSync(join(ROOT, 'src/app/events/[eventId]/buy.tsx'), 'utf8');
const panel = readFileSync(
  join(ROOT, 'src/components/organizer/event-ticket-types-panel.tsx'),
  'utf8',
);
const issue = readFileSync(join(ROOT, 'src/app/events/[eventId]/issue.tsx'), 'utf8');
const buyerQa = readFileSync(join(ROOT, 'qa/tests/buyer-path-web.spec.ts'), 'utf8');
const checkout = readFileSync(join(ROOT, 'src/lib/create-checkout-session.ts'), 'utf8');

assert(buy.includes('preferredTicketTypeId'), 'buy page treats ticket_type_id as optional preference');
assert(buy.includes('buy-checkout-cta'), 'buy page exposes checkout CTA test id');
assert(buy.includes('buy-ticket-type-list'), 'buy page lists ticket types without requiring query id');
assert(buy.includes('startCheckoutSession'), 'buy page uses existing checkout helper');
assert(panel.includes('ticket-type-price-input'), 'organizer panel exposes price input');
assert(panel.includes('sales_enabled'), 'creating ticket types enables sales on event');
assert(
  issue.includes('Share Ticket opens your device share sheet') &&
    !issue.includes('Automatic ticket email is not available yet'),
  'manual issue copy uses honest Share Ticket message',
);
assert(buyerQa.includes('10-public-home-events.png'), 'buyer QA captures homepage screenshot');
assert(buyerQa.includes('11-public-event-buy-ticket-price.png'), 'buyer QA captures buy price screenshot');
assert(
  buyerQa.includes('12-public-event-buy-quantity-checkout.png'),
  'buyer QA captures quantity/checkout screenshot',
);
assert(
  buyerQa.includes('13-organizer-ticket-type-price.png'),
  'buyer QA captures organizer price screenshot',
);
assert(buyerQa.includes('14-manual-ticket-share-copy.png'), 'buyer QA captures share copy screenshot');
assert(checkout.includes('startCheckoutSession') || checkout.includes('createCheckoutSession'), 'checkout helper still present');

if (failures > 0) {
  console.error(`\ncheck-buyer-path: ${failures} failure(s)`);
  process.exit(1);
}

console.log('\ncheck-buyer-path: all checks passed');
