#!/usr/bin/env npx tsx
/**
 * Local-only fresh paid order for real email smoke.
 *
 * Creates a paid order via create_pending_order + fulfill_paid_order.
 * Does not call send-order-confirmation-email, Stripe Checkout, or webhooks.
 * Does not create outbound_messages rows.
 *
 * Usage:
 *   npm run seed:email-smoke-order
 *
 * Then:
 *   EMAIL_SMOKE_ORDER_TOKEN="..." \
 *   EMAIL_OVERRIDE_TO="you@yourdomain.com" \
 *   RESEND_API_KEY="re_..." \
 *   EMAIL_FROM='808Tickets <tickets@your-verified-domain.com>' \
 *   PUBLIC_SITE_URL=http://localhost:8081 \
 *   npm run smoke:email:send
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();

/** Reuse deterministic QA event/ticket type from qa:seed. */
const QA_ORGANIZER_ID = 'a1000001-0000-4000-8000-000000000001';
const QA_ORGANIZER_EMAIL = 'qa@808tix.test';
const QA_ORGANIZER_PASSWORD = 'qa';
const QA_EVENT_ID = 'a1000001-0000-4000-8000-000000000002';
const QA_TICKET_TYPE_ID = 'a1000001-0000-4000-8000-000000000003';
const QA_EVENT_SLUG = 'qa-paid-event';

/** Isolated buyer — only this helper's orders are cleaned/recreated. */
const EMAIL_SMOKE_BUYER_EMAIL = 'qa-email-smoke@808tix.test';
const EMAIL_SMOKE_BUYER_NAME = 'QA Email Smoke Buyer';
const EMAIL_SMOKE_BUYER_PHONE = '8085550199';
const TICKET_PRICE_CENTS = 2500;
const PAID_QUANTITY = 1;

type CreatePendingOrderResult = {
  order_id: string;
  public_access_token: string;
  status: string;
  total_cents: number;
};

type FulfillPaidOrderResult = {
  order_id: string;
  status: string;
  pass_count: number;
  passes: Array<{ secure_token: string; sequence: number }>;
};

type CheckResult = 'PASS' | 'FAIL' | 'WARN';

type CheckRow = {
  check: string;
  expected: string;
  actual: string;
  result: CheckResult;
};

const checkRows: CheckRow[] = [];

function addCheck(check: string, expected: string, actual: string, result: CheckResult): void {
  checkRows.push({ check, expected, actual, result });
}

function printChecks(): void {
  const checkWidth = Math.max(5, ...checkRows.map((row) => row.check.length));
  const expectedWidth = Math.max(8, ...checkRows.map((row) => row.expected.length));
  const actualWidth = Math.max(6, ...checkRows.map((row) => row.actual.length));

  console.log(
    `${'Check'.padEnd(checkWidth)} | ${'Expected'.padEnd(expectedWidth)} | ${'Actual'.padEnd(actualWidth)} | Result`,
  );
  console.log(
    `${'-'.repeat(checkWidth)}-+-${'-'.repeat(expectedWidth)}-+-${'-'.repeat(actualWidth)}-+-------`,
  );

  for (const row of checkRows) {
    console.log(
      `${row.check.padEnd(checkWidth)} | ${row.expected.padEnd(expectedWidth)} | ${row.actual.padEnd(actualWidth)} | ${row.result}`,
    );
  }
}

function maskToken(token: string): string {
  if (token.length <= 12) {
    return '***';
  }

  return `${token.slice(0, 8)}...`;
}

function sqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
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

async function queryResultJson<T>(sql: string, label?: string): Promise<T> {
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

async function runSupabaseStatement(sql: string, label: string): Promise<void> {
  const { stdout, stderr, exitCode } = await runSupabaseQuery(sql);

  if (exitCode !== 0 || /^ERROR:/im.test(stdout)) {
    throw new SupabaseQueryParseError(
      formatParseDiagnostics({
        label,
        stdout,
        stderr,
        exitCode,
        columnName: '(statement)',
      }),
      { label, stdout, stderr, exitCode, columnName: '(statement)' },
    );
  }
}

function isLocalSupabaseUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === '127.0.0.1' || host === 'localhost';
  } catch {
    return false;
  }
}

