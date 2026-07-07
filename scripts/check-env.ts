#!/usr/bin/env npx tsx
/**
 * Environment readiness checker (local / preview / production).
 *
 * Usage:
 *   npm run check:env
 *   npm run check:env -- --mode local
 *   npm run check:env -- --mode preview
 *   npm run check:env -- --mode production
 */
import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const DOT_ENV_PATH = join(ROOT, '.env');
const FUNCTIONS_ENV_PATH = join(ROOT, 'supabase/functions/.env');
const FIXTURES_PATH = join(ROOT, 'qa/fixtures.json');

const LOCAL_ENV_FIX = 'eval "$(npm run -s qa:env -- --exports-only)"';

const REQUIRED_TABLES = [
  'events',
  'passes',
  'checkins',
  'ticket_types',
  'orders',
  'order_items',
  'payments',
  'payment_events',
  'outbound_messages',
] as const;

const REQUIRED_RPCS = [
  'validate_pass',
  'create_pending_order',
  'fulfill_paid_order',
  'get_order_by_public_token',
  'get_public_event_purchase_options',
] as const;

const APPLE_WALLET_ENV_KEYS = [
  'APPLE_PASS_TYPE_IDENTIFIER',
  'APPLE_TEAM_ID',
  'APPLE_ORGANIZATION_NAME',
  'APPLE_PASS_CERT_P12_BASE64',
  'APPLE_PASS_CERT_PASSWORD',
  'APPLE_WWDR_CERT_PEM',
] as const;

type Mode = 'local' | 'preview' | 'production';

type CheckResult = 'PASS' | 'FAIL' | 'WARN';

type CheckRow = {
  check: string;
  expected: string;
  actual: string;
  result: CheckResult;
  required: boolean;
};

type QaFixtures = {
  event_id: string;
  paid_order_token?: string;
};

