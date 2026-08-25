#!/usr/bin/env npx tsx
/**
 * One-command local Stripe preview smoke orchestrator.
 *
 * Starts stripe listen + supabase functions serve + Expo web (preview email env),
 * runs smoke:payments:local with automatic test PaymentIntent confirm by default,
 * then verifies outbound_messages preview rows.
 *
 * Usage:
 *   npm run smoke:payments:preview
 *
 * Manual browser card entry fallback:
 *   SMOKE_MANUAL_CHECKOUT=true npm run smoke:payments:preview
 */
import { type ChildProcess, execFile, spawn } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { WriteStream } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const FUNCTIONS_ENV_PATH = join(ROOT, 'supabase/functions/.env');
const PREVIEW_ENV_PATH = join(ROOT, 'qa/artifacts/smoke-preview.functions.env');
const LOG_PATH = join(ROOT, 'qa/artifacts/smoke-preview/latest.log');
const WEBHOOK_FORWARD_URL = 'http://127.0.0.1:54321/functions/v1/stripe-webhook';
const CHECKOUT_FUNCTION_URL = 'http://127.0.0.1:54321/functions/v1/create-checkout-session';
const WEBHOOK_FUNCTION_URL = 'http://127.0.0.1:54321/functions/v1/stripe-webhook';
/** Must match smoke-payments-local success/cancel redirect origin. */
const EXPO_WEB_URL = 'http://127.0.0.1:8081';
const SUCCESS_PAGE_URL = `${EXPO_WEB_URL}/purchase/success`;
const DEFAULT_EMAIL_OVERRIDE = 'preview@example.test';
const STRIPE_SECRET_PATTERN = /whsec_[a-zA-Z0-9]+/;
const STRIPE_LISTEN_READY_TIMEOUT_MS = 45_000;
const FUNCTIONS_READY_TIMEOUT_MS = 120_000;
const EXPO_WEB_READY_TIMEOUT_MS = 120_000;
const FUNCTIONS_READY_POLL_MS = 1_000;
const EXPO_WEB_POLL_MS = 1_000;

type ManagedChildName = 'stripe' | 'functions' | 'web';

type ManagedChild = {
  name: ManagedChildName;
  process: ChildProcess;
  stopOnCleanup: boolean;
};

type OutboundMessageRow = {
  status: string;
  provider: string;
  recipient: string;
  message_type: string;
  attempt_count: number;
  error: string | null;
  created_at: string;
};

const managedChildren: ManagedChild[] = [];
let cleaningUp = false;
let logStream: WriteStream | null = null;

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

function parseStatusEnv(stdout: string): Record<string, string> {
  const values: Record<string, string> = {};

  for (const line of stdout.split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)="(.*)"/);
    if (match) {
      values[match[1]] = match[2];
    }
  }

  return values;
}

function isPlaceholderSecret(value: string | undefined): boolean {
  if (!value?.trim()) {
    return true;
  }

  return value.includes('...') || value === 'sk_test_...' || value === 'whsec_...';
}

function isLocalSupabaseUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === '127.0.0.1' || host === 'localhost';
  } catch {
    return false;
  }
}

function initLog(): void {
  mkdirSync(join(ROOT, 'qa/artifacts/smoke-preview'), { recursive: true });
  logStream = createWriteStream(LOG_PATH, { flags: 'w' });
  console.log(`Smoke preview log: ${LOG_PATH}`);
  appendLog('808Tix Stripe preview smoke orchestrator (local only)');
}

function appendLog(line: string): void {
  logStream?.write(`${line}\n`);
}

function failAndExit(message: string, nextAction?: string): never {
  const failLine = `Preview smoke stopped: ${message}`;
  console.error(`\n${failLine}`);
  appendLog(`FAIL: ${failLine}`);
  if (nextAction) {
    console.error(`Next action: ${nextAction}`);
    appendLog(`Next action: ${nextAction}`);
  }
  console.error(`\nSee log: ${LOG_PATH}`);
  process.exit(1);
}

function prefixForName(name: ManagedChildName): string {
  if (name === 'stripe') {
    return '[stripe]';
  }

  if (name === 'functions') {
    return '[functions]';
  }

  return '[web]';
}

