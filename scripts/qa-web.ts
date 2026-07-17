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

import { chromium } from '@playwright/test';

const ROOT = process.cwd();
const SCREENSHOT_DIR = join(ROOT, 'qa/artifacts/screenshots/latest');
const PLAYWRIGHT_RESULTS = join(ROOT, 'qa/artifacts/playwright-results.json');
const FIXTURES_PATH = join(ROOT, 'qa/fixtures.json');

const REQUIRED_ENV = [
  'QA_EVENT_ID',
  'QA_TICKET_TYPE_ID',
  'QA_PAID_ORDER_TOKEN',
  'QA_PASS_TOKEN',
] as const;

type QaFixturesFile = {
  event_id: string;
  ticket_type_id: string;
  pending_order_token?: string;
  paid_order_token: string;
  pass_tokens: string[];
  created_at?: string;
};

type FixtureSource = 'file' | 'env';

let fixtureSource: FixtureSource = 'file';

const LOCAL_SUPABASE_FIX_COMMANDS = `unset EXPO_PUBLIC_SUPABASE_URL
unset EXPO_PUBLIC_SUPABASE_ANON_KEY

export EXPO_PUBLIC_SUPABASE_URL="$(supabase status -o env | sed -n 's/^API_URL=//p' | tr -d '"')"
export EXPO_PUBLIC_SUPABASE_ANON_KEY="$(supabase status -o env | sed -n 's/^ANON_KEY=//p' | tr -d '"')"

npm run qa:seed
npm run qa:web`;

