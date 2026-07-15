#!/usr/bin/env npx tsx
/**
 * Local real Resend order-confirmation email smoke.
 *
 * Calls send-order-confirmation-email for an existing paid order token.
 * Does not run Stripe Checkout.
 *
 * Usage:
 *   EMAIL_SMOKE_ORDER_TOKEN=... \
 *   EMAIL_OVERRIDE_TO=you@example.com \
 *   RESEND_API_KEY=re_... \
 *   EMAIL_FROM='808Tickets <tickets@your-verified-domain.com>' \
 *   PUBLIC_SITE_URL=http://localhost:8081 \
 *   npm run smoke:email:send
 */
import { type ChildProcess, execFile, spawn } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { WriteStream } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const FUNCTIONS_ENV_PATH = join(ROOT, 'supabase/functions/.env');
const ARTIFACTS_DIR = join(ROOT, 'qa/artifacts/email-send');
const GENERATED_ENV_PATH = join(ARTIFACTS_DIR, 'smoke-email-send.functions.env');
const LOG_PATH = join(ARTIFACTS_DIR, 'latest.log');
const EMAIL_FUNCTION_URL = 'http://127.0.0.1:54321/functions/v1/send-order-confirmation-email';
const FUNCTIONS_READY_TIMEOUT_MS = 120_000;
const FUNCTIONS_READY_POLL_MS = 1_000;

type CheckResult = 'PASS' | 'FAIL' | 'WARN';

type CheckRow = {
  check: string;
  expected: string;
  actual: string;
  result: CheckResult;
  required: boolean;
};

type OutboundMessageRow = {
  status: string;
  provider: string;
  recipient: string;
  message_type: string;
  attempt_count: number;
  error: string | null;
  provider_message_id: string | null;
  created_at: string;
};

let functionsChild: ChildProcess | null = null;
let cleaningUp = false;
let logStream: WriteStream | null = null;
const checkRows: CheckRow[] = [];

function appendLog(line: string): void {
  logStream?.write(`${line}\n`);
}

function log(line: string): void {
  console.log(line);
  appendLog(line);
}

function logError(line: string): void {
  console.error(line);
  appendLog(line);
}

function addCheck(
  check: string,
  expected: string,
  actual: string,
  result: CheckResult,
  required = true,
): void {
  checkRows.push({ check, expected, actual, result, required });
}

function maskToken(token: string): string {
  if (token.length <= 12) {
    return '***';
  }

  return `${token.slice(0, 8)}...`;
}

function maskEmail(email: string): string {
  const trimmed = email.trim();
  const atIndex = trimmed.indexOf('@');

  if (atIndex <= 1) {
    return '***';
  }

  return `${trimmed.slice(0, 1)}***${trimmed.slice(atIndex)}`;
}

function maskSecret(value: string | undefined): string {
  if (!value?.trim()) {
    return '(missing)';
  }

  if (value.startsWith('re_')) {
    return 're_***';
  }

  return '(set)';
}

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

function isLocalSupabaseUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === '127.0.0.1' || host === 'localhost';
  } catch {
    return false;
  }
}

function isPlaceholderResendKey(value: string | undefined): boolean {
  if (!value?.trim()) {
    return true;
  }

  return value.includes('...') || value === 're_' || value.length < 8;
}