function writePrefixedLine(prefix: string, line: string, stream: NodeJS.WriteStream): void {
  const formatted = `${prefix} ${line}`;
  stream.write(`${formatted}\n`);
  appendLog(formatted);
}

function prefixLines(prefix: string, chunk: string, stream: NodeJS.WriteStream): void {
  for (const line of chunk.split(/\r?\n/)) {
    if (!line.trim()) {
      continue;
    }

    writePrefixedLine(prefix, line, stream);
  }
}

function spawnManaged(
  name: ManagedChildName,
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  stopOnCleanup = true,
): ChildProcess {
  const prefix = prefixForName(name);
  const child = spawn(command, args, {
    cwd: ROOT,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout?.on('data', (chunk: Buffer) => {
    prefixLines(prefix, chunk.toString('utf8'), process.stdout);
  });

  child.stderr?.on('data', (chunk: Buffer) => {
    prefixLines(prefix, chunk.toString('utf8'), process.stderr);
  });

  managedChildren.push({ name, process: child, stopOnCleanup });
  return child;
}

async function killManagedChildren(): Promise<void> {
  if (cleaningUp) {
    return;
  }

  cleaningUp = true;

  for (const child of managedChildren) {
    if (!child.stopOnCleanup || child.process.killed || child.process.exitCode !== null) {
      continue;
    }

    child.process.kill('SIGTERM');
  }

  await new Promise((resolve) => setTimeout(resolve, 1_500));

  for (const child of managedChildren) {
    if (!child.stopOnCleanup || child.process.killed || child.process.exitCode !== null) {
      continue;
    }

    child.process.kill('SIGKILL');
  }
}

function setupCleanupHandlers(): void {
  const handleSignal = (signal: NodeJS.Signals) => {
    const message = `Received ${signal} — stopping preview smoke services...`;
    console.error(`\n${message}`);
    appendLog(message);
    void killManagedChildren().finally(() => {
      process.exit(signal === 'SIGINT' ? 130 : 1);
    });
  };

  process.on('SIGINT', () => handleSignal('SIGINT'));
  process.on('SIGTERM', () => handleSignal('SIGTERM'));
}

async function assertStripeCliAvailable(): Promise<void> {
  try {
    const { stdout } = await execFileAsync('stripe', ['--version'], { cwd: ROOT });
    const line = `Stripe CLI: ${stdout.trim()}`;
    console.log(line);
    appendLog(line);
  } catch {
    failAndExit(
      'Stripe CLI is not available.',
      'Install Stripe CLI and ensure `stripe` is on your PATH.',
    );
  }
}

async function loadLocalSupabaseEnv(): Promise<Record<string, string>> {
  try {
    const { stdout } = await execFileAsync('supabase', ['status', '-o', 'env'], {
      cwd: ROOT,
      maxBuffer: 10 * 1024 * 1024,
    });
    return parseStatusEnv(stdout);
  } catch (error) {
    failAndExit('Local Supabase is not running.', `Run: supabase start\n${String(error)}`);
  }
}

function assertLocalOnly(statusEnv: Record<string, string>): string {
  const apiUrl = statusEnv.API_URL?.trim();

  if (!apiUrl) {
    failAndExit('API_URL missing from supabase status.', 'Run: supabase start');
  }

  const allowRemote = process.env.SMOKE_ALLOW_REMOTE === 'true';
  if (!isLocalSupabaseUrl(apiUrl) && !allowRemote) {
    failAndExit(
      `Refusing to run preview smoke against non-local Supabase URL: ${apiUrl}`,
      'Set SMOKE_ALLOW_REMOTE=true only if you intentionally know what you are doing.',
    );
  }

  const line = `Using local Supabase: ${apiUrl}`;
  console.log(line);
  appendLog(line);
  return apiUrl;
}

function assertStripeSecrets(functionsEnv: Record<string, string>): {
  stripeSecretKey: string;
} {
  const stripeSecretKey =
    process.env.STRIPE_SECRET_KEY?.trim() || functionsEnv.STRIPE_SECRET_KEY?.trim() || '';

  if (isPlaceholderSecret(stripeSecretKey)) {
    failAndExit(
      'STRIPE_SECRET_KEY is missing or placeholder.',
      'Set sk_test_... in supabase/functions/.env or export STRIPE_SECRET_KEY.',
    );
  }

  if (stripeSecretKey.startsWith('sk_live_') && process.env.SMOKE_ALLOW_LIVE_STRIPE !== 'true') {
    failAndExit(
      'Refusing to run preview smoke with live Stripe secret key.',
      'Use sk_test_... for local preview, or set SMOKE_ALLOW_LIVE_STRIPE=true explicitly.',
    );
  }

  return { stripeSecretKey };
}

function writePreviewFunctionsEnv(
  baseEnv: Record<string, string>,
  statusEnv: Record<string, string>,
  webhookSecret: string,
): Record<string, string> {
  const allowSend = process.env.SMOKE_EMAIL_SEND === 'true';
  const merged: Record<string, string> = {
    ...baseEnv,
    SUPABASE_URL: statusEnv.API_URL?.trim() || baseEnv.SUPABASE_URL || '',
    SUPABASE_SERVICE_ROLE_KEY:
      statusEnv.SERVICE_ROLE_KEY?.trim() || baseEnv.SUPABASE_SERVICE_ROLE_KEY || '',
    STRIPE_WEBHOOK_SECRET: webhookSecret,
    PUBLIC_SITE_URL:
      process.env.PUBLIC_SITE_URL?.trim() ||
      baseEnv.PUBLIC_SITE_URL?.trim() ||
      EXPO_WEB_URL,
    EMAIL_DELIVERY_MODE: allowSend
      ? process.env.EMAIL_DELIVERY_MODE?.trim() || baseEnv.EMAIL_DELIVERY_MODE?.trim() || 'send'
      : 'preview',
    EMAIL_OVERRIDE_TO:
      process.env.EMAIL_OVERRIDE_TO?.trim() ||
      baseEnv.EMAIL_OVERRIDE_TO?.trim() ||
      DEFAULT_EMAIL_OVERRIDE,
  };

  if (!allowSend) {
    delete merged.RESEND_API_KEY;
  }

  mkdirSync(join(ROOT, 'qa/artifacts'), { recursive: true });

  const lines = Object.entries(merged)
    .filter(([, value]) => value.trim().length > 0)
    .map(([key, value]) => `${key}=${value}`);

  writeFileSync(PREVIEW_ENV_PATH, `${lines.join('\n')}\n`, 'utf8');
  const line = `Wrote preview functions env: ${PREVIEW_ENV_PATH}`;
  console.log(line);
  appendLog(line);

  return merged;
}

async function isWebReachable(): Promise<boolean> {
  try {
    const response = await fetch(EXPO_WEB_URL, { method: 'GET' });
    return response.status < 500;
  } catch {
    return false;
  }
}

async function waitForWebReachable(): Promise<void> {
  const deadline = Date.now() + EXPO_WEB_READY_TIMEOUT_MS;

  while (Date.now() < deadline) {
    if (await isWebReachable()) {
      const line = `Expo web ready: ${EXPO_WEB_URL}`;
      console.log(line);
      appendLog(line);
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, EXPO_WEB_POLL_MS));
  }

  throw new Error(`Timed out waiting for Expo web at ${EXPO_WEB_URL}`);
}

async function ensureExpoWeb(): Promise<void> {
  if (await isWebReachable()) {
    const line = `Reusing existing Expo web server at ${EXPO_WEB_URL}`;
    console.log(line);
    appendLog(line);
    return;
  }

  const startLine = `Starting Expo web: npm run web -- --port 8081`;
  console.log(startLine);
  appendLog(startLine);

  spawnManaged('web', 'npm', ['run', 'web', '--', '--port', '8081'], { ...process.env }, true);
  await waitForWebReachable();
}

async function waitForStripeWebhookSecret(stripeChild: ChildProcess): Promise<string> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let buffer = '';

    const timeout = setTimeout(() => {
      if (settled) {
        return;
      }

      settled = true;
      reject(
        new Error(
          'Timed out waiting for stripe listen webhook signing secret (whsec_...). Export STRIPE_WEBHOOK_SECRET manually or retry.',
        ),
      );
    }, STRIPE_LISTEN_READY_TIMEOUT_MS);

    const handleChunk = (chunk: Buffer) => {
      buffer += chunk.toString('utf8');
      const match = buffer.match(STRIPE_SECRET_PATTERN);

      if (match) {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          resolve(match[0]);
        }
      }
    };

    stripeChild.stdout?.on('data', handleChunk);
    stripeChild.stderr?.on('data', handleChunk);

    stripeChild.on('exit', (code, signal) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      reject(
        new Error(
          `stripe listen exited before webhook secret was captured (code=${code ?? 'null'}, signal=${signal ?? 'null'}).`,
        ),
      );
    });
  });
}

