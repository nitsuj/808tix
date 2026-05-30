/**
 * Captures mobile-width screenshots of 808Tix web UI.
 * Usage: npx expo start --web (separate terminal), then:
 *   node scripts/capture-ui-screenshots.mjs
 *
 * Optional env for authenticated screens:
 *   SCREENSHOT_EMAIL=... SCREENSHOT_PASSWORD=... node scripts/capture-ui-screenshots.mjs
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', 'docs', 'screenshots');
const BASE_URL = process.env.SCREENSHOT_BASE_URL ?? 'http://localhost:8081';
const VIEWPORT = { width: 390, height: 844 };

async function main() {
  const { chromium } = await import('playwright');
  await mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();

  async function shot(name, url, waitMs = 2500) {
    try {
      await page.goto(`${BASE_URL}${url}`, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(waitMs);
      await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`), fullPage: true });
      console.log(`✓ ${name}.png`);
    } catch (error) {
      console.warn(`✗ ${name}: ${error.message}`);
    }
  }

  await shot('01-login', '/');
  await shot('06-guest-pass-error', '/pass/not-a-real-token', 1500);

  const email = process.env.SCREENSHOT_EMAIL;
  const password = process.env.SCREENSHOT_PASSWORD;

  if (email && password) {
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
    await page.fill('input[autocomplete="email"], input[type="email"]', email);
    await page.fill('input[autocomplete="password"], input[type="password"]', password);
    await page.getByText('Sign in', { exact: true }).click();
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(OUT_DIR, '02-dashboard.png'), fullPage: true });
    console.log('✓ 02-dashboard.png');

    const eventLink = page.locator('a[href*="/events/"]').first();
    if (await eventLink.count()) {
      await eventLink.click();
      await page.waitForTimeout(2500);
      await page.screenshot({ path: path.join(OUT_DIR, '03-event-detail.png'), fullPage: true });
      console.log('✓ 03-event-detail.png');
    }

    await shot('04-create-event', '/events/create');
  } else {
    console.log('Set SCREENSHOT_EMAIL + SCREENSHOT_PASSWORD to capture organizer screens.');
  }

  await browser.close();
  console.log(`Screenshots saved to ${OUT_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
