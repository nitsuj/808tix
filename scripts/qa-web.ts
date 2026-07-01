#!/usr/bin/env npx tsx
/**
 * Local web QA runner for buyer purchase and ticket UI (Playwright).
 *
 * Usage:
 *   npm run qa:web
 *   npm run qa:purchase -- --grep purchase
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const SCREENSHOT_DIR = join(ROOT, 'qa/artifacts/screenshots/latest');
const PLAYWRIGHT_RESULTS = join(ROOT, 'qa/artifacts/playwright-results.json');

const REQUIRED_ENV = [
  'QA_EVENT_ID',
  'QA_TICKET_TYPE_ID',
  'QA_PAID_ORDER_TOKEN',
  'QA_PASS_TOKEN',
] as const;

const SUMMARY_ROWS: Array<{
  testTitle: string;
  route: string;
  screenshot: string;
}> = [
  {
    testTitle: 'purchase buy page renders checkout UI',
    route: '/events/{QA_EVENT_ID}/buy?ticket_type_id={QA_TICKET_TYPE_ID}',
    screenshot: '01-purchase-buy.png',
  },
  {
    testTitle: 'purchase success page shows paid inline tickets',
    route: '/purchase/success?order_token={QA_PAID_ORDER_TOKEN}',
    screenshot: '02-purchase-success-paid.png',
  },
  {
    testTitle: 'pass ticket page renders QR',
    route: '/pass/{QA_PASS_TOKEN}',
    screenshot: '03-pass-ticket.png',
  },
  {
    testTitle: 'purchase cancel page shows canceled copy',
    route: '/purchase/cancel?order_token={QA_PENDING_ORDER_TOKEN}&event_id=...',
    screenshot: '04-purchase-cancel.png',
  },
  {
    testTitle: 'invalid pass shows unavailable state',
    route: '/pass/not-a-real-token',
    screenshot: '05-pass-invalid.png',
  },
];

function parseEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) {
    return {};
  }

  const values: Record<string, string> = {};

  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separator = trimmed.indexOf('=');
    if (separator === -1) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, '');
    values[key] = value;
  }

  return values;
}

function hydrateEnvFromDotEnv(): void {
  const dotEnv = parseEnvFile(join(ROOT, '.env'));

  for (const [key, value] of Object.entries(dotEnv)) {
    if (!process.env[key]?.trim() && value.trim()) {
      process.env[key] = value;
    }
  }
}

function failEnv(message: string): never {
  console.error(`\n808Tix web QA: missing configuration\n`);
  console.error(message);
  console.error(`
Obtain fixture values from a prior paid smoke run:

  npm run smoke:payments:local

After payment (or with an existing paid order):

  SMOKE_VERIFY_TOKEN=<order_public_access_token> npm run smoke:payments:local

The smoke script prints:
  - event_id
  - ticket_type_id
  - current_run_order_public_access_token  → QA_PAID_ORDER_TOKEN
  - paid ticket tokens                     → QA_PASS_TOKEN

For QA_PENDING_ORDER_TOKEN (optional cancel-page test), use a checkout_open order token
from create-checkout-session before payment, or query local DB:

  select public_access_token, status
  from public.orders
  where status in ('checkout_open', 'pending')
  order by created_at desc
  limit 5;

Required env vars:
  QA_EVENT_ID
  QA_TICKET_TYPE_ID
  QA_PAID_ORDER_TOKEN
  QA_PASS_TOKEN

Optional:
  QA_PENDING_ORDER_TOKEN
`);
  process.exit(1);
}

function validateRequiredEnv(): void {
  hydrateEnvFromDotEnv();

  const missing = REQUIRED_ENV.filter((key) => !process.env[key]?.trim());

  if (missing.length > 0) {
    failEnv(`Missing required env var(s): ${missing.join(', ')}`);
  }
}

async function verifyLocalSupabaseEnv(): Promise<void> {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();

  if (!supabaseUrl) {
    console.warn(
      'WARN: EXPO_PUBLIC_SUPABASE_URL is not set. Ensure .env points Expo web at local Supabase.',
    );
    return;
  }

  let parsed: URL;

  try {
    parsed = new URL(supabaseUrl);
  } catch {
    console.warn(`WARN: EXPO_PUBLIC_SUPABASE_URL is not a valid URL: ${supabaseUrl}`);
    return;
  }

  const host = parsed.hostname;
  const isLocal = host === '127.0.0.1' || host === 'localhost';

  if (!isLocal) {
    console.warn(
      `WARN: EXPO_PUBLIC_SUPABASE_URL host is ${host} (expected local 127.0.0.1 or localhost).`,
    );
    return;
  }

  try {
    const response = await fetch(`${supabaseUrl.replace(/\/+$/, '')}/rest/v1/`, {
      method: 'HEAD',
      headers: {
        apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '',
      },
    });

    if (!response.ok && response.status !== 401) {
      console.warn(`WARN: Local Supabase REST probe returned HTTP ${response.status}.`);
      return;
    }

    console.log(`Local Supabase probe OK (${supabaseUrl})`);
  } catch (error) {
    console.warn(`WARN: Could not reach local Supabase at ${supabaseUrl}: ${String(error)}`);
    console.warn('Start local Supabase with: supabase start');
  }
}

function prepareScreenshotDir(): void {
  mkdirSync(join(ROOT, 'qa/artifacts'), { recursive: true });

  if (existsSync(SCREENSHOT_DIR)) {
    for (const entry of readdirSync(SCREENSHOT_DIR)) {
      rmSync(join(SCREENSHOT_DIR, entry), { force: true, recursive: true });
    }
  } else {
    mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  console.log(`Screenshot output: ${SCREENSHOT_DIR}`);
}

type PlaywrightJsonReport = {
  suites?: PlaywrightJsonSuite[];
};

type PlaywrightJsonSuite = {
  title: string;
  specs?: Array<{
    title: string;
    tests?: Array<{
      results?: Array<{
        status?: string;
      }>;
    }>;
  }>;
  suites?: PlaywrightJsonSuite[];
};

function collectSpecStatuses(
  suites: PlaywrightJsonSuite[] | undefined,
  statusByTitle: Map<string, 'passed' | 'failed' | 'skipped' | 'unknown'>,
): void {
  for (const suite of suites ?? []) {
    for (const spec of suite.specs ?? []) {
      const result = spec.tests?.[0]?.results?.[0];
      const status = result?.status;

      if (status === 'passed' || status === 'failed' || status === 'skipped') {
        statusByTitle.set(spec.title, status);
      } else {
        statusByTitle.set(spec.title, 'unknown');
      }
    }

    collectSpecStatuses(suite.suites, statusByTitle);
  }
}

function readPlaywrightResults(): Map<string, 'passed' | 'failed' | 'skipped' | 'unknown'> {
  const statusByTitle = new Map<string, 'passed' | 'failed' | 'skipped' | 'unknown'>();

  if (!existsSync(PLAYWRIGHT_RESULTS)) {
    return statusByTitle;
  }

  try {
    const report = JSON.parse(readFileSync(PLAYWRIGHT_RESULTS, 'utf8')) as PlaywrightJsonReport;
    collectSpecStatuses(report.suites, statusByTitle);
  } catch (error) {
    console.warn(`WARN: Could not parse Playwright JSON report: ${String(error)}`);
  }

  return statusByTitle;
}

function printSummary(exitCode: number): void {
  const statuses = readPlaywrightResults();

  console.log('\n' + '='.repeat(88));
  console.log('808Tix web QA summary');
  console.log('='.repeat(88));
  console.log(
    `${'Test'.padEnd(46)} ${'Screenshot'.padEnd(28)} ${'Result'.padEnd(8)} Route`,
  );
  console.log('-'.repeat(88));

  for (const row of SUMMARY_ROWS) {
    const status = statuses.get(row.testTitle) ?? (exitCode === 0 ? 'passed' : 'unknown');
    const screenshotPath = join(SCREENSHOT_DIR, row.screenshot);
    const screenshotExists = existsSync(screenshotPath);
    const screenshotLabel = screenshotExists ? row.screenshot : `${row.screenshot} (missing)`;

    let displayStatus = status.toUpperCase();

    if (row.testTitle.includes('cancel') && !process.env.QA_PENDING_ORDER_TOKEN?.trim()) {
      displayStatus = 'SKIPPED';
    }

    console.log(
      `${row.testTitle.padEnd(46)} ${screenshotLabel.padEnd(28)} ${displayStatus.padEnd(8)} ${row.route}`,
    );
  }

  console.log('='.repeat(88));
  console.log(`Screenshots saved under: ${SCREENSHOT_DIR}`);
}

function runPlaywright(forwardedArgs: string[]): Promise<number> {
  const playwrightArgs = ['playwright', 'test', ...forwardedArgs];

  return new Promise((resolve, reject) => {
    const child = spawn('npx', playwrightArgs, {
      cwd: ROOT,
      env: process.env,
      stdio: 'inherit',
    });

    child.on('error', reject);
    child.on('close', (code, signal) => {
      if (signal) {
        resolve(1);
        return;
      }

      resolve(code ?? 1);
    });
  });
}

async function main(): Promise<void> {
  validateRequiredEnv();
  await verifyLocalSupabaseEnv();
  prepareScreenshotDir();

  const forwardedArgs = process.argv.slice(2);
  console.log('\n808Tix web QA — running Playwright tests\n');

  const exitCode = await runPlaywright(forwardedArgs);
  printSummary(exitCode);

  if (exitCode !== 0) {
    console.error(`\nFAIL: Playwright exited with code ${exitCode}`);
    console.error(
      'If the browser binary is missing, run once: npx playwright install chromium',
    );
    process.exit(exitCode);
  }

  console.log('\nPASS: web QA completed.');
}

main().catch((error) => {
  console.error('\nFAIL: qa-web runner error:', error);
  process.exit(1);
});