async function waitForFunctionsReady(): Promise<void> {
  const deadline = Date.now() + FUNCTIONS_READY_TIMEOUT_MS;

  while (Date.now() < deadline) {
    try {
      const checkoutResponse = await fetch(CHECKOUT_FUNCTION_URL, { method: 'GET' });
      const webhookResponse = await fetch(WEBHOOK_FUNCTION_URL, { method: 'GET' });
      const checkoutOk = checkoutResponse.status === 405;
      const webhookOk =
        webhookResponse.status === 405 ||
        webhookResponse.status === 400 ||
        webhookResponse.status === 401;

      if (checkoutOk && webhookOk) {
        const line = `Functions ready: create-checkout-session GET→${checkoutResponse.status}, stripe-webhook GET→${webhookResponse.status}`;
        console.log(line);
        appendLog(line);
        return;
      }
    } catch {
      // Keep polling until timeout.
    }

    await new Promise((resolve) => setTimeout(resolve, FUNCTIONS_READY_POLL_MS));
  }

  throw new Error(
    `Timed out waiting for Edge Functions (checkout ${CHECKOUT_FUNCTION_URL} + webhook ${WEBHOOK_FUNCTION_URL}).`,
  );
}

async function assertSuccessPageReachable(): Promise<void> {
  try {
    const response = await fetch(`${SUCCESS_PAGE_URL}?order_token=preview-preflight`, {
      method: 'GET',
    });
    if (response.status >= 500) {
      failAndExit(
        `Success page returned HTTP ${response.status} at ${SUCCESS_PAGE_URL}`,
        'Ensure Expo web is serving /purchase/success on port 8081.',
      );
    }
    const line = `Success page reachable: ${SUCCESS_PAGE_URL} (HTTP ${response.status})`;
    console.log(line);
    appendLog(line);
  } catch (error) {
    failAndExit(
      `Success page not reachable at ${SUCCESS_PAGE_URL}: ${String(error)}`,
      'Start Expo web on 127.0.0.1:8081 (this orchestrator starts it automatically if free).',
    );
  }
}

