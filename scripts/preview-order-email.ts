#!/usr/bin/env npx tsx
/**
 * Local preview of branded order-confirmation email (HTML + plain text).
 * Does not call Resend or Supabase — renders fixture content to qa/artifacts.
 *
 * Usage:
 *   npm run preview:order-email
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  OPEN_TICKETS_CTA_LABEL,
  PROCESSING_FEE_LABEL,
  SERVICE_FEE_LABEL,
  renderOrderConfirmationHtml,
  renderOrderConfirmationText,
} from '../supabase/functions/_shared/order-email-template.ts';

const ROOT = process.cwd();
const ARTIFACT_DIR = join(ROOT, 'qa/artifacts/email-preview');
const SITE_ORIGIN = process.env.PUBLIC_SITE_URL?.trim() || 'https://808tickets.com';

const fixture = {
  buyerName: 'Alex',
  eventName: 'Friday Night Live',
  dateLine: 'FRI, AUG 28, 2026, 8:00 PM',
  venueLine: 'The Cask & Barrel · Honolulu, HI',
  ticketTotal: 2,
  tickets: [
    {
      ticketNumber: 1,
      ticketTotal: 2,
      passType: 'General Admission',
      passUrl: `${SITE_ORIGIN}/pass/preview-token-one`,
    },
    {
      ticketNumber: 2,
      ticketTotal: 2,
      passType: 'General Admission',
      passUrl: `${SITE_ORIGIN}/pass/preview-token-two`,
    },
  ],
  successUrl: `${SITE_ORIGIN}/purchase/success?order_token=preview-order-token`,
  fees: {
    currency: 'usd',
    subtotal_cents: 5000,
    platform_fee_cents: 323,
    processing_fee_cents: 190,
    total_cents: 5513,
  },
};

function assertContains(haystack: string, needle: string, label: string): void {
  if (!haystack.includes(needle)) {
    throw new Error(`Preview ${label} missing required content: ${needle}`);
  }
}

function main(): void {
  mkdirSync(ARTIFACT_DIR, { recursive: true });

  const html = renderOrderConfirmationHtml(fixture);
  const text = renderOrderConfirmationText(fixture);

  assertContains(html, '<!DOCTYPE html>', 'html');
  assertContains(html, '808Tickets', 'html');
  assertContains(html, OPEN_TICKETS_CTA_LABEL, 'html');
  assertContains(html, SERVICE_FEE_LABEL, 'html');
  assertContains(html, PROCESSING_FEE_LABEL, 'html');
  assertContains(html, SITE_ORIGIN, 'html');
  assertContains(html, 'Apple Wallet', 'html');
  assertContains(text, OPEN_TICKETS_CTA_LABEL, 'text');
  assertContains(text, SERVICE_FEE_LABEL, 'text');
  assertContains(text, PROCESSING_FEE_LABEL, 'text');
  assertContains(text, SITE_ORIGIN, 'text');

  if (SITE_ORIGIN.includes('808tickets.com')) {
    if (html.includes('localhost') || html.includes('808tix.vercel.app')) {
      throw new Error('Hosted-origin preview HTML must not include localhost or legacy Vercel host');
    }
    if (text.includes('localhost') || text.includes('808tix.vercel.app')) {
      throw new Error('Hosted-origin preview text must not include localhost or legacy Vercel host');
    }
  }

  const htmlPath = join(ARTIFACT_DIR, 'latest.html');
  const textPath = join(ARTIFACT_DIR, 'latest.txt');
  writeFileSync(htmlPath, html, 'utf8');
  writeFileSync(textPath, text, 'utf8');

  console.log('Order confirmation email preview written:');
  console.log(`  HTML: ${htmlPath} (${html.length} bytes)`);
  console.log(`  Text: ${textPath} (${text.length} bytes)`);
  console.log(`  Origin: ${SITE_ORIGIN}`);
  console.log(`  CTA: ${OPEN_TICKETS_CTA_LABEL}`);
  console.log(`  Fees: ${SERVICE_FEE_LABEL} + ${PROCESSING_FEE_LABEL}`);
  console.log('Open latest.html in a browser to inspect.');
}

main();