function parseMode(): Mode {
  const index = process.argv.indexOf('--mode');
  const value = index >= 0 ? process.argv[index + 1]?.trim() : '';

  if (value === 'preview' || value === 'production' || value === 'local') {
    return value;
  }

  return 'local';
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

function hydrateEnvFromDotEnv(): void {
  const dotEnv = parseEnvFile(DOT_ENV_PATH);

  for (const [key, value] of Object.entries(dotEnv)) {
    if (!process.env[key]?.trim() && value.trim()) {
      process.env[key] = value;
    }
  }
}

function resolveEnv(key: string, functionsEnv: Record<string, string>): string | undefined {
  return process.env[key]?.trim() || functionsEnv[key]?.trim() || undefined;
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

function isLocalHost(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === '127.0.0.1' || host === 'localhost';
  } catch {
    return false;
  }
}

function maskUrl(url: string | undefined): string {
  if (!url?.trim()) {
    return '(missing)';
  }

  try {
    const parsed = new URL(url);
    return parsed.host;
  } catch {
    return '(invalid URL)';
  }
}

function maskStripeKey(value: string | undefined): string {
  if (!value?.trim()) {
    return '(missing)';
  }

  if (value.startsWith('sk_test_')) {
    return 'sk_test_***';
  }

  if (value.startsWith('sk_live_')) {
    return 'sk_live_***';
  }

  if (value.startsWith('pk_test_')) {
    return 'pk_test_***';
  }

  if (value.startsWith('pk_live_')) {
    return 'pk_live_***';
  }

  return `${value.slice(0, 8)}***`;
}

function maskWhsec(value: string | undefined): string {
  if (!value?.trim()) {
    return '(missing)';
  }

  if (!value.startsWith('whsec_')) {
    return '(invalid prefix)';
  }

  return 'whsec_***';
}

function maskSecretPresent(value: string | undefined): string {
  if (!value?.trim() || value.includes('...')) {
    return '(missing)';
  }

  return '(set)';
}

function isPlaceholder(value: string | undefined): boolean {
  if (!value?.trim()) {
    return true;
  }

  return value.includes('...');
}

function addRow(
  rows: CheckRow[],
  check: string,
  expected: string,
  actual: string,
  result: CheckResult,
  required = true,
): void {
  rows.push({ check, expected, actual, result, required });
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

function extractSingleCellFromBoxTable(output: string, columnName: string): string | null {
  const { columns, rows } = parseBoxTable(output);
  const columnIndex = columns.findIndex((column) => column === columnName);
  if (columnIndex === -1 || rows.length === 0) {
    return null;
  }

  return rows[0][columnIndex] ?? null;
}

type SupabaseQueryParseContext = {
  label?: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  columnName: string;
};

class SupabaseQueryParseError extends Error {
  readonly context: SupabaseQueryParseContext;

  constructor(message: string, context: SupabaseQueryParseContext) {
    super(message);
    this.name = 'SupabaseQueryParseError';
    this.context = context;
  }
}

function formatParseDiagnostics(context: SupabaseQueryParseContext): string {
  const lines = [
    `Could not parse ${context.columnName} from supabase db query output`,
    context.label ? `call site: ${context.label}` : null,
    `exit code: ${context.exitCode}`,
    '--- stdout ---',
    context.stdout.trim() || '(empty)',
    '--- stderr ---',
    context.stderr.trim() || '(empty)',
  ].filter((line): line is string => Boolean(line));

  return lines.join('\n');
}

function extractJsonCell<T>(output: string, columnName: string, context: SupabaseQueryParseContext): T {
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

  const cell = extractSingleCellFromBoxTable(output, columnName);
  if (cell !== null && cell !== '' && cell !== 'null') {
    return parseJsonValue<T>(cell);
  }

  const balancedFromOutput = extractBalancedJson(output);
  if (balancedFromOutput) {
    try {
      return JSON.parse(balancedFromOutput) as T;
    } catch {
      // Fall through to diagnostics below.
    }
  }

  throw new SupabaseQueryParseError(formatParseDiagnostics(context), context);
}

const SUPABASE_CLI_BOX_TABLE_SAMPLE = `Connecting to local database...
┌────────────────────────────────────┐
│               result               │
├────────────────────────────────────┤
│ {"ok" : true, "message" : "hello"} │
└────────────────────────────────────┘
A new version of Supabase CLI is available: v2.109.0 (currently installed v2.101.0)
We recommend updating regularly for new features and bug fixes: https://supabase.com/docs/guides/cli/getting-started#updating-the-supabase-cli
`;

function runParserSelfTest(): void {
  const parsed = extractJsonCell<{ ok: boolean; message: string }>(
    SUPABASE_CLI_BOX_TABLE_SAMPLE,
    'result',
    {
      label: 'parser self-test',
      stdout: SUPABASE_CLI_BOX_TABLE_SAMPLE,
      stderr: '',
      exitCode: 0,
      columnName: 'result',
    },
  );

  if (!parsed || parsed.ok !== true || parsed.message !== 'hello') {
    throw new Error('Supabase CLI parser self-test failed for box-table output');
  }
}

async function queryResultJson<T>(sql: string, label: string): Promise<T> {
  const { stdout, stderr, exitCode } = await runSupabaseQuery(sql);

  if (exitCode !== 0) {
    throw new SupabaseQueryParseError(
      formatParseDiagnostics({
        label,
        stdout,
        stderr,
        exitCode,
        columnName: 'result',
      }),
      { label, stdout, stderr, exitCode, columnName: 'result' },
    );
  }

  if (/^ERROR:/im.test(stdout) && !stdout.includes('│') && parseJsonRows(stdout).length === 0) {
    throw new SupabaseQueryParseError(
      formatParseDiagnostics({
        label,
        stdout,
        stderr,
        exitCode,
        columnName: 'result',
      }),
      { label, stdout, stderr, exitCode, columnName: 'result' },
    );
  }

  return extractJsonCell<T>(stdout, 'result', {
    label,
    stdout,
    stderr,
    exitCode,
    columnName: 'result',
  });
}

function coerceExistsFlag(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return value.toLowerCase() === 'true';
  }

  return false;
}

function formatQueryError(error: unknown): string {
  if (error instanceof SupabaseQueryParseError) {
    return error.message;
  }

  return String(error);
}

async function verifyLocalSchema(rows: CheckRow[]): Promise<void> {
  const sql = `
    select json_build_object(
      'tables', (
        select coalesce(json_object_agg(table_name, exists_flag), '{}'::json)
        from (
          select t.table_name,
            exists (
              select 1
              from information_schema.tables ist
              where ist.table_schema = 'public'
                and ist.table_name = t.table_name
            ) as exists_flag
          from (values ${REQUIRED_TABLES.map((name) => `('${name}')`).join(', ')}) as t(table_name)
        ) s
      ),
      'rpcs', (
        select coalesce(json_object_agg(rpc_name, exists_flag), '{}'::json)
        from (
          select r.rpc_name,
            exists (
              select 1
              from pg_proc p
              join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public'
                and p.proname::text = r.rpc_name
            ) as exists_flag
          from (values ${REQUIRED_RPCS.map((name) => `('${name}')`).join(', ')}) as r(rpc_name)
        ) s
      )
    )::text as result;
  `;

  try {
    const payload = await queryResultJson<{
      tables: Record<string, boolean>;
      rpcs: Record<string, boolean>;
    }>(sql, 'verifyLocalSchema');

    for (const tableName of REQUIRED_TABLES) {
      const exists = Boolean(payload.tables?.[tableName]);
      addRow(
        rows,
        `table public.${tableName}`,
        'exists',
        exists ? 'exists' : 'missing',
        exists ? 'PASS' : 'FAIL',
      );
    }

    for (const rpcName of REQUIRED_RPCS) {
      const exists = Boolean(payload.rpcs?.[rpcName]);
      addRow(
        rows,
        `rpc public.${rpcName}`,
        'exists',
        exists ? 'exists' : 'missing',
        exists ? 'PASS' : 'FAIL',
      );
    }
  } catch (error) {
    addRow(
      rows,
      'local DB schema verification',
      'tables + RPCs present',
      'query failed',
      'FAIL',
      true,
    );
    addRow(rows, 'local DB schema error', 'n/a', formatQueryError(error), 'FAIL', false);
  }
}

async function verifyFixtureCompatibility(rows: CheckRow[], expoUrl: string | undefined): Promise<void> {
  if (!existsSync(FIXTURES_PATH)) {
    addRow(
      rows,
      'qa/fixtures.json',
      'optional for QA',
      'missing (run npm run qa:seed)',
      'WARN',
      false,
    );
    return;
  }

  let fixtures: QaFixtures;
  try {
    fixtures = JSON.parse(readFileSync(FIXTURES_PATH, 'utf8')) as QaFixtures;
  } catch {
    addRow(rows, 'qa/fixtures.json', 'valid JSON', 'parse error', 'FAIL');
    return;
  }

  if (!expoUrl || !isLocalHost(expoUrl)) {
    addRow(
      rows,
      'fixtures + Expo Supabase URL',
      'local Supabase',
      maskUrl(expoUrl),
      'FAIL',
    );
    addRow(rows, 'fixtures fix', LOCAL_ENV_FIX, 'paste in shell', 'FAIL', false);
    return;
  }

  addRow(rows, 'fixtures + Expo Supabase URL', 'local Supabase', maskUrl(expoUrl), 'PASS');

  if (!fixtures.event_id) {
    addRow(rows, 'fixtures event_id', 'present', 'missing', 'FAIL');
    return;
  }

  try {
    const eventSql = `
      select exists(
        select 1 from public.events where id = '${fixtures.event_id.replace(/'/g, "''")}'::uuid
      )::text as result;
    `;
    const eventExists = coerceExistsFlag(
      await queryResultJson(eventSql, 'fixturesEventId'),
    );

    addRow(
      rows,
      'fixtures event_id in local DB',
      fixtures.event_id.slice(0, 8) + '...',
      eventExists ? 'found' : 'missing',
      eventExists ? 'PASS' : 'WARN',
      false,
    );

    if (!eventExists) {
      addRow(rows, 'fixtures reseed', 'npm run qa:seed', 'recommended', 'WARN', false);
    }

    if (fixtures.paid_order_token) {
      const orderSql = `
        select exists(
          select 1
          from public.orders
          where public_access_token = '${fixtures.paid_order_token.replace(/'/g, "''")}'
        )::text as result;
      `;
      const orderExists = coerceExistsFlag(
        await queryResultJson(orderSql, 'fixturesPaidOrderToken'),
      );

      addRow(
        rows,
        'fixtures paid_order_token in local DB',
        'resolves',
        orderExists ? 'found' : 'missing',
        orderExists ? 'PASS' : 'WARN',
        false,
      );

      if (!orderExists) {
        addRow(rows, 'fixtures reseed', 'npm run qa:seed', 'recommended', 'WARN', false);
      }
    }
  } catch (error) {
    addRow(rows, 'fixtures DB verification', 'local rows present', 'query failed', 'WARN', false);
    addRow(rows, 'fixtures DB error', 'n/a', formatQueryError(error), 'WARN', false);
  }
}

function verifyAppleWalletEnv(rows: CheckRow[], functionsEnv: Record<string, string>, mode: Mode): void {
  const missing = APPLE_WALLET_ENV_KEYS.filter((key) => isPlaceholder(resolveEnv(key, functionsEnv)));
  const presentCount = APPLE_WALLET_ENV_KEYS.length - missing.length;

  if (missing.length === 0) {
    addRow(
      rows,
      'Apple Wallet env',
      'all 6 APPLE_* secrets',
      'complete (values masked)',
      'PASS',
      false,
    );
    return;
  }

  const actual = `${presentCount}/${APPLE_WALLET_ENV_KEYS.length} set`;
  const message =
    mode === 'local'
      ? 'optional for local smoke'
      : 'optional unless Wallet launch enabled';

  addRow(rows, 'Apple Wallet env', '6 APPLE_* secrets', actual, 'WARN', false);
  addRow(rows, 'Apple Wallet note', message, `missing: ${missing.join(', ')}`, 'WARN', false);
}

function printTable(rows: CheckRow[], mode: Mode): void {
  console.log(`808Tix environment readiness (${mode})\n`);
  console.log(`${'Check'.padEnd(36)} ${'Expected'.padEnd(22)} ${'Actual'.padEnd(22)} Result`);
  console.log('-'.repeat(92));

  for (const row of rows) {
    console.log(
      `${row.check.padEnd(36)} ${row.expected.padEnd(22)} ${row.actual.padEnd(22)} ${row.result}`,
    );
  }
}

async function runLocalChecks(rows: CheckRow[], functionsEnv: Record<string, string>): Promise<void> {
  const allowRemote = process.env.CHECK_ENV_ALLOW_REMOTE === 'true';
  const allowLiveStripe = process.env.CHECK_ENV_ALLOW_LIVE_STRIPE === 'true';

  let statusEnv: Record<string, string> = {};
  try {
    const { stdout } = await execFileAsync('supabase', ['status', '-o', 'env'], {
      cwd: ROOT,
      maxBuffer: 10 * 1024 * 1024,
    });
    statusEnv = parseStatusEnv(stdout);
    addRow(rows, 'supabase status', 'running', 'ok', 'PASS');
  } catch (error) {
    addRow(rows, 'supabase status', 'running', 'not running', 'FAIL');
    addRow(rows, 'supabase start', 'supabase start', String(error), 'FAIL', false);
    return;
  }

  const apiUrl = statusEnv.API_URL?.trim();
  const anonKey = statusEnv.ANON_KEY?.trim();
  const serviceRoleKey = statusEnv.SERVICE_ROLE_KEY?.trim();

  addRow(
    rows,
    'Supabase API_URL',
    '127.0.0.1 or localhost',
    maskUrl(apiUrl),
    apiUrl && isLocalHost(apiUrl) ? 'PASS' : 'FAIL',
  );

  addRow(
    rows,
    'Supabase ANON_KEY',
    'present',
    anonKey ? '(set)' : '(missing)',
    anonKey ? 'PASS' : 'FAIL',
  );

  addRow(
    rows,
    'Supabase SERVICE_ROLE_KEY',
    'present (not printed)',
    serviceRoleKey ? '(set)' : '(missing)',
    serviceRoleKey ? 'PASS' : 'FAIL',
  );

  const expoUrl = resolveEnv('EXPO_PUBLIC_SUPABASE_URL', functionsEnv);
  const expoAnon = resolveEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', functionsEnv);

  addRow(
    rows,
    'EXPO_PUBLIC_SUPABASE_URL',
    allowRemote ? 'set' : 'local host',
    maskUrl(expoUrl),
    expoUrl ? (allowRemote || isLocalHost(expoUrl) ? 'PASS' : 'FAIL') : 'FAIL',
  );

  if (expoUrl && !allowRemote && !isLocalHost(expoUrl)) {
    addRow(rows, 'Expo env fix', LOCAL_ENV_FIX, 'paste in shell', 'FAIL', false);
  }

  addRow(
    rows,
    'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    'present',
    expoAnon ? '(set)' : '(missing)',
    expoAnon ? 'PASS' : 'FAIL',
  );

  await verifyLocalSchema(rows);
  await verifyFixtureCompatibility(rows, expoUrl);

  const stripeSecret = resolveEnv('STRIPE_SECRET_KEY', functionsEnv);
  if (!stripeSecret || isPlaceholder(stripeSecret)) {
    addRow(
      rows,
      'STRIPE_SECRET_KEY',
      'sk_test_* (required for smoke:payments:preview)',
      '(missing)',
      'FAIL',
    );
  } else if (stripeSecret.startsWith('sk_live_') && !allowLiveStripe) {
    addRow(
      rows,
      'STRIPE_SECRET_KEY',
      'sk_test_* in local mode',
      maskStripeKey(stripeSecret),
      'FAIL',
    );
    addRow(
      rows,
      'live Stripe override',
      'CHECK_ENV_ALLOW_LIVE_STRIPE=true',
      'not set',
      'FAIL',
      false,
    );
  } else {
    addRow(rows, 'STRIPE_SECRET_KEY', 'sk_test_* or allowed live', maskStripeKey(stripeSecret), 'PASS');
  }

  const webhookSecret = resolveEnv('STRIPE_WEBHOOK_SECRET', functionsEnv);
  if (!webhookSecret || isPlaceholder(webhookSecret)) {
    addRow(
      rows,
      'STRIPE_WEBHOOK_SECRET',
      'whsec_* or stripe listen capture',
      '(missing)',
      'WARN',
      false,
    );
  } else if (!webhookSecret.startsWith('whsec_')) {
    addRow(rows, 'STRIPE_WEBHOOK_SECRET', 'whsec_* prefix', maskWhsec(webhookSecret), 'WARN', false);
  } else {
    addRow(rows, 'STRIPE_WEBHOOK_SECRET', 'whsec_*', maskWhsec(webhookSecret), 'PASS', false);
  }

  const publicSiteUrl = resolveEnv('PUBLIC_SITE_URL', functionsEnv);
  addRow(
    rows,
    'PUBLIC_SITE_URL',
    allowRemote ? 'set' : 'localhost',
    maskUrl(publicSiteUrl),
    publicSiteUrl
      ? allowRemote || isLocalHost(publicSiteUrl)
        ? 'PASS'
        : 'WARN'
      : 'WARN',
    false,
  );

  const emailMode = resolveEnv('EMAIL_DELIVERY_MODE', functionsEnv) ?? 'preview';
  const emailFrom = resolveEnv('EMAIL_FROM', functionsEnv);
  const resendKey = resolveEnv('RESEND_API_KEY', functionsEnv);
  const emailOverride = resolveEnv('EMAIL_OVERRIDE_TO', functionsEnv);

  if (emailMode === 'send') {
    addRow(rows, 'EMAIL_DELIVERY_MODE', 'send', 'send', 'PASS', false);
    addRow(
      rows,
      'EMAIL_FROM',
      'present for send mode',
      maskSecretPresent(emailFrom),
      emailFrom && !isPlaceholder(emailFrom) ? 'PASS' : 'FAIL',
    );
    addRow(
      rows,
      'RESEND_API_KEY',
      'present for send mode',
      maskSecretPresent(resendKey),
      resendKey && !isPlaceholder(resendKey) ? 'PASS' : 'FAIL',
    );
  } else {
    addRow(
      rows,
      'EMAIL_DELIVERY_MODE',
      'preview or unset',
      emailMode,
      emailMode === 'preview' || !resolveEnv('EMAIL_DELIVERY_MODE', functionsEnv) ? 'PASS' : 'WARN',
      false,
    );
    addRow(rows, 'EMAIL_FROM', 'optional in preview', maskSecretPresent(emailFrom), 'PASS', false);
    addRow(rows, 'RESEND_API_KEY', 'optional in preview', maskSecretPresent(resendKey), 'PASS', false);
  }

  addRow(
    rows,
    'EMAIL_OVERRIDE_TO',
    'recommended local preview',
    emailOverride ?? '(unset — smoke defaults preview@example.test)',
    emailOverride ? 'PASS' : 'WARN',
    false,
  );

  verifyAppleWalletEnv(rows, functionsEnv, 'local');
}

function runRemoteEnvChecks(
  rows: CheckRow[],
  functionsEnv: Record<string, string>,
  mode: 'preview' | 'production',
): void {
  const allowTestStripeInProd = process.env.CHECK_ENV_ALLOW_TEST_STRIPE_IN_PRODUCTION === 'true';
  const allowLiveStripe = process.env.CHECK_ENV_ALLOW_LIVE_STRIPE === 'true';

  addRow(
    rows,
    'remote DB verification',
    'optional',
    'REMOTE DB verification not performed; env-only checks completed.',
    'WARN',
    false,
  );

  const expoUrl = resolveEnv('EXPO_PUBLIC_SUPABASE_URL', functionsEnv);
  const expoAnon = resolveEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', functionsEnv);

  addRow(
    rows,
    'EXPO_PUBLIC_SUPABASE_URL',
    'hosted (not localhost)',
    maskUrl(expoUrl),
    expoUrl && !isLocalHost(expoUrl) ? 'PASS' : 'FAIL',
  );

  addRow(
    rows,
    'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    'present',
    expoAnon ? '(set)' : '(missing)',
    expoAnon ? 'PASS' : 'FAIL',
  );

  const publicSiteUrl = resolveEnv('PUBLIC_SITE_URL', functionsEnv);
  addRow(
    rows,
    'PUBLIC_SITE_URL',
    'hosted (not localhost)',
    maskUrl(publicSiteUrl),
    publicSiteUrl && !isLocalHost(publicSiteUrl) ? 'PASS' : 'FAIL',
  );

  const stripeSecret = resolveEnv('STRIPE_SECRET_KEY', functionsEnv);
  addRow(
    rows,
    'STRIPE_SECRET_KEY',
    'present',
    maskStripeKey(stripeSecret),
    stripeSecret && !isPlaceholder(stripeSecret) ? 'PASS' : 'FAIL',
  );

  if (stripeSecret && !isPlaceholder(stripeSecret)) {
    if (mode === 'production' && stripeSecret.startsWith('sk_test_') && !allowTestStripeInProd) {
      addRow(
        rows,
        'STRIPE_SECRET_KEY mode',
        'sk_live_* in production',
        maskStripeKey(stripeSecret),
        'FAIL',
      );
      addRow(
        rows,
        'test Stripe override',
        'CHECK_ENV_ALLOW_TEST_STRIPE_IN_PRODUCTION=true',
        'not set',
        'FAIL',
        false,
      );
    } else if (mode === 'preview' && stripeSecret.startsWith('sk_live_') && !allowLiveStripe) {
      addRow(
        rows,
        'STRIPE_SECRET_KEY mode',
        'sk_test_* or explicit live allow',
        maskStripeKey(stripeSecret),
        'WARN',
        false,
      );
    } else {
      addRow(rows, 'STRIPE_SECRET_KEY mode', 'appropriate for mode', maskStripeKey(stripeSecret), 'PASS', false);
    }
  }

  const webhookSecret = resolveEnv('STRIPE_WEBHOOK_SECRET', functionsEnv);
  if (!webhookSecret || isPlaceholder(webhookSecret)) {
    addRow(rows, 'STRIPE_WEBHOOK_SECRET', 'whsec_* required', '(missing)', 'FAIL');
  } else if (!webhookSecret.startsWith('whsec_')) {
    addRow(rows, 'STRIPE_WEBHOOK_SECRET', 'whsec_* prefix', maskWhsec(webhookSecret), 'FAIL');
  } else {
    addRow(rows, 'STRIPE_WEBHOOK_SECRET', 'whsec_*', maskWhsec(webhookSecret), 'PASS');
  }

  const emailMode = resolveEnv('EMAIL_DELIVERY_MODE', functionsEnv);
  addRow(
    rows,
    'EMAIL_DELIVERY_MODE',
    'present',
    emailMode ?? '(missing)',
    emailMode ? 'PASS' : 'FAIL',
  );

  const emailFrom = resolveEnv('EMAIL_FROM', functionsEnv);
  const resendKey = resolveEnv('RESEND_API_KEY', functionsEnv);

  if (emailMode === 'send') {
    addRow(
      rows,
      'EMAIL_FROM',
      'present for send mode',
      maskSecretPresent(emailFrom),
      emailFrom && !isPlaceholder(emailFrom) ? 'PASS' : 'FAIL',
    );
    addRow(
      rows,
      'RESEND_API_KEY',
      'present for send mode',
      maskSecretPresent(resendKey),
      resendKey && !isPlaceholder(resendKey) ? 'PASS' : 'FAIL',
    );
  } else if (emailMode === 'preview') {
    addRow(rows, 'EMAIL_FROM', 'optional in preview', maskSecretPresent(emailFrom), 'PASS', false);
    addRow(rows, 'RESEND_API_KEY', 'optional in preview', maskSecretPresent(resendKey), 'PASS', false);
  }

  verifyAppleWalletEnv(rows, functionsEnv, mode);
}

async function main(): Promise<void> {
  runParserSelfTest();
  hydrateEnvFromDotEnv();
  const functionsEnv = parseEnvFile(FUNCTIONS_ENV_PATH);
  const mode = parseMode();
  const rows: CheckRow[] = [];

  if (mode === 'local') {
    await runLocalChecks(rows, functionsEnv);
  } else {
    runRemoteEnvChecks(rows, functionsEnv, mode);
  }

  printTable(rows, mode);

  const failures = rows.filter((row) => row.result === 'FAIL' && row.required);
  if (failures.length > 0) {
    console.error(`\nFAIL: ${failures.length} required environment check(s) failed.`);
    process.exit(1);
  }

  console.log(`\nPASS: environment readiness checks completed (${mode}).`);
}

main().catch((error) => {
  console.error('\nFAIL: check-env error:', error);
  process.exit(1);
});