function runSmokePaymentsLocal(env: NodeJS.ProcessEnv): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn('npm', ['run', 'smoke:payments:local'], {
      cwd: ROOT,
      env,
      stdio: ['inherit', 'pipe', 'pipe'],
    });

    child.stdout?.on('data', (chunk: Buffer) => {
      prefixLines('[smoke]', chunk.toString('utf8'), process.stdout);
    });

    child.stderr?.on('data', (chunk: Buffer) => {
      prefixLines('[smoke]', chunk.toString('utf8'), process.stderr);
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

function isBoxBorderLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) {
    return false;
  }

  if (/^[┌├└].*[┐┤┘]$/.test(trimmed)) {
    return true;
  }

  return /^[│┌┐└┘├┤┬┴┼─\s]+$/.test(trimmed) && trimmed.includes('─');
}

function parseJsonRows(output: string): Record<string, unknown>[] {
  const start = output.indexOf('{');
  if (start === -1) {
    return [];
  }

  const end = output.indexOf('\nA new version', start);
  const jsonText = end === -1 ? output.slice(start) : output.slice(start, end);

  if (!jsonText.includes('"rows"')) {
    return [];
  }

  const parsed = JSON.parse(jsonText) as { rows?: Record<string, unknown>[] };
  return parsed.rows ?? [];
}

function extractBalancedJson(text: string): string | null {
  for (let index = 0; index < text.length; index += 1) {
    const opener = text[index];
    if (opener !== '{' && opener !== '[') {
      continue;
    }

    const closer = opener === '{' ? '}' : ']';
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let cursor = index; cursor < text.length; cursor += 1) {
      const character = text[cursor];

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (character === '\\') {
          escaped = true;
        } else if (character === '"') {
          inString = false;
        }
        continue;
      }

      if (character === '"') {
        inString = true;
        continue;
      }

      if (character === opener) {
        depth += 1;
      } else if (character === closer) {
        depth -= 1;
        if (depth === 0) {
          return text.slice(index, cursor + 1);
        }
      }
    }
  }

  return null;
}

