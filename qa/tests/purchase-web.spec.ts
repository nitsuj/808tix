import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, type Locator, type Page, test } from '@playwright/test';

const SCREENSHOT_DIR = join(process.cwd(), 'qa/artifacts/screenshots/latest');

const QA_EVENT_ID = process.env.QA_EVENT_ID?.trim() ?? '';
const QA_TICKET_TYPE_ID = process.env.QA_TICKET_TYPE_ID?.trim() ?? '';
const QA_PAID_ORDER_TOKEN = process.env.QA_PAID_ORDER_TOKEN?.trim() ?? '';
const QA_PASS_TOKEN = process.env.QA_PASS_TOKEN?.trim() ?? '';
const QA_PENDING_ORDER_TOKEN = process.env.QA_PENDING_ORDER_TOKEN?.trim() ?? '';

function ensureScreenshotDir(): void {
  if (!existsSync(SCREENSHOT_DIR)) {
    mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
}

async function saveScreenshot(page: Page, filename: string): Promise<void> {
  ensureScreenshotDir();
  await page.screenshot({
    path: join(SCREENSHOT_DIR, filename),
    fullPage: true,
  });
}

function qrLocator(page: Page): Locator {
  return page.locator('canvas, svg, img[src^="data:image"]');
}

async function expectQrVisible(page: Page): Promise<void> {
  await expect(qrLocator(page).first()).toBeVisible({ timeout: 30_000 });
}

test.describe('purchase web QA', () => {
  test('purchase buy page renders checkout UI', async ({ page }) => {
    const url = `/events/${encodeURIComponent(QA_EVENT_ID)}/buy?ticket_type_id=${encodeURIComponent(QA_TICKET_TYPE_ID)}`;
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });

    await expect(page.getByText('Continue to payment', { exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText('Tickets unavailable')).toHaveCount(0);

    await saveScreenshot(page, '01-purchase-buy.png');
  });

  test('purchase success page shows paid inline tickets', async ({ page }) => {
    const url = `/purchase/success?order_token=${encodeURIComponent(QA_PAID_ORDER_TOKEN)}`;
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });

    await expect(page.getByText('Payment confirmed')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Your tickets are ready')).toBeVisible();
    await expectQrVisible(page);
    await expect(page.getByRole('button', { name: 'Share' }).first()).toBeVisible();
    await expect(page.getByText('Copy link', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Open full ticket', { exact: true })).toHaveCount(0);

    await saveScreenshot(page, '02-purchase-success-paid.png');
  });

  test('pass ticket page renders QR', async ({ page }) => {
    const url = `/pass/${encodeURIComponent(QA_PASS_TOKEN)}`;
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });

    await expectQrVisible(page);
    const doorInstruction = page.getByText(/Show this QR code at the door|Present this ticket at entry/i);
    await expect(doorInstruction.first()).toBeVisible({ timeout: 30_000 });

    await saveScreenshot(page, '03-pass-ticket.png');
  });

  test('purchase cancel page shows canceled copy', async ({ page }) => {
    test.skip(
      !QA_PENDING_ORDER_TOKEN,
      'Set QA_PENDING_ORDER_TOKEN to capture the unpaid cancel page (checkout_open/pending order).',
    );

    const params = new URLSearchParams({
      order_token: QA_PENDING_ORDER_TOKEN,
      event_id: QA_EVENT_ID,
      ticket_type_id: QA_TICKET_TYPE_ID,
    });
    const url = `/purchase/cancel?${params.toString()}`;
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });

    await expect(page.getByText('Checkout canceled')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('No payment was made')).toBeVisible();

    await saveScreenshot(page, '04-purchase-cancel.png');
  });

  test('invalid pass shows unavailable state', async ({ page }) => {
    await page.goto('/pass/not-a-real-token', { waitUntil: 'networkidle', timeout: 60_000 });

    await expect(page.getByText('Ticket unavailable')).toBeVisible({ timeout: 30_000 });

    await saveScreenshot(page, '05-pass-invalid.png');
  });
});