const SUMMARY_ROWS: Array<{
  testTitle: string;
  route: string;
  screenshot: string;
  requiredScreenshot?: boolean;
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
  {
    testTitle: 'auth default page shows Forgot password',
    route: '/',
    screenshot: '06-auth-default.png',
    requiredScreenshot: true,
  },
  {
    testTitle: 'forgot password shows reset request UI',
    route: '/ (Forgot password?)',
    screenshot: '07-auth-forgot-password.png',
    requiredScreenshot: true,
  },
  {
    testTitle: 'submitting reset request shows reset-sent message',
    route: '/ (reset sent)',
    screenshot: '08-auth-reset-sent.png',
    requiredScreenshot: true,
  },
  {
    testTitle: 'signup confirmation shows check-email UI',
    route: '/ (check email)',
    screenshot: '09-auth-check-email.png',
    requiredScreenshot: true,
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
Seed local fixtures, then run web QA:

  npm run qa:seed
  npm run qa:web

Or export env vars manually (env overrides qa/fixtures.json):

  QA_EVENT_ID
  QA_TICKET_TYPE_ID
  QA_PAID_ORDER_TOKEN
  QA_PASS_TOKEN
  QA_PENDING_ORDER_TOKEN   (optional — cancel-page test)

Fixture values are also printed by:

  npm run smoke:payments:local
  SMOKE_VERIFY_TOKEN=<token> npm run smoke:payments:local
`);
  process.exit(1);
}

function hasExplicitQaEnv(): boolean {
  return REQUIRED_ENV.every((key) => Boolean(process.env[key]?.trim()));
}

function loadFixturesFile(): QaFixturesFile | null {
  if (!existsSync(FIXTURES_PATH)) {
    return null;
  }

  try {
    const parsed = JSON.parse(readFileSync(FIXTURES_PATH, 'utf8')) as QaFixturesFile;

    if (
      !parsed.event_id?.trim() ||
      !parsed.ticket_type_id?.trim() ||
      !parsed.paid_order_token?.trim() ||
      !Array.isArray(parsed.pass_tokens) ||
      parsed.pass_tokens.length === 0 ||
      !parsed.pass_tokens[0]?.trim()
    ) {
      throw new Error('qa/fixtures.json is missing required fields');
    }

    return parsed;
  } catch (error) {
    failEnv(`Could not read qa/fixtures.json: ${String(error)}`);
  }
}

function applyFixtureEnv(fixtures: QaFixturesFile, source: FixtureSource): void {
  fixtureSource = source;

  process.env.QA_EVENT_ID = process.env.QA_EVENT_ID?.trim() || fixtures.event_id;
  process.env.QA_TICKET_TYPE_ID = process.env.QA_TICKET_TYPE_ID?.trim() || fixtures.ticket_type_id;
  process.env.QA_PAID_ORDER_TOKEN =
    process.env.QA_PAID_ORDER_TOKEN?.trim() || fixtures.paid_order_token;
  process.env.QA_PASS_TOKEN = process.env.QA_PASS_TOKEN?.trim() || fixtures.pass_tokens[0];

  if (!process.env.QA_PENDING_ORDER_TOKEN?.trim() && fixtures.pending_order_token?.trim()) {
    process.env.QA_PENDING_ORDER_TOKEN = fixtures.pending_order_token;
  }

  console.log(`Fixture source: ${source}`);
  console.log(`event_id: ${process.env.QA_EVENT_ID}`);
  console.log(`ticket_type_id: ${process.env.QA_TICKET_TYPE_ID}`);
  console.log(`paid_order_token: ${process.env.QA_PAID_ORDER_TOKEN?.slice(0, 12)}...`);
  console.log(`pass_token: ${process.env.QA_PASS_TOKEN?.slice(0, 12)}...`);

  if (process.env.QA_PENDING_ORDER_TOKEN?.trim()) {
    console.log(`pending_order_token: ${process.env.QA_PENDING_ORDER_TOKEN.slice(0, 12)}...`);
  }
}

function resolveFixtures(): void {
  hydrateEnvFromDotEnv();

  if (hasExplicitQaEnv()) {
    applyFixtureEnv(
      {
        event_id: process.env.QA_EVENT_ID!.trim(),
        ticket_type_id: process.env.QA_TICKET_TYPE_ID!.trim(),
        paid_order_token: process.env.QA_PAID_ORDER_TOKEN!.trim(),
        pass_tokens: [process.env.QA_PASS_TOKEN!.trim()],
        pending_order_token: process.env.QA_PENDING_ORDER_TOKEN?.trim(),
      },
      'env',
    );
    return;
  }

  const partialEnv = REQUIRED_ENV.filter((key) => Boolean(process.env[key]?.trim()));
  if (partialEnv.length > 0) {
    failEnv(
      `Incomplete QA env override. Provide all of: ${REQUIRED_ENV.join(', ')}\n` +
        `Currently set: ${partialEnv.join(', ')}`,
    );
  }

  const fixtures = loadFixturesFile();
  if (!fixtures) {
    failEnv('No qa/fixtures.json found and required QA_* env vars are not set.');
  }

  applyFixtureEnv(fixtures, 'file');
}

function validateRequiredEnv(): void {
  resolveFixtures();

  const missing = REQUIRED_ENV.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    failEnv(`Missing required fixture value(s): ${missing.join(', ')}`);
  }
}

function isLocalSupabaseHost(hostname: string): boolean {
  return hostname === '127.0.0.1' || hostname === 'localhost';
}

function allowsRemoteSupabase(): boolean {
  return process.env.QA_WEB_ALLOW_REMOTE === 'true';
}

function failRemoteSupabaseMismatch(supabaseUrl: string): never {
  console.error('\n808Tix web QA: environment mismatch\n');
  console.error('qa:web is using local fixtures, but Expo web is pointed at remote Supabase:');
  console.error(`EXPO_PUBLIC_SUPABASE_URL=${supabaseUrl}\n`);
  console.error('Run:\n');
  console.error(LOCAL_SUPABASE_FIX_COMMANDS);
  process.exit(1);
}

function failMissingLocalSupabaseUrl(): never {
  console.error('\n808Tix web QA: missing local Supabase configuration\n');
  console.error(
    'qa:web uses local fixtures and requires EXPO_PUBLIC_SUPABASE_URL to point at local Supabase.',
  );
  console.error('\nRun:\n');
  console.error(LOCAL_SUPABASE_FIX_COMMANDS);
  process.exit(1);
}

function failMissingAnonKey(): never {
  console.error('\n808Tix web QA: missing Supabase anon key\n');
  console.error(
    'EXPO_PUBLIC_SUPABASE_URL is local, but EXPO_PUBLIC_SUPABASE_ANON_KEY is not set.',
  );
  console.error('\nRun:\n');
  console.error(LOCAL_SUPABASE_FIX_COMMANDS);
  process.exit(1);
}

async function assertLocalExpoSupabaseEnv(): Promise<void> {
  if (allowsRemoteSupabase()) {
    console.log('QA_WEB_ALLOW_REMOTE=true — skipping local Supabase preflight.');
    return;
  }

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl) {
    failMissingLocalSupabaseUrl();
  }

  let parsed: URL;

  try {
    parsed = new URL(supabaseUrl);
  } catch {
    console.error(`\n808Tix web QA: invalid EXPO_PUBLIC_SUPABASE_URL: ${supabaseUrl}`);
    process.exit(1);
  }

  if (!isLocalSupabaseHost(parsed.hostname)) {
    failRemoteSupabaseMismatch(supabaseUrl);
  }

  if (!anonKey) {
    failMissingAnonKey();
  }

  try {
    const response = await fetch(`${supabaseUrl.replace(/\/+$/, '')}/rest/v1/`, {
      method: 'HEAD',
      headers: {
        apikey: anonKey,
      },
    });

    if (!response.ok && response.status !== 401) {
      console.error(
        `\n808Tix web QA: local Supabase REST probe failed with HTTP ${response.status} (${supabaseUrl})`,
      );
      console.error('Start local Supabase with: supabase start');
      process.exit(1);
    }

    console.log(`Local Supabase probe OK (${supabaseUrl})`);
  } catch (error) {
    console.error(`\n808Tix web QA: could not reach local Supabase at ${supabaseUrl}`);
    console.error(String(error));
    console.error('Start local Supabase with: supabase start');
    process.exit(1);
  }
}

async function assertPlaywrightChromiumInstalled(): Promise<void> {
  try {
    const browser = await chromium.launch({ headless: true });
    await browser.close();
  } catch (error) {
    const message = String(error);
    const looksLikeMissingBrowser =
      /Executable doesn't exist|browserType\.launch|Failed to launch chromium|Please run the following command/i.test(
        message,
      );

    if (looksLikeMissingBrowser) {
      console.error('\nPlaywright Chromium is not installed.');
      console.error('Run once:');
      console.error('  npx playwright install chromium');
      process.exit(1);
    }

    throw error;
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
  const missingRequiredScreenshots: string[] = [];

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

    if (row.requiredScreenshot && !screenshotExists && displayStatus === 'PASSED') {
      missingRequiredScreenshots.push(row.screenshot);
    }

    console.log(
      `${row.testTitle.padEnd(46)} ${screenshotLabel.padEnd(28)} ${displayStatus.padEnd(8)} ${row.route}`,
    );
  }

  console.log('='.repeat(88));
  console.log(`Screenshots saved under: ${SCREENSHOT_DIR}`);

  if (missingRequiredScreenshots.length > 0) {
    console.error('\nFAIL: required auth UI screenshots missing:');
    for (const name of missingRequiredScreenshots) {
      console.error(`  - ${join(SCREENSHOT_DIR, name)}`);
    }
    process.exitCode = 1;
  }
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
  await assertLocalExpoSupabaseEnv();
  await assertPlaywrightChromiumInstalled();
  prepareScreenshotDir();

  const forwardedArgs = process.argv.slice(2);
  console.log('\n808Tix web QA — running Playwright tests\n');

  const exitCode = await runPlaywright(forwardedArgs);
  printSummary(exitCode);

  const summaryFailed = process.exitCode === 1;
  const finalCode = exitCode !== 0 || summaryFailed ? exitCode || 1 : 0;

  if (finalCode !== 0) {
    console.error(`\nFAIL: Playwright exited with code ${exitCode}${summaryFailed ? ' (or required screenshots missing)' : ''}`);
    console.error(
      'If the browser binary is missing, run once: npx playwright install chromium',
    );
    process.exit(finalCode);
  }

  console.log('\nPASS: web QA completed.');
}

main().catch((error) => {
  console.error('\nFAIL: qa-web runner error:', error);
  process.exit(1);
});