function isPlaceholderEmailFrom(value: string | undefined): boolean {
  if (!value?.trim()) {
    return true;
  }

  const lower = value.toLowerCase();
  return (
    lower.includes('your-verified-domain') ||
    lower.includes('yourdomain') ||
    lower.includes('example.com') ||
    lower.includes('...') ||
    !lower.includes('@')
  );
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function initLog(): void {
  mkdirSync(ARTIFACTS_DIR, { recursive: true });
  logStream = createWriteStream(LOG_PATH, { flags: 'w' });
  log(`Email send smoke log: ${LOG_PATH}`);
}

async function killFunctionsChild(): Promise<void> {
  if (cleaningUp) {
    return;
  }

  cleaningUp = true;

  if (!functionsChild || functionsChild.killed || functionsChild.exitCode !== null) {
    return;
  }

  functionsChild.kill('SIGTERM');
  await new Promise((resolve) => setTimeout(resolve, 1_500));

  if (!functionsChild.killed && functionsChild.exitCode === null) {
    functionsChild.kill('SIGKILL');
  }
}

function setupCleanupHandlers(): void {
  const handleSignal = (signal: NodeJS.Signals) => {
    logError(`\nReceived ${signal} — stopping email send smoke services...`);
    void killFunctionsChild().finally(() => {
      process.exit(signal === 'SIGINT' ? 130 : 1);
    });
  };

  process.on('SIGINT', () => handleSignal('SIGINT'));
  process.on('SIGTERM', () => handleSignal('SIGTERM'));
}

function prefixLines(prefix: string, chunk: string, stream: NodeJS.WriteStream): void {
  for (const line of chunk.split(/\r?\n/)) {
    if (!line.trim()) {
      continue;
    }

    const formatted = `${prefix} ${line}`;
    stream.write(`${formatted}\n`);
    appendLog(formatted);
  }
}

async function loadLocalSupabaseEnv(): Promise<{
  apiUrl: string;
  serviceRoleKey: string;
}> {
  try {
    const { stdout } = await execFileAsync('supabase', ['status', '-o', 'env'], {
      cwd: ROOT,
      maxBuffer: 10 * 1024 * 1024,
    });
    const statusEnv = parseStatusEnv(stdout);
    const apiUrl = statusEnv.API_URL?.trim();
    const serviceRoleKey = statusEnv.SERVICE_ROLE_KEY?.trim();

    if (!apiUrl || !serviceRoleKey) {
      throw new Error('API_URL or SERVICE_ROLE_KEY missing from supabase status.');
    }

    if (!isLocalSupabaseUrl(apiUrl) && process.env.SMOKE_ALLOW_REMOTE !== 'true') {
      throw new Error(
        `Refusing non-local Supabase URL: ${apiUrl}. Set SMOKE_ALLOW_REMOTE=true to override.`,
      );
    }

    return { apiUrl, serviceRoleKey };
  } catch (error) {
    throw new Error(`Local Supabase is not running. Run: supabase start\n${String(error)}`);
  }
}

async function runSupabaseQuery(sql: string): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
}> {
  try {
    const result = await execFileAsync('supabase', ['db', 'query', '--local', sql], {
      cwd: ROOT,
      maxBuffer: 10 * 1024 * 1024,
    });
    return { stdout: result.stdout, stderr: result.stderr, exitCode: 0 };
  } catch (error) {
    const execError = error as { stdout?: string; stderr?: string; code?: number | string };
    return {
      stdout: execError.stdout ?? '',
      stderr: execError.stderr ?? '',
      exitCode: typeof execError.code === 'number' ? execError.code : 1,
    };
  }
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

function parseBoxTable(output: string): { columns: string[]; rows: string[][] } {
  const cellLines = output
    .split('\n')
    .filter((line) => line.includes('│') && !isBoxBorderLine(line));

  if (cellLines.length === 0) {
    return { columns: [], rows: [] };
  }

  const parseRow = (line: string) =>
    line
      .split('│')
      .slice(1, -1)
      .map((cell) => cell.trim());

  const columns = parseRow(cellLines[0]);
  const rows = cellLines.slice(1).map(parseRow);
  return { columns, rows };
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

function parseJsonValue<T>(rawValue: string): T {
  const trimmed = rawValue.trim();
  if (!trimmed || trimmed === 'null') {
    return null as T;
  }

  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const balanced = extractBalancedJson(trimmed);
    if (!balanced) {
      throw new Error(`Value is not valid JSON: ${trimmed.slice(0, 200)}`);
    }
    return JSON.parse(balanced) as T;
  }
}

function extractJsonCell<T>(output: string, columnName: string): T {
  const jsonRows = parseJsonRows(output);
  if (jsonRows.length > 0 && columnName in jsonRows[0]) {
    const value = jsonRows[0][columnName];
    if (value === null || value === undefined || value === '' || value === 'null') {
      return null as T;
    }
    if (typeof value === 'string') {
      return parseJsonValue<T>(value);
    }
    if (typeof value === 'object') {
      return value as T;
    }
    return value as T;
  }

  const { columns, rows } = parseBoxTable(output);
  const columnIndex = columns.findIndex((column) => column === columnName);
  if (columnIndex >= 0 && rows.length > 0) {
    const cell = rows[0][columnIndex] ?? '';
    if (cell !== '' && cell !== 'null') {
      return parseJsonValue<T>(cell);
    }
  }

  const balanced = extractBalancedJson(output);
  if (balanced) {
    return JSON.parse(balanced) as T;
  }

  throw new Error(`Could not parse ${columnName} from supabase db query output`);
}

async function queryResultJson<T>(sql: string): Promise<T> {
  const { stdout, stderr, exitCode } = await runSupabaseQuery(sql);

  if (exitCode !== 0 || (/^ERROR:/im.test(stdout) && !stdout.includes('│'))) {
    throw new Error(stderr.trim() || stdout.trim() || 'supabase db query failed');
  }

  return extractJsonCell<T>(stdout, 'result');
}

async function verifyPaidOrder(orderToken: string): Promise<{
  orderId: string;
  status: string;
}> {
  const sql = `
    select coalesce(
      (
        select row_to_json(t)::text
        from (
          select id::text as order_id, status
          from public.orders
          where public_access_token = '${orderToken.replace(/'/g, "''")}'
          limit 1
        ) t
      ),
      'null'
    ) as result;
  `;

  const row = await queryResultJson<{ order_id: string; status: string } | null>(sql);

  if (!row?.order_id) {
    throw new Error('EMAIL_SMOKE_ORDER_TOKEN was not found in local orders.');
  }

  if (row.status !== 'paid') {
    throw new Error('EMAIL_SMOKE_ORDER_TOKEN must be a paid order token.');
  }

  return { orderId: row.order_id, status: row.status };
}

async function findExistingOrderConfirmation(orderId: string): Promise<{
  status: string;
  provider: string;
} | null> {
  const sql = `
    select coalesce(
      (
        select row_to_json(t)::text
        from (
          select status, provider
          from public.outbound_messages
          where order_id = '${orderId}'::uuid
            and message_type = 'order_confirmation'
            and status in ('sent', 'skipped')
          order by created_at desc
          limit 1
        ) t
      ),
      'null'
    ) as result;
  `;

  return queryResultJson<{ status: string; provider: string } | null>(sql);
}

async function queryLatestOrderConfirmations(): Promise<OutboundMessageRow[]> {
  const sql = `
    select coalesce(
      (
        select json_agg(row_to_json(t))::text
        from (
          select
            status,
            provider,
            recipient,
            message_type,
            attempt_count,
            error,
            provider_message_id,
            created_at
          from public.outbound_messages
          where message_type = 'order_confirmation'
          order by created_at desc
          limit 5
        ) t
      ),
      '[]'
    ) as result;
  `;

  return queryResultJson<OutboundMessageRow[]>(sql);
}

function writeFunctionsEnv(params: {
  publicSiteUrl: string;
  emailOverrideTo: string;
  resendApiKey: string;
  emailFrom: string;
  statusApiUrl: string;
  serviceRoleKey: string;
}): void {
  const baseEnv = parseEnvFile(FUNCTIONS_ENV_PATH);
  const merged: Record<string, string> = {
    ...baseEnv,
    SUPABASE_URL: params.statusApiUrl,
    SUPABASE_SERVICE_ROLE_KEY: params.serviceRoleKey,
    PUBLIC_SITE_URL: params.publicSiteUrl,
    EMAIL_DELIVERY_MODE: 'send',
    EMAIL_OVERRIDE_TO: params.emailOverrideTo,
    RESEND_API_KEY: params.resendApiKey,
    EMAIL_FROM: params.emailFrom,
  };

  const lines = Object.entries(merged)
    .filter(([, value]) => value.trim().length > 0)
    .map(([key, value]) => `${key}=${value}`);

  mkdirSync(ARTIFACTS_DIR, { recursive: true });
  writeFileSync(GENERATED_ENV_PATH, `${lines.join('\n')}\n`, 'utf8');
  log(`Wrote functions env (secrets masked): ${GENERATED_ENV_PATH}`);
}

function spawnFunctionsServe(): ChildProcess {
  const child = spawn(
    'supabase',
    ['functions', 'serve', 'send-order-confirmation-email', '--env-file', GENERATED_ENV_PATH],
    {
      cwd: ROOT,
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

  child.stdout?.on('data', (chunk: Buffer) => {
    prefixLines('[functions]', chunk.toString('utf8'), process.stdout);
  });

  child.stderr?.on('data', (chunk: Buffer) => {
    prefixLines('[functions]', chunk.toString('utf8'), process.stderr);
  });

  functionsChild = child;
  return child;
}

async function waitForFunctionReady(): Promise<void> {
  const deadline = Date.now() + FUNCTIONS_READY_TIMEOUT_MS;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(EMAIL_FUNCTION_URL, { method: 'GET' });
      if (response.status === 405 || response.status === 401 || response.status === 400) {
        log(`Functions ready: send-order-confirmation-email reachable (GET → ${response.status})`);
        return;
      }
    } catch {
      // Keep polling.
    }

    await new Promise((resolve) => setTimeout(resolve, FUNCTIONS_READY_POLL_MS));
  }

  throw new Error(
    `Timed out waiting for Edge Function at ${EMAIL_FUNCTION_URL} (expected GET → 405/401).`,
  );
}

async function callSendOrderConfirmationEmail(
  serviceRoleKey: string,
  orderToken: string,
): Promise<Record<string, unknown>> {
  const response = await fetch(EMAIL_FUNCTION_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      order_public_access_token: orderToken,
    }),
  });

  const text = await response.text();
  let body: Record<string, unknown>;

  try {
    body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`Function returned non-JSON response (HTTP ${response.status})`);
  }

  return {
    httpStatus: response.status,
    ...body,
  };
}