function parseOutboundRows(output: string): OutboundMessageRow[] {
  const jsonRows = parseJsonRows(output);
  if (jsonRows.length > 0 && 'result' in jsonRows[0]) {
    const value = jsonRows[0].result;
    if (typeof value === 'string') {
      return JSON.parse(value) as OutboundMessageRow[];
    }
    if (Array.isArray(value)) {
      return value as OutboundMessageRow[];
    }
  }

  const balanced = extractBalancedJson(output);
  if (balanced) {
    const parsed = JSON.parse(balanced) as OutboundMessageRow[] | { rows?: OutboundMessageRow[] };
    if (Array.isArray(parsed)) {
      return parsed;
    }
    if (Array.isArray(parsed.rows)) {
      return parsed.rows;
    }
  }

  const cellLines = output
    .split('\n')
    .filter((line) => line.includes('│') && !isBoxBorderLine(line));

  if (cellLines.length >= 2) {
    const parseRow = (line: string) =>
      line
        .split('│')
        .slice(1, -1)
        .map((cell) => cell.trim());

    const columns = parseRow(cellLines[0]);
    return cellLines.slice(1).map((line) => {
      const values = parseRow(line);
      const row: Record<string, string> = {};
      for (let index = 0; index < columns.length; index += 1) {
        row[columns[index]] = values[index] ?? '';
      }
      return {
        status: row.status ?? '',
        provider: row.provider ?? '',
        recipient: row.recipient ?? '',
        message_type: row.message_type ?? '',
        attempt_count: Number(row.attempt_count ?? 0),
        error: row.error || null,
        created_at: row.created_at ?? '',
      };
    });
  }

  throw new Error('Could not parse outbound_messages query output');
}

async function queryOutboundMessages(): Promise<OutboundMessageRow[]> {
  const sql = `
    select coalesce(
      (
        select json_agg(row_to_json(t))::text
        from (
          select status, provider, recipient, message_type, attempt_count, error, payload_snapshot, created_at
          from public.outbound_messages
          where message_type = 'order_confirmation'
          order by created_at desc
          limit 5
        ) t
      ),
      '[]'
    ) as result;
  `;

  const { stdout, stderr } = await execFileAsync('supabase', ['db', 'query', '--local', sql], {
    cwd: ROOT,
    maxBuffer: 10 * 1024 * 1024,
  });

  if (/^ERROR:/im.test(stdout) || /^ERROR:/im.test(stderr)) {
    throw new Error(stderr.trim() || stdout.trim() || 'outbound_messages query failed');
  }

  return parseOutboundRows(stdout);
}

function printOutboundTable(rows: OutboundMessageRow[]): void {
  console.log('\n=== Latest order_confirmation outbound_messages ===\n');
  appendLog('=== Latest order_confirmation outbound_messages ===');

  if (rows.length === 0) {
    console.log('(no rows)');
    appendLog('(no rows)');
    return;
  }

  const header = `${'status'.padEnd(8)} ${'provider'.padEnd(10)} ${'recipient'.padEnd(28)} ${'attempts'.padEnd(8)} created_at`;
  console.log(header);
  console.log('-'.repeat(90));
  appendLog(header);
  appendLog('-'.repeat(90));

  for (const row of rows) {
    const line = `${row.status.padEnd(8)} ${row.provider.padEnd(10)} ${row.recipient.padEnd(28)} ${String(row.attempt_count).padEnd(8)} ${row.created_at}`;
    console.log(line);
    appendLog(line);

    if (row.error) {
      const errorLine = `  error: ${row.error}`;
      console.log(errorLine);
      appendLog(errorLine);
    }
  }
}

