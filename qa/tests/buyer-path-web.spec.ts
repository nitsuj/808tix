import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, type Page, test } from '@playwright/test';

const SCREENSHOT_DIR = join(process.cwd(), 'qa/artifacts/screenshots/latest');

const QA_EVENT_ID = process.env.QA_EVENT_ID?.trim() ?? '';
const QA_ORGANIZER_EMAIL = 'qa@808tix.test';
const QA_ORGANIZER_PASSWORD = 'qa';

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

async function clearBrowserStorage(page: Page): Promise<void> {
  await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.evaluate(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // ignore
    }
  });
}

async function signInAsQaOrganizer(page: Page): Promise<void> {
  await page.goto('/login', { waitUntil: 'networkidle', timeout: 60_000 });
  await expect(page.getByTestId('auth-email-input')).toBeVisible({ timeout: 45_000 });
  await page.getByTestId('auth-email-input').fill(QA_ORGANIZER_EMAIL);
  await page.getByTestId('auth-password-input').fill(QA_ORGANIZER_PASSWORD);
  await page.getByTestId('auth-submit-sign-in').click();
  await expect(page.getByTestId('auth-email-input')).toHaveCount(0, { timeout: 45_000 });
  await expect(page).not.toHaveURL(/\/login/, { timeout: 45_000 });
}

test.describe('buyer path web QA', () => {
  test.describe.configure({ timeout: 90_000 });

  test.beforeEach(async ({ page }) => {
    test.skip(!QA_EVENT_ID, 'QA_EVENT_ID is required (run npm run qa:seed)');
    await clearBrowserStorage(page);
  });

  test('public homepage shows upcoming events CTA', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle', timeout: 60_000 });

    await expect(page.getByTestId('public-upcoming-events')).toBeVisible({ timeout: 45_000 });
    await expect(page.getByText('Browse Events').first()).toBeVisible();
    await expect(page.getByTestId(`public-event-get-tickets-${QA_EVENT_ID}`)).toBeVisible({
      timeout: 45_000,
    });
    await expect(page.getByText('Get Tickets').first()).toBeVisible();
    await expect(page.getByText('Organizer Login').first()).toBeVisible();

    await saveScreenshot(page, '10-public-home-events.png');
  });

  test('public event buy page shows ticket type and price', async ({ page }) => {
    await page.goto(`/events/${encodeURIComponent(QA_EVENT_ID)}/buy`, {
      waitUntil: 'networkidle',
      timeout: 60_000,
    });

    await expect(page.getByTestId('buy-ticket-type-list')).toBeVisible({ timeout: 45_000 });
    await expect(page.getByText(/\$25\.00|25\.00|General Admission/i).first()).toBeVisible();
    await expect(page.getByText('Continue to payment')).toBeVisible();

    await saveScreenshot(page, '11-public-event-buy-ticket-price.png');
  });

  test('public event buy page shows quantity and checkout CTA', async ({ page }) => {
    await page.goto(`/events/${encodeURIComponent(QA_EVENT_ID)}/buy`, {
      waitUntil: 'networkidle',
      timeout: 60_000,
    });

    await expect(page.getByTestId('buy-quantity-stepper')).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId('buy-checkout-cta')).toBeVisible();
    await expect(page.getByText('Continue to payment')).toBeVisible();

    await saveScreenshot(page, '12-public-event-buy-quantity-checkout.png');
  });

  test('organizer ticket type price input is visible', async ({ page }) => {
    await signInAsQaOrganizer(page);

    await page.goto(`/events/${encodeURIComponent(QA_EVENT_ID)}`, {
      waitUntil: 'networkidle',
      timeout: 60_000,
    });

    await expect(page.getByTestId('ticket-type-price-input')).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId('ticket-type-name-input')).toBeVisible();
    await expect(page.getByTestId('ticket-type-capacity-input')).toBeVisible();
    await expect(page.getByText('Ticket types')).toBeVisible();

    await saveScreenshot(page, '13-organizer-ticket-type-price.png');
  });

  test('manual ticket share copy is honest', async ({ page }) => {
    await signInAsQaOrganizer(page);

    await page.goto(`/events/${encodeURIComponent(QA_EVENT_ID)}/issue`, {
      waitUntil: 'networkidle',
      timeout: 60_000,
    });

    await expect(
      page.getByText(/Share Ticket opens your device share sheet so you can text or email the ticket link/i),
    ).toBeVisible({ timeout: 45_000 });
    await expect(page.getByText(/Automatic ticket email is not available yet/i)).toHaveCount(0);

    await saveScreenshot(page, '14-manual-ticket-share-copy.png');
  });
});