function printChecks(): void {
  log('\n=== Real email send smoke results ===\n');
  log(`${'Check'.padEnd(34)} ${'Expected'.padEnd(24)} ${'Actual'.padEnd(28)} Result`);
  log('-'.repeat(96));

  for (const row of checkRows) {
    log(
      `${row.check.padEnd(34)} ${row.expected.padEnd(24)} ${row.actual.padEnd(28)} ${row.result}`,
    );
  }
}

async function main(): Promise<void> {
  initLog();
  setupCleanupHandlers();

  log('808Tickets real email send smoke (Resend)\n');
  log('This command does not run Stripe Checkout.');
  log('It sends a real order confirmation for an existing paid order token.\n');

  const orderToken = process.env.EMAIL_SMOKE_ORDER_TOKEN?.trim();
  const emailOverrideTo = process.env.EMAIL_OVERRIDE_TO?.trim();
  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  const emailFrom = process.env.EMAIL_FROM?.trim();
  let publicSiteUrl = process.env.PUBLIC_SITE_URL?.trim();

  if (!orderToken) {
    throw new Error('EMAIL_SMOKE_ORDER_TOKEN is required.');
  }

  if (!emailOverrideTo) {
    throw new Error(
      'EMAIL_OVERRIDE_TO is required so smoke never emails the original buyer accidentally.',
    );
  }

  if (!isValidEmail(emailOverrideTo)) {
    throw new Error('EMAIL_OVERRIDE_TO must be a valid email address.');
  }

  if (isPlaceholderResendKey(resendApiKey)) {
    throw new Error('RESEND_API_KEY is missing or placeholder.');
  }

  if (isPlaceholderEmailFrom(emailFrom)) {
    throw new Error(
      'EMAIL_FROM is missing or placeholder. Use a verified Resend sender, e.g. 808Tickets <tickets@your-domain.com>.',
    );
  }

  if (!publicSiteUrl) {
    publicSiteUrl = 'http://localhost:8081';
    addCheck('PUBLIC_SITE_URL', 'set', 'defaulted to localhost:8081', 'WARN', false);
    log('WARN: PUBLIC_SITE_URL missing; defaulting to http://localhost:8081');
  } else {
    addCheck('PUBLIC_SITE_URL', 'set', publicSiteUrl, 'PASS', false);
  }

  addCheck('EMAIL_SMOKE_ORDER_TOKEN', 'present', maskToken(orderToken), 'PASS');
  addCheck('EMAIL_OVERRIDE_TO', 'present', maskEmail(emailOverrideTo), 'PASS');
  addCheck('RESEND_API_KEY', 'present', maskSecret(resendApiKey), 'PASS');
  addCheck('EMAIL_FROM', 'verified sender', '(set, masked)', 'PASS');
  addCheck('EMAIL_DELIVERY_MODE', 'send', 'send (forced)', 'PASS');

  const { apiUrl, serviceRoleKey } = await loadLocalSupabaseEnv();
  log(`Using local Supabase: ${apiUrl}`);

  const paidOrder = await verifyPaidOrder(orderToken);
  addCheck('Paid order verified', 'paid', paidOrder.status, 'PASS');
  log(`Paid order verified: order_id=${paidOrder.orderId.slice(0, 8)}... status=${paidOrder.status}`);

  const existing = await findExistingOrderConfirmation(paidOrder.orderId);
  if (existing) {
    addCheck(
      'Idempotency clear',
      'no prior sent confirmation',
      `${existing.status}/${existing.provider}`,
      'FAIL',
    );
    printChecks();
    throw new Error(
      'This order already has an order_confirmation outbound message. Use a fresh paid order token for real send smoke.',
    );
  }

  addCheck('Idempotency clear', 'no prior sent confirmation', 'clear', 'PASS');

  writeFunctionsEnv({
    publicSiteUrl,
    emailOverrideTo,
    resendApiKey: resendApiKey!,
    emailFrom: emailFrom!,
    statusApiUrl: apiUrl,
    serviceRoleKey,
  });

  spawnFunctionsServe();
  await waitForFunctionReady();
  addCheck('Function served/reachable', 'ready', 'ready', 'PASS');

  log('\nCalling send-order-confirmation-email ...\n');
  const response = await callSendOrderConfirmationEmail(serviceRoleKey, orderToken);

  const ok = response.ok === true;
  const alreadySent = response.already_sent === true;
  const provider = typeof response.provider === 'string' ? response.provider : '(unknown)';
  const outboundStatus =
    typeof response.outbound_message_status === 'string'
      ? response.outbound_message_status
      : '(unknown)';
  const httpStatus = typeof response.httpStatus === 'number' ? response.httpStatus : 0;

  if (alreadySent) {
    addCheck('Resend send attempted', 'new send', 'already_sent', 'FAIL');
    printChecks();
    throw new Error(
      'This order already has an order_confirmation outbound message. Use a fresh paid order token for real send smoke.',
    );
  }

  if (!ok || httpStatus >= 400) {
    addCheck(
      'Resend send attempted',
      'ok',
      typeof response.message === 'string' ? response.message : `HTTP ${httpStatus}`,
      'FAIL',
    );
    printChecks();
    throw new Error(
      typeof response.message === 'string'
        ? response.message
        : `send-order-confirmation-email failed (HTTP ${httpStatus})`,
    );
  }

  addCheck('Resend send attempted', 'ok / provider=resend', `${provider}/${outboundStatus}`, 'PASS');

  const latest = await queryLatestOrderConfirmations();
  const latestRow = latest[0];

  if (!latestRow) {
    addCheck('outbound_messages row', 'present', 'missing', 'FAIL');
    printChecks();
    throw new Error('No outbound_messages order_confirmation row found after send.');
  }

  const providerIdPresent = Boolean(latestRow.provider_message_id);
  addCheck(
    'outbound_messages status/provider',
    'sent / resend',
    `${latestRow.status} / ${latestRow.provider}`,
    latestRow.status === 'sent' && latestRow.provider === 'resend' ? 'PASS' : 'FAIL',
  );
  addCheck(
    'provider_message_id',
    'present',
    providerIdPresent ? '(set, masked)' : '(missing)',
    providerIdPresent ? 'PASS' : 'WARN',
    false,
  );
  addCheck(
    'override recipient applied',
    maskEmail(emailOverrideTo),
    maskEmail(latestRow.recipient),
    latestRow.recipient.toLowerCase() === emailOverrideTo.toLowerCase() ? 'PASS' : 'WARN',
    false,
  );

  printChecks();

  const requiredFails = checkRows.filter((row) => row.required && row.result === 'FAIL');
  if (requiredFails.length > 0) {
    throw new Error(`${requiredFails.length} required check(s) failed.`);
  }

  log('\nNext:');
  log(`- Check inbox/spam for ${maskEmail(emailOverrideTo)}`);
  log('- Confirm Resend dashboard shows the delivery');
  log(`- See log: ${LOG_PATH}`);
  log('\nPASS: real email send smoke completed.');
}

main()
  .catch(async (error) => {
    logError(`\nFAIL: smoke-email-send error: ${String(error)}`);
    logError(`See log: ${LOG_PATH}`);
    await killFunctionsChild();
    process.exit(1);
  })
  .finally(async () => {
    await killFunctionsChild();
    logStream?.end();
  });
