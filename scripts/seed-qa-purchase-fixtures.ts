#!/usr/bin/env npx tsx
/**
 * Deterministic local QA purchase fixtures (no Stripe, no email, no SMS).
 *
 * Usage:
 *   npm run qa:seed
 *
 * Writes qa/fixtures.json for npm run qa:web.
 */
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const FIXTURES_PATH = join(ROOT, 'qa/fixtures.json');

const QA_ORGANIZER_ID = 'a1000001-0000-4000-8000-000000000001';
const QA_ORGANIZER_EMAIL = 'qa@808tix.test';
const QA_ORGANIZER_PASSWORD = 'qa';
const QA_EVENT_ID = 'a1000001-0000-4000-8000-000000000002';
const QA_TICKET_TYPE_ID = 'a1000001-0000-4000-8000-000000000003';
const QA_EVENT_SLUG = 'qa-paid-event';
const QA_PENDING_BUYER_EMAIL = 'qa-buyer-pending@808tix.test';
const QA_PAID_BUYER_EMAIL = 'qa-buyer-paid@808tix.test';
const TICKET_PRICE_CENTS = 2500;
const PAID_QUANTITY = 2;
const PENDING_QUANTITY = 1;

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

type QaFixtures = {
  event_id: string;
  ticket_type_id: string;
  pending_order_token: string;
  paid_order_token: string;
  pass_tokens: string[];
  created_at: string;
};

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

  const allowRemote = process.env.QA_SEED_ALLOW_REMOTE === 'true';
  if (!isLocalSupabaseUrl(apiUrl) && !allowRemote) {
    throw new Error(
      `Refusing to seed non-local Supabase URL: ${apiUrl}\n` +
        'This script is local-only. Set QA_SEED_ALLOW_REMOTE=true to override (not recommended).',
    );
  }

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
  await queryResultJson<{ event_id: string }>(`
    insert into public.events (
      id,
      organizer_id,
      slug,
      name,
      venue_name,
      event_date,
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
      (timezone('utc', now()) + interval '30 days')::date,
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
      event_date = excluded.event_date,
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
  await queryResultJson<{ ticket_type_id: string }>(`
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

async function cleanupPreviousQaOrders(): Promise<void> {
  const cleanupStatements = [
    `delete from public.passes where order_id in (select id from public.orders where event_id = ${sqlLiteral(QA_EVENT_ID)}::uuid and buyer_email in (${sqlLiteral(QA_PENDING_BUYER_EMAIL)}, ${sqlLiteral(QA_PAID_BUYER_EMAIL)}));`,
    `delete from public.payments where order_id in (select id from public.orders where event_id = ${sqlLiteral(QA_EVENT_ID)}::uuid and buyer_email in (${sqlLiteral(QA_PENDING_BUYER_EMAIL)}, ${sqlLiteral(QA_PAID_BUYER_EMAIL)}));`,
    `delete from public.organizer_payouts where order_id in (select id from public.orders where event_id = ${sqlLiteral(QA_EVENT_ID)}::uuid and buyer_email in (${sqlLiteral(QA_PENDING_BUYER_EMAIL)}, ${sqlLiteral(QA_PAID_BUYER_EMAIL)}));`,
    `delete from public.order_items where order_id in (select id from public.orders where event_id = ${sqlLiteral(QA_EVENT_ID)}::uuid and buyer_email in (${sqlLiteral(QA_PENDING_BUYER_EMAIL)}, ${sqlLiteral(QA_PAID_BUYER_EMAIL)}));`,
    `delete from public.orders where event_id = ${sqlLiteral(QA_EVENT_ID)}::uuid and buyer_email in (${sqlLiteral(QA_PENDING_BUYER_EMAIL)}, ${sqlLiteral(QA_PAID_BUYER_EMAIL)});`,
  ];

  for (const statement of cleanupStatements) {
    await runSupabaseStatement(statement, 'cleanupPreviousQaOrders');
  }
}

async function createCheckoutOpenOrder(): Promise<CreatePendingOrderResult> {
  const created = await queryResultJson<CreatePendingOrderResult>(
    `
    select public.create_pending_order(
      ${sqlLiteral(QA_EVENT_ID)}::uuid,
      ${sqlLiteral(QA_PENDING_BUYER_EMAIL)},
      ${sqlLiteral(QA_TICKET_TYPE_ID)}::uuid,
      ${PENDING_QUANTITY},
      'QA Pending Buyer',
      '8085550101'
    )::text as result;
  `,
    'createCheckoutOpenOrder',
  );

  await runSupabaseStatement(
    `
    update public.orders
    set status = 'checkout_open'
    where id = ${sqlLiteral(created.order_id)}::uuid;
  `,
    'markCheckoutOpenOrder',
  );

  return {
    ...created,
    status: 'checkout_open',
  };
}

async function createAndFulfillPaidOrder(): Promise<{
  order: CreatePendingOrderResult;
  fulfill: FulfillPaidOrderResult;
}> {
  const created = await queryResultJson<CreatePendingOrderResult>(
    `
    select public.create_pending_order(
      ${sqlLiteral(QA_EVENT_ID)}::uuid,
      ${sqlLiteral(QA_PAID_BUYER_EMAIL)},
      ${sqlLiteral(QA_TICKET_TYPE_ID)}::uuid,
      ${PAID_QUANTITY},
      'QA Paid Buyer',
      '8085550102'
    )::text as result;
  `,
    'createPaidPendingOrder',
  );

  const fulfill = await queryResultJson<FulfillPaidOrderResult>(
    `
    select public.fulfill_paid_order(
      ${sqlLiteral(created.order_id)}::uuid,
      ${created.total_cents},
      'usd',
      'cs_test_qa_seed',
      'pi_test_qa_seed',
      'ch_test_qa_seed'
    )::text as result;
  `,
    'fulfillPaidOrder',
  );

  return { order: created, fulfill };
}

function writeFixtures(fixtures: QaFixtures): void {
  mkdirSync(join(ROOT, 'qa'), { recursive: true });
  writeFileSync(FIXTURES_PATH, `${JSON.stringify(fixtures, null, 2)}\n`, 'utf8');
}

async function main(): Promise<void> {
  console.log('808Tix QA purchase fixture seed (local only)\n');

  runParserSelfTest();

  await assertLocalSupabase();
  await bootstrapOrganizer();
  await upsertPaidEvent();
  await upsertTicketType();
  await cleanupPreviousQaOrders();

  const pendingOrder = await createCheckoutOpenOrder();
  const paid = await createAndFulfillPaidOrder();

  const passTokens = paid.fulfill.passes
    .slice()
    .sort((a, b) => a.sequence - b.sequence)
    .map((pass) => pass.secure_token)
    .filter((token) => token.trim().length > 0);

  if (passTokens.length !== PAID_QUANTITY) {
    throw new Error(`Expected ${PAID_QUANTITY} paid passes, got ${passTokens.length}`);
  }

  const fixtures: QaFixtures = {
    event_id: QA_EVENT_ID,
    ticket_type_id: QA_TICKET_TYPE_ID,
    pending_order_token: pendingOrder.public_access_token,
    paid_order_token: paid.order.public_access_token,
    pass_tokens: passTokens,
    created_at: new Date().toISOString(),
  };

  writeFixtures(fixtures);

  console.log('\nQA fixtures seeded successfully.\n');
  console.log(`event_id:            ${fixtures.event_id}`);
  console.log(`ticket_type_id:      ${fixtures.ticket_type_id}`);
  console.log(`pending_order_token: ${fixtures.pending_order_token}`);
  console.log(`paid_order_token:    ${fixtures.paid_order_token}`);
  console.log(`pass_tokens:         ${fixtures.pass_tokens.join(', ')}`);
  console.log(`\nWrote ${FIXTURES_PATH}`);
  console.log('\nNext: npm run qa:web');
}

main().catch((error) => {
  if (error instanceof SupabaseQueryParseError) {
    console.error(`\nFAIL: qa seed error:\n${error.message}`);
  } else {
    console.error('\nFAIL: qa seed error:', error);
  }
  process.exit(1);
});