async function assertLocalSupabase(): Promise<string> {
  let statusEnv: Record<string, string>;

  try {
    const { stdout } = await execFileAsync('supabase', ['status', '-o', 'env'], {
      cwd: ROOT,
      maxBuffer: 10 * 1024 * 1024,
    });
    statusEnv = parseStatusEnv(stdout);
  } catch (error) {
    throw new Error(`Local Supabase is not running. Run: supabase start\n${String(error)}`);
  }

  const apiUrl = statusEnv.API_URL?.trim();
  if (!apiUrl) {
    throw new Error('API_URL missing from supabase status. Run: supabase start');
  }

  const allowRemote = process.env.EMAIL_SMOKE_ALLOW_REMOTE === 'true';
  if (!isLocalSupabaseUrl(apiUrl) && !allowRemote) {
    throw new Error(
      `Refusing non-local Supabase URL: ${apiUrl}\n` +
        'This script is local-only. Set EMAIL_SMOKE_ALLOW_REMOTE=true to override (not recommended).',
    );
  }

  addCheck(
    'Supabase target',
    'local (127.0.0.1/localhost)',
    apiUrl,
    isLocalSupabaseUrl(apiUrl) || allowRemote ? 'PASS' : 'FAIL',
  );

  console.log(`Using local Supabase: ${apiUrl}`);
  return apiUrl;
}

async function bootstrapOrganizer(): Promise<void> {
  await queryResultJson<{ organizer_id: string }>(
    `
    insert into auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data
    )
    values (
      ${sqlLiteral(QA_ORGANIZER_ID)}::uuid,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      ${sqlLiteral(QA_ORGANIZER_EMAIL)},
      crypt(${sqlLiteral(QA_ORGANIZER_PASSWORD)}, gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb
    )
    on conflict (id) do update
    set
      email = excluded.email,
      encrypted_password = excluded.encrypted_password
    returning json_build_object('organizer_id', id::text)::text as result;
  `,
    'bootstrapOrganizer',
  );

  await runSupabaseStatement(
    `
    insert into public.profiles (id, email)
    values (${sqlLiteral(QA_ORGANIZER_ID)}::uuid, ${sqlLiteral(QA_ORGANIZER_EMAIL)})
    on conflict (id) do update set email = excluded.email;
  `,
    'bootstrapOrganizerProfile',
  );
}

async function upsertPaidEvent(): Promise<void> {
  await queryResultJson<{ event_id: string }>(
    `
    insert into public.events (
      id,
      organizer_id,
      slug,
      name,
      venue_name,
      status,
      capacity,
      ticketing_mode,
      sales_enabled,
      currency,
      platform_fee_bps,
      platform_fee_fixed_cents
    )
    values (
      ${sqlLiteral(QA_EVENT_ID)}::uuid,
      ${sqlLiteral(QA_ORGANIZER_ID)}::uuid,
      ${sqlLiteral(QA_EVENT_SLUG)},
      'QA Paid Event',
      'QA Venue',
      'published',
      300,
      'paid',
      true,
      'usd',
      250,
      99
    )
    on conflict (id) do update
    set
      organizer_id = excluded.organizer_id,
      slug = excluded.slug,
      name = excluded.name,
      venue_name = excluded.venue_name,
      status = excluded.status,
      capacity = excluded.capacity,
      ticketing_mode = excluded.ticketing_mode,
      sales_enabled = excluded.sales_enabled,
      currency = excluded.currency,
      platform_fee_bps = excluded.platform_fee_bps,
      platform_fee_fixed_cents = excluded.platform_fee_fixed_cents
    returning json_build_object('event_id', id::text)::text as result;
  `,
    'upsertPaidEvent',
  );
}

async function upsertTicketType(): Promise<void> {
  await queryResultJson<{ ticket_type_id: string }>(
    `
    insert into public.ticket_types (
      id,
      event_id,
      name,
      price_cents,
      currency,
      capacity,
      is_active,
      sort_order
    )
    values (
      ${sqlLiteral(QA_TICKET_TYPE_ID)}::uuid,
      ${sqlLiteral(QA_EVENT_ID)}::uuid,
      'General Admission',
      ${TICKET_PRICE_CENTS},
      'usd',
      300,
      true,
      0
    )
    on conflict (id) do update
    set
      event_id = excluded.event_id,
      name = excluded.name,
      price_cents = excluded.price_cents,
      currency = excluded.currency,
      capacity = excluded.capacity,
      is_active = excluded.is_active,
      sort_order = excluded.sort_order
    returning json_build_object('ticket_type_id', id::text)::text as result;
  `,
    'upsertTicketType',
  );
}

function emailSmokeOrderFilterSql(): string {
  return `event_id = ${sqlLiteral(QA_EVENT_ID)}::uuid and buyer_email = ${sqlLiteral(EMAIL_SMOKE_BUYER_EMAIL)}`;
}

