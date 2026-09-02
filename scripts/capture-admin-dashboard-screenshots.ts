#!/usr/bin/env npx tsx
/**
 * Captures admin dashboard screenshots for QA artifacts.
 *
 * Always (no login):
 *   /design/admin-dashboard-review → review desktop/mobile
 *
 * Local authenticated /admin (preferred for design iteration):
 *   Uses seeded platform-admin@808tix.test via /admin?qaAdmin=1 when BASE_URL is localhost
 *   and EXPO_PUBLIC_SUPABASE_URL is local.
 *
 * Optional hosted/override credentials:
 *   SCREENSHOT_EMAIL=... SCREENSHOT_PASSWORD=...
 *
 * Usage (with local web server running):
 *   npx tsx scripts/capture-admin-dashboard-screenshots.ts
 */
import { existsSync, readFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = process.cwd();
const OUT_DIR = join(ROOT, 'qa/artifacts/screenshots/latest');
const BASE_URL = process.env.SCREENSHOT_BASE_URL ?? 'http://localhost:8081';

const LOCAL_QA_EMAIL = 'platform-admin@808tix.test';
const LOCAL_QA_PASSWORD = 'qa-admin-password';

function parseEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const values: Record<string, string> = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, '');
    values[key] = value;
  }
  return values;
}

function isLocalHostUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

function isLocalSupabaseUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === '127.0.0.1' ||
      parsed.hostname === 'localhost' ||
      parsed.hostname.endsWith('.local')
    );
  } catch {
    return false;
  }
}

async function assertWebServer(): Promise<void> {
  try {
    const response = await fetch(BASE_URL, { method: 'GET', signal: AbortSignal.timeout(3000) });
    if (!response.ok && response.status !== 404) {
      throw new Error(`Unexpected status ${response.status}`);
    }
  } catch {
    console.error(`\nFAIL: web server not reachable at ${BASE_URL}`);
    console.error('Start Expo web first:\n  npm run web\n');
    process.exit(1);
  }
}