async function main(): Promise<void> {
  initLog();

  console.log('808Tix Stripe preview smoke orchestrator (local only)\n');
  console.log('Starts Expo web + stripe listen + Edge Functions, then runs smoke:payments:local.');
  console.log(
    'Default: automatic Stripe Checkout via Playwright (test card 4242…). Set SMOKE_MANUAL_CHECKOUT=true to pay in the browser.\n',
  );
  appendLog('Starts Expo web + stripe listen + Edge Functions, then runs smoke:payments:local.');
  appendLog(
    'Default: automatic Stripe Checkout via Playwright (test card 4242…). Set SMOKE_MANUAL_CHECKOUT=true to pay in the browser.',
  );

  setupCleanupHandlers();

  await assertStripeCliAvailable();

  const statusEnv = await loadLocalSupabaseEnv();
  assertLocalOnly(statusEnv);

  const functionsEnv = parseEnvFile(FUNCTIONS_ENV_PATH);
  const { stripeSecretKey } = assertStripeSecrets(functionsEnv);

  await ensureExpoWeb();
  await assertSuccessPageReachable();

  const stripeChild = spawnManaged(
    'stripe',
    'stripe',
    ['listen', '--forward-to', WEBHOOK_FORWARD_URL],
    { ...process.env },
  );

  const webhookSecret = await waitForStripeWebhookSecret(stripeChild);
  const secretLine = `Captured stripe listen webhook secret: ${webhookSecret.slice(0, 12)}...`;
  console.log(secretLine);
  appendLog(secretLine);

  const previewEnv = writePreviewFunctionsEnv(functionsEnv, statusEnv, webhookSecret);

  if (!previewEnv.STRIPE_SECRET_KEY?.trim()) {
    previewEnv.STRIPE_SECRET_KEY = stripeSecretKey;
  }

  if (isPlaceholderSecret(previewEnv.STRIPE_WEBHOOK_SECRET)) {
    failAndExit(
      'STRIPE_WEBHOOK_SECRET is missing after stripe listen startup.',
      'Export STRIPE_WEBHOOK_SECRET manually from stripe listen output and retry.',
    );
  }

  spawnManaged(
    'functions',
    'supabase',
    [
      'functions',
      'serve',
      'create-checkout-session',
      'stripe-webhook',
      '--env-file',
      PREVIEW_ENV_PATH,
    ],
    { ...process.env },
  );

  await waitForFunctionsReady();

  const smokeEnv: NodeJS.ProcessEnv = {
    ...process.env,
    STRIPE_SECRET_KEY: previewEnv.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: previewEnv.STRIPE_WEBHOOK_SECRET,
    // Prefer auto PaymentIntent confirm unless operator opted into manual browser pay.
    SMOKE_MANUAL_CHECKOUT: process.env.SMOKE_MANUAL_CHECKOUT?.trim() || 'false',
  };

  console.log('\nStarting npm run smoke:payments:local ...\n');
  appendLog('Starting npm run smoke:payments:local ...');

  const smokeExitCode = await runSmokePaymentsLocal(smokeEnv);

  if (smokeExitCode !== 0) {
    console.error(`\nFAIL: smoke:payments:local exited with code ${smokeExitCode}`);
    appendLog(`FAIL: smoke:payments:local exited with code ${smokeExitCode}`);
    console.error(`See log: ${LOG_PATH}`);
    await killManagedChildren();
    process.exit(smokeExitCode);
  }

  const outboundRows = await queryOutboundMessages();
  printOutboundTable(outboundRows);

  const previewSent = outboundRows.some(
    (row) => row.provider === 'preview' && row.status === 'sent' && row.message_type === 'order_confirmation',
  );

  await killManagedChildren();

  if (!previewSent) {
    console.error(
      '\nFAIL: smoke fulfillment may have passed, but email preview was not recorded in outbound_messages.',
    );
    console.error('Check [functions] logs above for order confirmation email output.');
    appendLog(
      'FAIL: smoke fulfillment may have passed, but email preview was not recorded in outbound_messages.',
    );
    console.error(`See log: ${LOG_PATH}`);
    process.exit(1);
  }

  const passLine =
    '\nPASS: Stripe preview smoke completed with order_confirmation preview email recorded.';
  console.log(passLine);
  appendLog(passLine.trim());
  console.log(`Smoke preview log: ${LOG_PATH}`);
}

main()
  .catch(async (error) => {
    console.error('\nFAIL: preview smoke orchestrator error:', error);
    appendLog(`FAIL: preview smoke orchestrator error: ${String(error)}`);
    console.error(`See log: ${LOG_PATH}`);
    await killManagedChildren();
    process.exit(1);
  })
  .finally(async () => {
    logStream?.end();
    await killManagedChildren();
  });