async function cleanupPreviousEmailSmokeOrders(): Promise<void> {
  const orderFilter = emailSmokeOrderFilterSql();
  const cleanupStatements = [
    `delete from public.outbound_messages where order_id in (select id from public.orders where ${orderFilter});`,
    `delete from public.passes where order_id in (select id from public.orders where ${orderFilter});`,
    `delete from public.payments where order_id in (select id from public.orders where ${orderFilter});`,
    `delete from public.organizer_payouts where order_id in (select id from public.orders where ${orderFilter});`,
    `delete from public.order_items where order_id in (select id from public.orders where ${orderFilter});`,
    `delete from public.orders where ${orderFilter};`,
  ];

  for (const statement of cleanupStatements) {
    await runSupabaseStatement(statement, 'cleanupPreviousEmailSmokeOrders');
  }

  addCheck(
    'Prior email-smoke orders',
    'cleaned (buyer qa-email-smoke@808tix.test only)',
    'deleted',
    'PASS',
  );
}

async function createAndFulfillPaidOrder(): Promise<{
  order: CreatePendingOrderResult;
  fulfill: FulfillPaidOrderResult;
}> {
  const created = await queryResultJson<CreatePendingOrderResult>(
    `
    select public.create_pending_order(
      ${sqlLiteral(QA_EVENT_ID)}::uuid,
      ${sqlLiteral(EMAIL_SMOKE_BUYER_EMAIL)},
      ${sqlLiteral(QA_TICKET_TYPE_ID)}::uuid,
      ${PAID_QUANTITY},
      ${sqlLiteral(EMAIL_SMOKE_BUYER_NAME)},
      ${sqlLiteral(EMAIL_SMOKE_BUYER_PHONE)}
    )::text as result;
  `,
    'createEmailSmokePendingOrder',
  );

  const stamp = Date.now().toString(36);

  const fulfill = await queryResultJson<FulfillPaidOrderResult>(
    `
    select public.fulfill_paid_order(
      ${sqlLiteral(created.order_id)}::uuid,
      ${created.total_cents},
      'usd',
      ${sqlLiteral(`cs_test_email_smoke_${stamp}`)},
      ${sqlLiteral(`pi_test_email_smoke_${stamp}`)},
      ${sqlLiteral(`ch_test_email_smoke_${stamp}`)}
    )::text as result;
  `,
    'fulfillEmailSmokeOrder',
  );

  return { order: created, fulfill };
}

async function verifyOrderReadyForEmailSmoke(orderId: string): Promise<{
  status: string;
  outbound_count: number;
}> {
  return queryResultJson<{ status: string; outbound_count: number }>(
    `
    select json_build_object(
      'status', o.status,
      'outbound_count', (
        select count(*)::int
        from public.outbound_messages om
        where om.order_id = o.id
          and om.message_type = 'order_confirmation'
      )
    )::text as result
    from public.orders o
    where o.id = ${sqlLiteral(orderId)}::uuid;
  `,
    'verifyOrderReadyForEmailSmoke',
  );
}

async function main(): Promise<void> {
  console.log('808Tickets email-smoke paid order seed (local only)\n');

  await assertLocalSupabase();
  await bootstrapOrganizer();
  await upsertPaidEvent();
  await upsertTicketType();
  await cleanupPreviousEmailSmokeOrders();

  const { order, fulfill } = await createAndFulfillPaidOrder();
  const verified = await verifyOrderReadyForEmailSmoke(order.order_id);
  const outboundCount = verified.outbound_count;

  addCheck('Order status', 'paid', verified.status, verified.status === 'paid' ? 'PASS' : 'FAIL');
  addCheck(
    'Passes minted',
    String(PAID_QUANTITY),
    String(fulfill.pass_count),
    fulfill.pass_count === PAID_QUANTITY ? 'PASS' : 'FAIL',
  );
  addCheck(
    'order_confirmation outbound_messages',
    '0 rows',
    String(outboundCount),
    outboundCount === 0 ? 'PASS' : 'FAIL',
  );
  addCheck(
    'public_access_token',
    'present',
    maskToken(order.public_access_token),
    order.public_access_token.trim().length > 0 ? 'PASS' : 'FAIL',
  );

  console.log('');
  printChecks();

  const failed = checkRows.some((row) => row.result === 'FAIL');
  if (failed) {
    throw new Error(
      outboundCount > 0
        ? 'Fresh paid order unexpectedly has an order_confirmation outbound_messages row. Refusing to print EMAIL_SMOKE_ORDER_TOKEN.'
        : 'Email-smoke order seed failed one or more checks.',
    );
  }

  console.log('');
  console.log(`EMAIL_SMOKE_ORDER_TOKEN="${order.public_access_token}"`);
  console.log('');
  console.log('Next:');
  console.log(
    '  EMAIL_SMOKE_ORDER_TOKEN="..." EMAIL_OVERRIDE_TO="..." RESEND_API_KEY="..." EMAIL_FROM="..." PUBLIC_SITE_URL=http://localhost:8081 npm run smoke:email:send',
  );
}

main().catch((error) => {
  console.error(`\nFAIL: seed-email-smoke-order error: ${String(error)}`);
  process.exit(1);
});