async function main() {
  await assertWebServer();

  const { chromium } = await import('playwright');
  await mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const desktopContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 } });

  async function capturePath(
    context: Awaited<typeof desktopContext>,
    urlPath: string,
    filePath: string,
    waitMs = 3000,
  ): Promise<void> {
    const page = await context.newPage();
    await page.goto(`${BASE_URL}${urlPath}`, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(waitMs);
    await page.screenshot({ path: filePath, fullPage: true });
    await page.close();
    console.log(`✓ ${filePath}`);
  }

  console.log('Capturing design-review mock dashboard (no login required)…');
  await capturePath(
    desktopContext,
    '/design/admin-dashboard-review',
    join(OUT_DIR, 'admin-dashboard-review-desktop.png'),
    3500,
  );
  await capturePath(
    mobileContext,
    '/design/admin-dashboard-review',
    join(OUT_DIR, 'admin-dashboard-review-mobile.png'),
    3500,
  );

  console.log('Capturing design-review event detail (no login required)…');
  await capturePath(
    desktopContext,
    '/design/admin-event-detail-review',
    join(OUT_DIR, 'admin-event-detail-review-desktop.png'),
    3500,
  );
  await capturePath(
    mobileContext,
    '/design/admin-event-detail-review',
    join(OUT_DIR, 'admin-event-detail-review-mobile.png'),
    3500,
  );

  const dotenv = parseEnvFile(join(ROOT, '.env'));
  const supabaseUrl =
    process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() || dotenv.EXPO_PUBLIC_SUPABASE_URL?.trim() || '';
  const canLocalQa =
    isLocalHostUrl(BASE_URL) && Boolean(supabaseUrl) && isLocalSupabaseUrl(supabaseUrl);

  const overrideEmail = process.env.SCREENSHOT_EMAIL?.trim();
  const overridePassword = process.env.SCREENSHOT_PASSWORD?.trim();

  if (canLocalQa) {
    console.log('Capturing authenticated local /admin via seeded platform admin…');
    const loginPage = await desktopContext.newPage();
    await loginPage.goto(`${BASE_URL}/admin?qaAdmin=1`, {
      waitUntil: 'networkidle',
      timeout: 45000,
    });
    // Prefer button click if visible; otherwise wait for auto-login via query param.
    const continueBtn = loginPage.getByText('Continue as local platform admin', { exact: true });
    if (await continueBtn.count()) {
      await continueBtn.click();
    }
    await loginPage.waitForTimeout(6000);
    // If still on gate, try explicit password sign-in as fallback.
    const stillGate = await loginPage.getByText('Sign in required', { exact: false }).count();
    if (stillGate) {
      await loginPage.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 45000 });
      await loginPage.fill('input[autocomplete="email"], input[type="email"]', LOCAL_QA_EMAIL);
      await loginPage.fill(
        'input[autocomplete="password"], input[type="password"]',
        LOCAL_QA_PASSWORD,
      );
      await loginPage.getByText('Sign in', { exact: true }).click();
      await loginPage.waitForTimeout(5000);
      await loginPage.goto(`${BASE_URL}/admin`, { waitUntil: 'networkidle', timeout: 45000 });
      await loginPage.waitForTimeout(4000);
    }
    // Propagate auth storage to both contexts by reusing storage state.
    const storage = await desktopContext.storageState();
    await loginPage.close();

    const authDesktop = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      storageState: storage,
    });
    const authMobile = await browser.newContext({
      viewport: { width: 390, height: 844 },
      storageState: storage,
    });

    await capturePath(
      authDesktop,
      '/admin',
      join(OUT_DIR, 'admin-dashboard-authenticated-desktop.png'),
      5000,
    );
    await capturePath(
      authMobile,
      '/admin',
      join(OUT_DIR, 'admin-dashboard-authenticated-mobile.png'),
      5000,
    );
    // Keep prior artifact names pointing at authenticated shots when local QA works.
    await capturePath(
      authDesktop,
      '/admin',
      join(OUT_DIR, 'admin-dashboard-refreshed.png'),
      2000,
    );
    await capturePath(
      authMobile,
      '/admin',
      join(OUT_DIR, 'admin-dashboard-refreshed-mobile.png'),
      2000,
    );
    await authDesktop.close();
    await authMobile.close();
  } else if (overrideEmail && overridePassword) {
    console.log('Capturing authenticated /admin with SCREENSHOT_EMAIL/PASSWORD…');
    const loginPage = await desktopContext.newPage();
    await loginPage.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 45000 });
    await loginPage.fill('input[autocomplete="email"], input[type="email"]', overrideEmail);
    await loginPage.fill('input[autocomplete="password"], input[type="password"]', overridePassword);
    await loginPage.getByText('Sign in', { exact: true }).click();
    await loginPage.waitForTimeout(5000);
    const storage = await desktopContext.storageState();
    await loginPage.close();

    const authDesktop = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      storageState: storage,
    });
    const authMobile = await browser.newContext({
      viewport: { width: 390, height: 844 },
      storageState: storage,
    });
    await capturePath(
      authDesktop,
      '/admin',
      join(OUT_DIR, 'admin-dashboard-authenticated-desktop.png'),
      5000,
    );
    await capturePath(
      authMobile,
      '/admin',
      join(OUT_DIR, 'admin-dashboard-authenticated-mobile.png'),
      5000,
    );
    await capturePath(authDesktop, '/admin', join(OUT_DIR, 'admin-dashboard-refreshed.png'), 2000);
    await capturePath(
      authMobile,
      '/admin',
      join(OUT_DIR, 'admin-dashboard-refreshed-mobile.png'),
      2000,
    );
    await authDesktop.close();
    await authMobile.close();
  } else {
    console.log(
      'Skipping authenticated /admin capture (need localhost + local Supabase, or SCREENSHOT_EMAIL/PASSWORD).',
    );
    console.log('Capturing /admin login-gate state…');
    await capturePath(
      desktopContext,
      '/admin',
      join(OUT_DIR, 'admin-dashboard-refreshed.png'),
      2500,
    );
    await capturePath(
      mobileContext,
      '/admin',
      join(OUT_DIR, 'admin-dashboard-refreshed-mobile.png'),
      2500,
    );
  }

  await browser.close();
  console.log(`Screenshots saved to ${OUT_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
