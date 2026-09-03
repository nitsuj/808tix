#!/usr/bin/env npx tsx
/**
 * Local Stripe payments smoke test (test tooling only).
 *
 * Proves: create-checkout-session → Stripe Checkout → stripe-webhook → fulfill_paid_order → paid passes.
 *
 * Recommended one-command path (starts web + functions + stripe listen):
 *   npm run smoke:payments:preview
 *
 * Manual three-terminal fallback (SMOKE_MANUAL_CHECKOUT=true):
 *   A) supabase functions serve create-checkout-session stripe-webhook --env-file ...
 *   B) stripe listen --forward-to http://127.0.0.1:54321/functions/v1/stripe-webhook
 *   C) Expo web on http://127.0.0.1:8081
 */
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const FUNCTIONS_ENV_PATH = join(ROOT, 'supabase/functions/.env');
const ARTIFACT_DIR = join(ROOT, 'qa/artifacts/smoke-payments');
const ARTIFACT_LOG = join(ARTIFACT_DIR, 'latest.log');
const CHECKOUT_FUNCTION_URL = 'http://127.0.0.1:54321/functions/v1/create-checkout-session';
const WEBHOOK_FUNCTION_URL = 'http://127.0.0.1:54321/functions/v1/stripe-webhook';
const GUEST_WEB_ORIGIN = 'http://127.0.0.1:8081';
const SUCCESS_PAGE_URL = `${GUEST_WEB_ORIGIN}/purchase/success`;
const CANCEL_PAGE_URL = `${GUEST_WEB_ORIGIN}/purchase/cancel`;

const SMOKE_ORGANIZER_ID = 'b0000000-0000-4000-8000-000000000001';
const SMOKE_ORGANIZER_EMAIL = 'stripe-smoke-organizer@example.com';
const BUYER_EMAIL = 'testbuyer@example.com';
const TICKET_QUANTITY = 2;
const TICKET_PRICE_CENTS = 2500;
const EXPECTED_SUBTOTAL_CENTS = TICKET_PRICE_CENTS * TICKET_QUANTITY;
const EXPECTED_PLATFORM_FEE_CENTS =
  Math.round((EXPECTED_SUBTOTAL_CENTS * 250) / 10000) + 99 * TICKET_QUANTITY;
const EXPECTED_PROCESSING_FEE_CENTS = (() => {
  const base = EXPECTED_SUBTOTAL_CENTS + EXPECTED_PLATFORM_FEE_CENTS;
  const total = Math.ceil((base + 30) / (1 - 290 / 10000));
  return total - base;
})();
const EXPECTED_TOTAL_CENTS =
  EXPECTED_SUBTOTAL_CENTS + EXPECTED_PLATFORM_FEE_CENTS + EXPECTED_PROCESSING_FEE_CENTS;

const SERVICE_FEE_LABEL = '808Tickets service fee';
const PROCESSING_FEE_LABEL = 'Payment processing fee';

type CheckResult = { ok: boolean; detail?: string };

type CheckoutResponse = {
  ok?: boolean;
  checkout_url?: string;
  checkout_session_id?: string;
  order_public_access_token?: string;
  public_access_token?: string;
  order_token?: string;
  status?: string;
  message?: string;
  code?: string;
};

type OrderRow = {
  order_id: string;
  status: string;
  paid_at: string | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  subtotal_cents: number;
  platform_fee_cents: number;
  processing_fee_cents: number | null;
  total_cents: number;
  organizer_net_cents: number;
  public_access_token: string;
};

type PaymentRow = {
  status: string;
  amount_cents: number;
  currency: string;
};

type PassRow = {
  secure_token: string;
  source: string;
  status: string;
  sequence: number;
  pass_type: string;
  guest_email: string | null;
  price_paid_cents: number | null;
};

type PayoutRow = {
  status: string;
  amount_cents: number;
};

const artifactLines: string[] = [];

function appendArtifact(line: string): void {
  artifactLines.push(line);
}

function flushArtifact(extra?: Record<string, unknown>): void {
  mkdirSync(ARTIFACT_DIR, { recursive: true });
  const payload = {
    written_at: new Date().toISOString(),
    expected_fees: {
      subtotal_cents: EXPECTED_SUBTOTAL_CENTS,
      platform_fee_cents: EXPECTED_PLATFORM_FEE_CENTS,
      processing_fee_cents: EXPECTED_PROCESSING_FEE_CENTS,
      total_cents: EXPECTED_TOTAL_CENTS,
      organizer_net_cents: EXPECTED_SUBTOTAL_CENTS,
    },
    log: artifactLines,
    ...extra,
  };
  writeFileSync(ARTIFACT_LOG, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.error(`Smoke artifact: ${ARTIFACT_LOG}`);
}

function logCheck(label: string, result: CheckResult) {
  const line = `${result.ok ? 'PASS' : 'FAIL'}  ${label}${result.detail ? ` — ${result.detail}` : ''}`;
  console.log(line);
  appendArtifact(line);
}

function failAndExit(message: string, nextAction?: string): never {
  console.error(`\nSmoke test stopped: ${message}`);
  appendArtifact(`FAIL: ${message}`);
  if (nextAction) {
    console.error(`Next action: ${nextAction}`);
    appendArtifact(`Next action: ${nextAction}`);
  }
  flushArtifact({ failed: true, message, nextAction });
  process.exit(1);
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

function sqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function isPlaceholderSecret(value: string | undefined): boolean {
  if (!value?.trim()) {
    return true;
  }
  return value.includes('...') || value === 'sk_test_...' || value === 'whsec_...';
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

function extractSingleCellFromBoxTable(output: string, columnName: string): string | null {
  const { columns, rows } = parseBoxTable(output);
  const columnIndex = columns.findIndex((column) => column === columnName);
  if (columnIndex === -1 || rows.length === 0) {
    return null;
  }
  return rows[0][columnIndex] ?? null;
}

function extractJsonCell<T>(output: string, columnName: string): T {
  const jsonRows = parseJsonRows(output);
  if (jsonRows.length > 0 && columnName in jsonRows[0]) {
    const value = jsonRows[0][columnName];
    if (value === null || value === undefined || value === '' || value === 'null') {
      return null as T;
    }
    if (typeof value === 'string') {
      return JSON.parse(value) as T;
    }
    if (typeof value === 'object') {
      return value as T;
    }
    return value as T;
  }

  const cell = extractSingleCellFromBoxTable(output, columnName);
  if (cell === null || cell === '' || cell === 'null') {
    return null as T;
  }

  return JSON.parse(cell) as T;
}

async function queryResultJson<T>(sql: string): Promise<T> {
  const { stdout, stderr, exitCode } = await runSupabaseQuery(sql);

  if (exitCode !== 0) {
    throw new Error(stderr.trim() || stdout.trim() || `supabase db query failed (exit ${exitCode})`);
  }

  if (/^ERROR:/im.test(stdout) && !stdout.includes('│') && jsonRowsLength(stdout) === 0) {
    throw new Error(stdout.trim());
  }

  return extractJsonCell<T>(stdout, 'result');
}

async function queryJsonCell<T>(sql: string, columnName = 'result'): Promise<T> {
  return queryResultJson<T>(sql);
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

function isDbQueryReachable(output: string): boolean {
  if (/\bok\b/i.test(output) && /\b1\b/.test(output)) {
    return true;
  }

  const { columns, rows } = parseBoxTable(output);
  if (columns.includes('ok') && rows[0]?.[0] === '1') {
    return true;
  }

  const jsonRows = parseJsonRows(output);
  if (jsonRows[0]?.ok === 1 || jsonRows[0]?.ok === '1') {
    return true;
  }

  return false;
}

function jsonRowsLength(output: string): number {
  return parseJsonRows(output).length;
}

function tokenEqualsFetchedOrder(order: OrderRow | null, currentRunOrderPublicAccessToken: string): boolean {
  if (!order) {
    return false;
  }
  return order.public_access_token === currentRunOrderPublicAccessToken;
}

async function fetchExactOrderByToken(
  currentRunOrderPublicAccessToken: string,
): Promise<OrderRow | null> {
  return queryResultJson<OrderRow | null>(`
    select (
      select json_build_object(
        'order_id', o.id::text,
        'status', o.status,
        'paid_at', o.paid_at::text,
        'stripe_checkout_session_id', o.stripe_checkout_session_id,
        'stripe_payment_intent_id', o.stripe_payment_intent_id,
        'subtotal_cents', o.subtotal_cents,
        'platform_fee_cents', o.platform_fee_cents,
        'processing_fee_cents', o.processing_fee_cents,
        'total_cents', o.total_cents,
        'organizer_net_cents', o.organizer_net_cents,
        'public_access_token', o.public_access_token
      )::text
      from public.orders o
      where o.public_access_token = ${sqlLiteral(currentRunOrderPublicAccessToken)}
      limit 1
    ) as result;
  `);
}

async function fetchVerifiedStateForToken(currentRunOrderPublicAccessToken: string): Promise<{
  order: OrderRow | null;
  payment: PaymentRow | null;
  passes: PassRow[];
  payout: PayoutRow | null;
  lookup: Record<string, unknown> | null;
}> {
  const order = await fetchExactOrderByToken(currentRunOrderPublicAccessToken);

  if (!order) {
    return { order: null, payment: null, passes: [], payout: null, lookup: null };
  }

  if (!tokenEqualsFetchedOrder(order, currentRunOrderPublicAccessToken)) {
    throw new Error(
      `Fetched order public_access_token mismatch (expected ${currentRunOrderPublicAccessToken}, got ${order.public_access_token})`,
    );
  }

  const orderIdLiteral = sqlLiteral(order.order_id);

  const payment = await queryResultJson<PaymentRow | null>(`
    select (
      select json_build_object(
        'status', p.status,
        'amount_cents', p.amount_cents,
        'currency', p.currency
      )::text
      from public.payments p
      where p.order_id = ${orderIdLiteral}::uuid
      limit 1
    ) as result;
  `);

  const passes = await queryResultJson<PassRow[]>(`
    select (
      select coalesce(
        json_agg(
          json_build_object(
            'secure_token', p.secure_token,
            'source', p.source,
            'status', p.status,
            'sequence', p.sequence,
            'pass_type', p.pass_type,
            'guest_email', p.guest_email,
            'price_paid_cents', p.price_paid_cents
          )
          order by p.sequence
        )::text,
        '[]'
      )
      from public.passes p
      where p.order_id = ${orderIdLiteral}::uuid
    ) as result;
  `);

  const payout = await queryResultJson<PayoutRow | null>(`
    select (
      select json_build_object(
        'status', op.status,
        'amount_cents', op.amount_cents
      )::text
      from public.organizer_payouts op
      where op.order_id = ${orderIdLiteral}::uuid
      limit 1
    ) as result;
  `);

  const lookup = await queryResultJson<Record<string, unknown>>(`
    select public.get_order_by_public_token(${sqlLiteral(currentRunOrderPublicAccessToken)})::text as result;
  `);

  return {
    order,
    payment,
    passes: passes ?? [],
    payout,
    lookup,
  };
}

async function printVerificationDiagnostics(
  currentRunOrderPublicAccessToken: string,
  checkoutUrl?: string,
): Promise<void> {
  console.error('\n=== Verification diagnostics ===\n');
  console.error(`current_run_order_public_access_token: ${currentRunOrderPublicAccessToken}`);
  if (checkoutUrl) {
    console.error(`checkout_url: ${checkoutUrl}`);
  }

  try {
    const exactOrder = await fetchExactOrderByToken(currentRunOrderPublicAccessToken);
    console.error(`exact order for token: ${JSON.stringify(exactOrder, null, 2)}`);
  } catch (error) {
    console.error(`exact order lookup failed: ${String(error)}`);
  }

  try {
    const recentOrders = await queryResultJson<unknown[]>(`
      select coalesce(
        (
          select json_agg(row_to_json(t))::text
          from (
            select
              id::text as order_id,
              left(public_access_token, 8) || '...' as public_access_token_prefix,
              status,
              paid_at,
              created_at
            from public.orders
            order by created_at desc
            limit 5
          ) t
        ),
        '[]'
      ) as result;
    `);
    console.error(`latest 5 orders (diagnostic): ${JSON.stringify(recentOrders, null, 2)}`);
  } catch (error) {
    console.error(`latest orders diagnostic failed: ${String(error)}`);
  }

  try {
    const paymentEvents = await queryResultJson<unknown[]>(`
      select coalesce(
        (
          select json_agg(row_to_json(t))::text
          from (
            select stripe_event_id, type, processing_status, order_id::text, received_at, processed_at
            from public.payment_events
            order by received_at desc
            limit 10
          ) t
        ),
        '[]'
      ) as result;
    `);
    console.error(`latest 10 payment_events: ${JSON.stringify(paymentEvents, null, 2)}`);
  } catch (error) {
    console.error(`payment_events diagnostic failed: ${String(error)}`);
  }

  try {
    const recentPasses = await queryResultJson<unknown[]>(`
      select coalesce(
        (
          select json_agg(row_to_json(t))::text
          from (
            select
              left(secure_token, 8) || '...' as secure_token_prefix,
              source,
              status,
              sequence,
              order_id::text
            from public.passes
            order by created_at desc
            limit 10
          ) t
        ),
        '[]'
      ) as result;
    `);
    console.error(`latest 10 passes: ${JSON.stringify(recentPasses, null, 2)}`);
  } catch (error) {
    console.error(`passes diagnostic failed: ${String(error)}`);
  }
}

async function runSupabaseStatus(): Promise<Record<string, string>> {
  const { stdout } = await execFileAsync('supabase', ['status', '-o', 'env'], {
    cwd: ROOT,
    maxBuffer: 10 * 1024 * 1024,
  });
  return parseStatusEnv(stdout);
}

async function checkPrerequisites(): Promise<{
  publishableKey: string;
  apiUrl: string;
}> {
  console.log('\n=== Prerequisite checks ===\n');

  let statusEnv: Record<string, string>;
  try {
    statusEnv = await runSupabaseStatus();
    logCheck('supabase status', { ok: true });
  } catch (error) {
    logCheck('supabase status', { ok: false, detail: String(error) });
    failAndExit('Local Supabase is not running.', 'Run: supabase start');
  }

  const apiUrl = statusEnv.API_URL?.trim();
  if (!apiUrl) {
    logCheck('local Supabase Project URL', { ok: false });
    failAndExit('API_URL missing from supabase status.', 'Run: supabase start');
  }
  logCheck('local Supabase Project URL', { ok: true, detail: apiUrl });

  const publishableKey =
    statusEnv.PUBLISHABLE_KEY?.trim() || statusEnv.ANON_KEY?.trim() || '';
  if (!publishableKey) {
    logCheck('local publishable/anon key', { ok: false });
    failAndExit(
      'PUBLISHABLE_KEY and ANON_KEY missing from supabase status.',
      'Run: supabase start',
    );
  }
  logCheck('local publishable/anon key', { ok: true, detail: 'parsed (value hidden)' });

  const dbProbe = await runSupabaseQuery('select 1 as ok;');
  const dbReachable = dbProbe.exitCode === 0 && isDbQueryReachable(dbProbe.stdout);
  logCheck('supabase db query', {
    ok: dbReachable,
    detail: dbReachable ? undefined : dbProbe.stderr.trim() || 'no ok/1 evidence in output',
  });
  if (!dbReachable) {
    failAndExit('Local database query failed.', 'Run: supabase db reset');
  }

  let checkoutGetStatus = 0;
  try {
    const response = await fetch(CHECKOUT_FUNCTION_URL, { method: 'GET' });
    checkoutGetStatus = response.status;
  } catch (error) {
    logCheck('create-checkout-session reachable', {
      ok: false,
      detail: String(error),
    });
    failAndExit(
      'Could not reach create-checkout-session (Edge Functions not serving).',
      'Use one-command: npm run smoke:payments:preview\nOr Terminal A: supabase functions serve create-checkout-session stripe-webhook --env-file supabase/functions/.env',
    );
  }

  const checkoutReachable = checkoutGetStatus === 405;
  logCheck('create-checkout-session reachable (GET → 405)', {
    ok: checkoutReachable,
    detail: `HTTP ${checkoutGetStatus}`,
  });
  if (!checkoutReachable) {
    failAndExit(
      `Unexpected GET status ${checkoutGetStatus} from create-checkout-session (expected 405).`,
      'Ensure Edge Functions are served locally via npm run smoke:payments:preview',
    );
  }

  let webhookGetStatus = 0;
  try {
    const response = await fetch(WEBHOOK_FUNCTION_URL, { method: 'GET' });
    webhookGetStatus = response.status;
  } catch (error) {
    logCheck('stripe-webhook reachable', { ok: false, detail: String(error) });
    failAndExit(
      'Could not reach stripe-webhook (Edge Functions not serving webhook).',
      'Use one-command: npm run smoke:payments:preview\nOr serve both: supabase functions serve create-checkout-session stripe-webhook --env-file ...',
    );
  }

  // Deno serve returns 405 for GET on POST-only handlers (or 400/401 without signature).
  const webhookReachable = webhookGetStatus === 405 || webhookGetStatus === 400 || webhookGetStatus === 401;
  logCheck('stripe-webhook reachable (GET → 405/400/401)', {
    ok: webhookReachable,
    detail: `HTTP ${webhookGetStatus}`,
  });
  if (!webhookReachable) {
    failAndExit(
      `Unexpected GET status ${webhookGetStatus} from stripe-webhook.`,
      'Serve stripe-webhook locally (npm run smoke:payments:preview).',
    );
  }

  let guestWebStatus = 0;
  try {
    const response = await fetch(GUEST_WEB_ORIGIN, { method: 'GET' });
    guestWebStatus = response.status;
  } catch (error) {
    logCheck(`Expo web at redirect origin ${GUEST_WEB_ORIGIN}`, {
      ok: false,
      detail: String(error),
    });
    failAndExit(
      `Expo web is not reachable at ${GUEST_WEB_ORIGIN} (required for Stripe success redirect).`,
      'Use one-command: npm run smoke:payments:preview\nOr: npx expo start --web --port 8081',
    );
  }

  const guestWebOk = guestWebStatus > 0 && guestWebStatus < 500;
  logCheck(`Expo web at redirect origin ${GUEST_WEB_ORIGIN}`, {
    ok: guestWebOk,
    detail: `HTTP ${guestWebStatus}`,
  });
  if (!guestWebOk) {
    failAndExit(
      `Expo web returned HTTP ${guestWebStatus} at ${GUEST_WEB_ORIGIN}.`,
      'Start Expo web on port 8081 before paying (npm run smoke:payments:preview).',
    );
  }

  let successPageStatus = 0;
  try {
    const response = await fetch(`${SUCCESS_PAGE_URL}?order_token=smoke-preflight`, {
      method: 'GET',
    });
    successPageStatus = response.status;
  } catch (error) {
    logCheck('purchase success page reachable', { ok: false, detail: String(error) });
    failAndExit(
      `Could not load ${SUCCESS_PAGE_URL}.`,
      'Ensure Expo web is serving the app on 8081.',
    );
  }

  const successPageOk = successPageStatus > 0 && successPageStatus < 500;
  logCheck('purchase success page reachable', {
    ok: successPageOk,
    detail: `HTTP ${successPageStatus}`,
  });
  if (!successPageOk) {
    failAndExit(
      `Success page returned HTTP ${successPageStatus}.`,
      'Ensure Expo web export/routes include /purchase/success.',
    );
  }

  const feeColumnProbe = await runSupabaseQuery(`
    select platform_fee_cents, processing_fee_cents from public.orders limit 0;
  `);
  const feeColumnsPresent = feeColumnProbe.exitCode === 0 && !/^ERROR:/im.test(feeColumnProbe.stdout + feeColumnProbe.stderr);
  logCheck('orders fee columns present (platform + processing)', {
    ok: feeColumnsPresent,
    detail: feeColumnsPresent
      ? 'platform_fee_cents + processing_fee_cents selectable'
      : feeColumnProbe.stderr.trim() || feeColumnProbe.stdout.trim() || 'column probe failed',
  });
  if (!feeColumnsPresent) {
    failAndExit(
      'Local DB is missing transparent fee columns.',
      'Apply migrations: supabase db reset  (includes 20260824140000_platform_admin_fees_payout_rpcs)',
    );
  }

  const ticketFeesSource = readFileSync(join(ROOT, 'src/lib/ticket-fees.ts'), 'utf8');
  const stripeSharedSource = readFileSync(
    join(ROOT, 'supabase/functions/_shared/stripe.ts'),
    'utf8',
  );
  const labelsOk =
    ticketFeesSource.includes(SERVICE_FEE_LABEL) &&
    ticketFeesSource.includes(PROCESSING_FEE_LABEL) &&
    stripeSharedSource.includes(SERVICE_FEE_LABEL) &&
    stripeSharedSource.includes(PROCESSING_FEE_LABEL);
  logCheck('buyer-facing transparent fee labels in source', {
    ok: labelsOk,
    detail: labelsOk
      ? `"${SERVICE_FEE_LABEL}" + "${PROCESSING_FEE_LABEL}"`
      : 'missing label constants / Stripe line item names',
  });
  if (!labelsOk) {
    failAndExit('Transparent fee labels missing from ticket-fees / Stripe helper sources.');
  }

  const functionsEnv = parseEnvFile(FUNCTIONS_ENV_PATH);
  const stripeSecretValue =
    process.env.STRIPE_SECRET_KEY?.trim() || functionsEnv.STRIPE_SECRET_KEY;
  const webhookSecretValue =
    process.env.STRIPE_WEBHOOK_SECRET?.trim() || functionsEnv.STRIPE_WEBHOOK_SECRET;
  const stripeSecretConfigured = !isPlaceholderSecret(stripeSecretValue);
  const webhookSecretConfigured = !isPlaceholderSecret(webhookSecretValue);

  logCheck('STRIPE_SECRET_KEY for smoke prerequisites', {
    ok: stripeSecretConfigured,
    detail: stripeSecretConfigured
      ? process.env.STRIPE_SECRET_KEY?.trim()
        ? 'present (process env)'
        : 'present (supabase/functions/.env)'
      : 'missing or placeholder',
  });
  logCheck('STRIPE_WEBHOOK_SECRET for smoke prerequisites', {
    ok: webhookSecretConfigured,
    detail: webhookSecretConfigured
      ? process.env.STRIPE_WEBHOOK_SECRET?.trim()
        ? 'present (process env — must match active stripe listen whsec)'
        : 'present (supabase/functions/.env — must match active stripe listen whsec)'
      : 'missing or placeholder',
  });

  if (!stripeSecretConfigured || !webhookSecretConfigured) {
    failAndExit(
      'Stripe function env is incomplete (secret key and/or webhook signing secret).',
      'Preferred: npm run smoke:payments:preview (captures whsec from stripe listen automatically)\nFallback: set sk_test_... + whsec_... from `stripe listen` into supabase/functions/.env',
    );
  }

  // stripe listen must forward to local stripe-webhook (preview orchestrator starts it).
  let stripeListenRunning = false;
  let stripeListenDetail = 'not detected';
  try {
    const { stdout } = await execFileAsync('pgrep', ['-fl', 'stripe listen'], {
      cwd: ROOT,
      maxBuffer: 1024 * 1024,
    });
    stripeListenRunning = /stripe\s+listen/i.test(stdout);
    stripeListenDetail = stripeListenRunning
      ? stdout.trim().split('\n')[0]?.slice(0, 120) || 'process found'
      : 'no matching process';
  } catch {
    stripeListenRunning = false;
    stripeListenDetail = 'pgrep found no stripe listen process';
  }
  logCheck('stripe listen forwarding process', {
    ok: stripeListenRunning,
    detail: stripeListenDetail,
  });
  if (!stripeListenRunning) {
    failAndExit(
      'stripe listen is not running (webhooks will never fulfill paid orders).',
      'Use one-command: npm run smoke:payments:preview\nOr: stripe listen --forward-to http://127.0.0.1:54321/functions/v1/stripe-webhook',
    );
  }

  return {
    publishableKey,
    apiUrl,
  };
}

async function bootstrapOrganizer(): Promise<string> {
  console.log('\n=== Bootstrap smoke organizer ===\n');

  const sql = `
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
      ${sqlLiteral(SMOKE_ORGANIZER_ID)}::uuid,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      ${sqlLiteral(SMOKE_ORGANIZER_EMAIL)},
      crypt('stripe-smoke-local-password', gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb
    )
    on conflict (id) do update
    set email = excluded.email
    returning json_build_object('organizer_id', id::text)::text as result;
  `;

  try {
    const payload = await queryJsonCell<{ organizer_id: string }>(sql);
    const organizerId = payload.organizer_id ?? SMOKE_ORGANIZER_ID;

    const profilePayload = await queryJsonCell<{ id: string | null }>(`
      select json_build_object(
        'id',
        (select id::text from public.profiles where id = ${sqlLiteral(organizerId)}::uuid limit 1)
      )::text as result;
    `);

    if (!profilePayload.id) {
      await runSupabaseQuery(
        `insert into public.profiles (id, email) values (${sqlLiteral(organizerId)}::uuid, ${sqlLiteral(SMOKE_ORGANIZER_EMAIL)}) on conflict (id) do nothing;`,
      );
    }

    console.log(`organizer_id: ${organizerId}`);
    console.log(`organizer_email: ${SMOKE_ORGANIZER_EMAIL}`);
    return organizerId;
  } catch (error) {
    failAndExit(
      `Could not bootstrap auth user/profile: ${String(error)}`,
      'Run: supabase db reset — if this persists, create the organizer manually in Studio Auth and update SMOKE_ORGANIZER_ID in the script.',
    );
  }
}

async function bootstrapPaidEvent(organizerId: string): Promise<{ eventId: string; slug: string }> {
  console.log('\n=== Bootstrap paid event ===\n');

  const slug = `stripe-smoke-${Date.now()}`;

  const payload = await queryJsonCell<{ event_id: string }>(`
    insert into public.events (
      organizer_id,
      slug,
      name,
      venue_name,
      status,
      capacity,
      ticketing_mode,
      sales_enabled,
      currency
    )
    values (
      ${sqlLiteral(organizerId)}::uuid,
      ${sqlLiteral(slug)},
      '808Tix Stripe Smoke Test',
      'Howzit Brewing',
      'published',
      300,
      'paid',
      true,
      'usd'
    )
    returning json_build_object('event_id', id::text)::text as result;
  `);

  const eventId = payload.event_id;
  if (!eventId) {
    failAndExit('Failed to create smoke event.');
  }

  console.log(`event_id: ${eventId}`);
  console.log(`event_slug: ${slug}`);
  return { eventId, slug };
}

async function bootstrapTicketType(eventId: string): Promise<string> {
  console.log('\n=== Bootstrap ticket type ===\n');

  const payload = await queryJsonCell<{ ticket_type_id: string }>(`
    insert into public.ticket_types (
      event_id,
      name,
      price_cents,
      currency,
      capacity,
      is_active,
      sort_order
    )
    values (
      ${sqlLiteral(eventId)}::uuid,
      'General Admission',
      ${TICKET_PRICE_CENTS},
      'usd',
      300,
      true,
      0
    )
    returning json_build_object('ticket_type_id', id::text)::text as result;
  `);

  const ticketTypeId = payload.ticket_type_id;
  if (!ticketTypeId) {
    failAndExit('Failed to create smoke ticket type.');
  }

  console.log(`ticket_type_id: ${ticketTypeId}`);
  return ticketTypeId;
}

async function createCheckoutSession(
  publishableKey: string,
  eventId: string,
  ticketTypeId: string,
): Promise<{ checkout_url: string; checkout_session_id: string; order_public_access_token: string; status: string }> {
  console.log('\n=== Create checkout session ===\n');

  const payload = {
    event_id: eventId,
    ticket_type_id: ticketTypeId,
    quantity: TICKET_QUANTITY,
    buyer_email: BUYER_EMAIL,
    buyer_name: 'Test Buyer',
    buyer_phone: '8085551212',
    // Intentionally untrusted URLs — server must ignore and use PUBLIC_SITE_URL allowlist.
    success_url: 'https://evil.example/steal',
    cancel_url: 'https://evil.example/cancel',
  };

  const response = await fetch(CHECKOUT_FUNCTION_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${publishableKey}`,
      apikey: publishableKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const bodyText = await response.text();
  let body: CheckoutResponse;
  try {
    body = JSON.parse(bodyText) as CheckoutResponse;
  } catch {
    body = { message: bodyText };
  }

  if (
    body.order_public_access_token ||
    body.public_access_token ||
    body.order_token
  ) {
    console.error(bodyText);
    failAndExit('create-checkout-session leaked a pre-payment order token.');
  }

  if (!response.ok || !body.checkout_url || !body.checkout_session_id) {
    console.error(`HTTP ${response.status}`);
    console.error(bodyText);
    console.error('\nDiagnostics:');
    console.error('- Terminal A: functions serve running with STRIPE_SECRET_KEY set?');
    console.error('- Event sales_enabled=true and ticketing_mode=paid?');
    console.error('- stripe listen running in Terminal B with matching STRIPE_WEBHOOK_SECRET?');
    failAndExit('create-checkout-session failed.');
  }

  if (body.status !== 'checkout_open') {
    console.error(`Unexpected status: ${body.status}`);
    failAndExit('create-checkout-session returned unexpected status.');
  }

  const orderLookup = await queryResultJson<{
    public_access_token: string;
    stripe_checkout_session_id: string;
  } | null>(`
    select (
      select json_build_object(
        'public_access_token', o.public_access_token,
        'stripe_checkout_session_id', o.stripe_checkout_session_id
      )::text
      from public.orders o
      where o.stripe_checkout_session_id = ${sqlLiteral(body.checkout_session_id)}
      limit 1
    ) as result;
  `);

  if (!orderLookup?.public_access_token) {
    failAndExit('Could not resolve order public_access_token from checkout_session_id (service-role SQL).');
  }

  console.log(`checkout_url: ${body.checkout_url}`);
  console.log(`checkout_session_id: ${body.checkout_session_id}`);
  console.log(`order_public_access_token: ${orderLookup.public_access_token} (DB lookup; not from API)`);
  console.log(`status: ${body.status}`);

  return {
    checkout_url: body.checkout_url,
    checkout_session_id: body.checkout_session_id,
    order_public_access_token: orderLookup.public_access_token,
    status: body.status ?? 'checkout_open',
  };
}

async function verifyPrePaymentLookup(currentRunOrderPublicAccessToken: string): Promise<void> {
  const lookup = await queryResultJson<Record<string, unknown>>(`
    select public.get_order_by_public_token(${sqlLiteral(currentRunOrderPublicAccessToken)})::text as result;
  `);

  const tickets = lookup?.tickets;
  if (tickets !== null && tickets !== undefined) {
    throw new Error('Pre-payment lookup exposed tickets (expected null).');
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class PostPaymentVerificationError extends Error {
  constructor(
    message: string,
    readonly currentRunOrderPublicAccessToken: string,
    readonly checkoutUrl?: string,
  ) {
    super(message);
  }
}

async function pollExactOrderUntilPaid(
  currentRunOrderPublicAccessToken: string,
  checkoutUrl?: string,
): Promise<{
  order: OrderRow;
  payment: PaymentRow;
  passes: PassRow[];
  payout: PayoutRow;
  lookup: Record<string, unknown>;
}> {
  const deadline = Date.now() + 60_000;
  let lastStatus = 'not found';

  while (Date.now() < deadline) {
    const order = await fetchExactOrderByToken(currentRunOrderPublicAccessToken);

    if (!order) {
      lastStatus = 'not found';
    } else if (!tokenEqualsFetchedOrder(order, currentRunOrderPublicAccessToken)) {
      throw new PostPaymentVerificationError(
        `Order row token mismatch during poll (expected ${currentRunOrderPublicAccessToken}, got ${order.public_access_token})`,
        currentRunOrderPublicAccessToken,
        checkoutUrl,
      );
    } else if (order.status === 'paid') {
      const state = await fetchVerifiedStateForToken(currentRunOrderPublicAccessToken);
      if (!state.order || state.order.status !== 'paid') {
        throw new PostPaymentVerificationError(
          'Order became paid during poll but follow-up fetch did not confirm paid status.',
          currentRunOrderPublicAccessToken,
          checkoutUrl,
        );
      }
      return {
        order: state.order,
        payment: state.payment as PaymentRow,
        passes: state.passes,
        payout: state.payout as PayoutRow,
        lookup: state.lookup ?? {},
      };
    } else {
      lastStatus = order.status;
    }

    await sleep(2000);
  }

  throw new PostPaymentVerificationError(
    lastStatus === 'not found'
      ? `No order exists for current_run_order_public_access_token ${currentRunOrderPublicAccessToken}`
      : `Order for current_run_order_public_access_token remained ${lastStatus} (expected paid within 60s)`,
    currentRunOrderPublicAccessToken,
    checkoutUrl,
  );
}

function assertPostPayment(
  currentRunOrderPublicAccessToken: string,
  state: {
    order: OrderRow;
    payment: PaymentRow;
    passes: PassRow[];
    payout: PayoutRow;
    lookup: Record<string, unknown>;
  },
): string[] {
  const failures: string[] = [];
  const { order, payment, passes, payout, lookup } = state;

  if (order.public_access_token !== currentRunOrderPublicAccessToken) {
    failures.push(
      `order.public_access_token mismatch (expected ${currentRunOrderPublicAccessToken}, got ${order.public_access_token})`,
    );
  }

  if (order.status !== 'paid') {
    failures.push(`order.status expected paid, got ${order.status}`);
  }
  if (!order.paid_at) failures.push('order.paid_at is null');
  if (!order.stripe_checkout_session_id) failures.push('order.stripe_checkout_session_id is null');

  if (Number(order.subtotal_cents) !== EXPECTED_SUBTOTAL_CENTS) {
    failures.push(`order.subtotal_cents expected ${EXPECTED_SUBTOTAL_CENTS}, got ${order.subtotal_cents}`);
  }
  if (Number(order.platform_fee_cents) !== EXPECTED_PLATFORM_FEE_CENTS) {
    failures.push(
      `order.platform_fee_cents expected ${EXPECTED_PLATFORM_FEE_CENTS}, got ${order.platform_fee_cents}`,
    );
  }
  if (Number(order.processing_fee_cents ?? -1) !== EXPECTED_PROCESSING_FEE_CENTS) {
    failures.push(
      `order.processing_fee_cents expected ${EXPECTED_PROCESSING_FEE_CENTS}, got ${order.processing_fee_cents}`,
    );
  }
  if (Number(order.total_cents) !== EXPECTED_TOTAL_CENTS) {
    failures.push(`order.total_cents expected ${EXPECTED_TOTAL_CENTS}, got ${order.total_cents}`);
  }
  if (
    Number(order.total_cents) !==
    Number(order.subtotal_cents) +
      Number(order.platform_fee_cents) +
      Number(order.processing_fee_cents ?? 0)
  ) {
    failures.push('order.total_cents !== subtotal + platform_fee + processing_fee');
  }
  if (Number(order.organizer_net_cents) !== EXPECTED_SUBTOTAL_CENTS) {
    failures.push(
      `order.organizer_net_cents expected ${EXPECTED_SUBTOTAL_CENTS}, got ${order.organizer_net_cents}`,
    );
  }

  if (!payment) failures.push('payment row missing');
  else {
    if (payment.status !== 'succeeded') failures.push(`payment.status expected succeeded, got ${payment.status}`);
    if (Number(payment.amount_cents) !== Number(order.total_cents)) {
      failures.push('payment.amount_cents does not match order.total_cents');
    }
    if (payment.currency !== 'usd') failures.push(`payment.currency expected usd, got ${payment.currency}`);
  }

  if (passes.length !== TICKET_QUANTITY) {
    failures.push(`expected ${TICKET_QUANTITY} passes, got ${passes.length}`);
  }

  const sequences = passes.map((pass) => Number(pass.sequence)).sort((a, b) => a - b);
  if (sequences.join(',') !== '1,2') {
    failures.push(`pass sequences expected 1,2 got ${sequences.join(',')}`);
  }

  for (const pass of passes) {
    if (pass.source !== 'paid') failures.push(`pass ${pass.sequence} source is not paid`);
    if (pass.status !== 'active') failures.push(`pass ${pass.sequence} status is not active`);
    if (!pass.secure_token) failures.push(`pass ${pass.sequence} missing secure_token`);
    if (pass.pass_type !== 'General Admission') failures.push(`pass ${pass.sequence} pass_type mismatch`);
    if (pass.guest_email !== BUYER_EMAIL) failures.push(`pass ${pass.sequence} guest_email mismatch`);
    if (Number(pass.price_paid_cents) !== TICKET_PRICE_CENTS) {
      failures.push(`pass ${pass.sequence} price_paid_cents expected ${TICKET_PRICE_CENTS}`);
    }
  }

  if (!payout) failures.push('organizer_payouts row missing');
  else {
    if (payout.status !== 'pending') failures.push(`payout.status expected pending, got ${payout.status}`);
    if (Number(payout.amount_cents) !== Number(order.organizer_net_cents)) {
      failures.push('payout.amount_cents does not match organizer_net_cents');
    }
    if (Number(payout.amount_cents) !== EXPECTED_SUBTOTAL_CENTS) {
      failures.push(`payout.amount_cents expected ${EXPECTED_SUBTOTAL_CENTS}`);
    }
  }

  if (lookup.status !== 'paid') failures.push('get_order_by_public_token status is not paid');
  if (Number(lookup.ticket_count) !== TICKET_QUANTITY) {
    failures.push(`lookup.ticket_count expected ${TICKET_QUANTITY}`);
  }
  if (Number(lookup.platform_fee_cents) !== EXPECTED_PLATFORM_FEE_CENTS) {
    failures.push('lookup.platform_fee_cents mismatch');
  }
  if (Number(lookup.processing_fee_cents) !== EXPECTED_PROCESSING_FEE_CENTS) {
    failures.push('lookup.processing_fee_cents mismatch');
  }
  if (Number(lookup.total_cents) !== EXPECTED_TOTAL_CENTS) {
    failures.push('lookup.total_cents mismatch');
  }
  const tickets = lookup.tickets;
  if (!Array.isArray(tickets) || tickets.length !== TICKET_QUANTITY) {
    failures.push('lookup.tickets expected 2 entries after payment');
  }

  return failures;
}

async function saveCheckoutArtifacts(
  page: {
    screenshot: (opts: { path: string; fullPage: boolean }) => Promise<unknown>;
    content: () => Promise<string>;
    url: () => string;
  },
  label: string,
): Promise<void> {
  mkdirSync(ARTIFACT_DIR, { recursive: true });
  const shotPath = join(ARTIFACT_DIR, 'checkout-latest.png');
  const htmlPath = join(ARTIFACT_DIR, 'checkout-latest.html');
  await page.screenshot({ path: shotPath, fullPage: true }).catch(() => undefined);
  writeFileSync(htmlPath, await page.content());
  appendArtifact(`${label} url=${page.url()}`);
  appendArtifact(`checkout screenshot: ${shotPath}`);
  appendArtifact(`checkout html: ${htmlPath}`);
}

async function fillFirstMatching(
  // Playwright Page | Frame-compatible locator host
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: any,
  selectors: string[],
  value: string,
): Promise<boolean> {
  for (const selector of selectors) {
    try {
      const loc = page.locator(selector).first();
      if ((await loc.count()) === 0) {
        continue;
      }
      if (!(await loc.isVisible().catch(() => false))) {
        continue;
      }
      await loc.click({ timeout: 5_000 });
      await loc.fill('');
      // Hosted Checkout formats card fields while typing; sequential keys are more reliable than fill().
      if (typeof loc.pressSequentially === 'function') {
        await loc.pressSequentially(value, { delay: 25 });
      } else {
        await loc.fill(value, { timeout: 5_000 });
      }
      return true;
    } catch {
      // try next selector
    }
  }

  for (const frame of page.frames()) {
    for (const selector of selectors) {
      try {
        const loc = frame.locator(selector).first();
        if ((await loc.count()) === 0) {
          continue;
        }
        await loc.fill(value, { timeout: 5_000 });
        return true;
      } catch {
        // try next
      }
    }
  }

  return false;
}

/**
 * Complete hosted Stripe Checkout with test card 4242…
 * PaymentIntent confirm-via-API is NOT viable: Stripe defers PI until Checkout is confirmed (API ≥ 2022-08-01).
 */
async function autoCompleteCheckoutViaPlaywright(checkoutUrl: string): Promise<void> {
  console.log('\n=== Auto-pay: Stripe Checkout via Playwright (test card) ===\n');
  appendArtifact(`auto-complete playwright: ${checkoutUrl}`);

  const { chromium } = await import('playwright');
  const headed = process.env.SMOKE_HEADED === 'true';
  const browser = await chromium.launch({
    headless: !headed,
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const context = await browser.newContext({
    locale: 'en-US',
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  try {
    await page.goto(checkoutUrl, { waitUntil: 'domcontentloaded', timeout: 90_000 });
    await sleep(2_500);

    // Link/Wallet is often default — expand Card accordion on modern hosted Checkout.
    const cardOpeners = [
      page.locator('[data-testid="card-accordion-item-button"]'),
      page.locator('[data-testid="card-accordion-item"]'),
      page.getByRole('radio', { name: /^card$/i }),
      page.getByRole('button', { name: /^card$/i }),
      page.getByText(/^Card$/i),
    ];
    for (const opener of cardOpeners) {
      try {
        if ((await opener.count()) > 0 && (await opener.first().isVisible())) {
          await opener.first().click({ timeout: 3_000 });
          await sleep(800);
          break;
        }
      } catch {
        // try next opener
      }
    }

    const numberFilled = await fillFirstMatching(
      page,
      [
        '#cardNumber',
        'input[name="cardNumber"]',
        '[data-testid="card-number-input"]',
        'input[autocomplete="cc-number"]',
        'input[name="number"]',
        'input[placeholder*="Card number" i]',
      ],
      '4242424242424242',
    );
    if (!numberFilled) {
      try {
        const labeled = page.getByLabel(/card number/i).first();
        if ((await labeled.count()) > 0) {
          await labeled.fill('4242424242424242');
        } else {
          throw new Error('no card number field');
        }
      } catch {
        await saveCheckoutArtifacts(page, 'FAIL missing card number');
        throw new Error(
          'Could not locate Stripe card number input. Artifacts: qa/artifacts/smoke-payments/checkout-latest.{png,html}. Retry with SMOKE_HEADED=true or SMOKE_MANUAL_CHECKOUT=true.',
        );
      }
    }

    const expiryFilled =
      (await fillFirstMatching(
        page,
        [
          '#cardExpiry',
          'input[name="cardExpiry"]',
          '[data-testid="card-expiry-input"]',
          'input[autocomplete="cc-exp"]',
          'input[name="expiry"]',
          'input[placeholder*="MM" i]',
        ],
        '1234',
      )) ||
      (await (async () => {
        try {
          const labeled = page.getByLabel(/expir/i).first();
          if ((await labeled.count()) > 0) {
            await labeled.fill('12 / 34');
            return true;
          }
        } catch {
          // ignore
        }
        return false;
      })());

    const cvcFilled =
      (await fillFirstMatching(
        page,
        [
          '#cardCvc',
          'input[name="cardCvc"]',
          '[data-testid="card-cvc-input"]',
          'input[autocomplete="cc-csc"]',
          'input[name="cvc"]',
          'input[placeholder*="CVC" i]',
        ],
        '123',
      )) ||
      (await (async () => {
        try {
          const labeled = page.getByLabel(/cvc|security code/i).first();
          if ((await labeled.count()) > 0) {
            await labeled.fill('123');
            return true;
          }
        } catch {
          // ignore
        }
        return false;
      })());

    if (!expiryFilled || !cvcFilled) {
      await saveCheckoutArtifacts(page, 'FAIL missing expiry/cvc');
      throw new Error(
        `Stripe card fields incomplete (expiry=${expiryFilled}, cvc=${cvcFilled}). See checkout artifacts.`,
      );
    }

    await fillFirstMatching(
      page,
      [
        '#billingName',
        'input[name="billingName"]',
        '[data-testid="billing-name-input"]',
        'input[autocomplete="cc-name"]',
      ],
      'Test Buyer',
    ).catch(() => false);
    try {
      const name = page.getByLabel(/name on card|cardholder|full name/i).first();
      if ((await name.count()) > 0) {
        await name.fill('Test Buyer');
      }
    } catch {
      // optional
    }

    await fillFirstMatching(
      page,
      [
        '#billingPostalCode',
        'input[name="billingPostalCode"]',
        '[data-testid="billing-postal-code-input"]',
        'input[autocomplete="postal-code"]',
      ],
      '96815',
    ).catch(() => false);
    try {
      const zip = page.getByLabel(/zip|postal/i).first();
      if ((await zip.count()) > 0) {
        await zip.fill('96815');
      }
    } catch {
      // optional
    }

    // Link "Save my information" often auto-fills a phone that fails validation and blocks Pay.
    try {
      const saveInfo = page.getByRole('checkbox', {
        name: /save my information|save.*faster checkout/i,
      });
      if ((await saveInfo.count()) > 0 && (await saveInfo.first().isChecked())) {
        await saveInfo.first().uncheck({ timeout: 5_000 });
        await sleep(500);
      }
    } catch {
      try {
        const label = page.getByText(/save my information for faster checkout/i).first();
        if ((await label.count()) > 0) {
          await label.click({ timeout: 3_000 });
          await sleep(500);
        }
      } catch {
        // optional
      }
    }

    await saveCheckoutArtifacts(page, 'pre-submit checkout');

    const submitCandidates = [
      page.locator('[data-testid="hosted-payment-submit-button"]'),
      page.getByRole('button', { name: /^pay(\s|$)/i }),
      page.getByRole('button', { name: /pay|complete|submit|buy|process/i }),
    ];
    let clicked = false;
    for (const candidate of submitCandidates) {
      try {
        if ((await candidate.count()) > 0) {
          await candidate.first().click({ timeout: 15_000 });
          clicked = true;
          break;
        }
      } catch {
        // try next
      }
    }
    if (!clicked) {
      await saveCheckoutArtifacts(page, 'FAIL missing pay button');
      throw new Error('Could not find Stripe Checkout pay/submit button.');
    }

    // Allow Stripe a moment to process; surface inline validation errors early.
    await sleep(2_000);
    const inlineError = await page
      .locator('[role="alert"], [data-testid*="error"], .FieldError')
      .allTextContents()
      .catch(() => [] as string[]);
    const visibleErrors = inlineError.map((t) => t.trim()).filter(Boolean);
    if (visibleErrors.length > 0) {
      appendArtifact(`checkout inline errors: ${visibleErrors.join(' | ')}`);
    }

    try {
      await page.waitForURL(
        /127\.0\.0\.1:8081\/purchase\/success|localhost:8081\/purchase\/success|checkout\.stripe\.com\/.*success/i,
        { timeout: 120_000 },
      );
    } catch {
      await saveCheckoutArtifacts(page, 'FAIL after submit no redirect');
      const errHint = visibleErrors.length > 0 ? ` Inline errors: ${visibleErrors.join(' | ')}` : '';
      throw new Error(
        `Checkout did not redirect to success after pay. Final URL: ${page.url()}.${errHint} See checkout artifacts.`,
      );
    }

    appendArtifact(`playwright checkout finished url=${page.url()}`);
    console.log(`Playwright finished at: ${page.url()}`);
    logCheck('auto Stripe Checkout via Playwright', { ok: true, detail: page.url() });
  } catch (error) {
    try {
      await saveCheckoutArtifacts(page, 'FAIL checkout');
    } catch {
      // ignore artifact errors
    }
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
}

async function autoPayCheckout(checkoutUrl: string): Promise<void> {
  await autoCompleteCheckoutViaPlaywright(checkoutUrl);
}

async function runPostPaymentVerification(
  currentRunOrderPublicAccessToken: string,
  checkoutUrl?: string,
): Promise<{
  order: OrderRow;
  payment: PaymentRow;
  passes: PassRow[];
  payout: PayoutRow;
  lookup: Record<string, unknown>;
}> {
  console.log('\n=== Post-payment verification (polling up to 60s) ===\n');
  console.log(`verifying exact token: ${currentRunOrderPublicAccessToken}`);

  try {
    return await pollExactOrderUntilPaid(currentRunOrderPublicAccessToken, checkoutUrl);
  } catch (error) {
    console.log('\nRESULT: FAIL\n');
    console.error(String(error));
    if (error instanceof PostPaymentVerificationError) {
      await printVerificationDiagnostics(
        error.currentRunOrderPublicAccessToken,
        error.checkoutUrl,
      );
    } else {
      await printVerificationDiagnostics(currentRunOrderPublicAccessToken, checkoutUrl);
    }
    console.error('\nDiagnostics:');
    console.error('- Confirm you paid the checkout_url printed for THIS run (not an older checkout tab).');
    console.error('- Was stripe listen forwarding to stripe-webhook?');
    console.error('- Does STRIPE_WEBHOOK_SECRET in supabase/functions/.env match stripe listen whsec_...?');
    process.exit(1);
  }
}

async function main() {
  console.log('808Tix local Stripe payments smoke test\n');
  appendArtifact('808Tix local Stripe payments smoke test');
  console.log(`Redirect origin required: ${GUEST_WEB_ORIGIN}`);
  console.log('Preferred one-command orchestrator: npm run smoke:payments:preview\n');

  const verifyOnlyToken = process.env.SMOKE_VERIFY_TOKEN?.trim();
  const manualCheckout = process.env.SMOKE_MANUAL_CHECKOUT === 'true';
  let currentRunOrderPublicAccessToken: string;
  let checkoutUrl: string | undefined;
  let eventId = '(verify-only)';
  let ticketTypeId = '(verify-only)';

  const { publishableKey } = await checkPrerequisites();

  if (verifyOnlyToken) {
    console.log(`\nSMOKE_VERIFY_TOKEN set — skipping bootstrap/checkout; verifying paid order only.\n`);
    currentRunOrderPublicAccessToken = verifyOnlyToken;
  } else {
    const organizerId = await bootstrapOrganizer();
    const bootstrappedEvent = await bootstrapPaidEvent(organizerId);
    eventId = bootstrappedEvent.eventId;
    ticketTypeId = await bootstrapTicketType(eventId);

    const checkout = await createCheckoutSession(publishableKey, eventId, ticketTypeId);
    currentRunOrderPublicAccessToken = checkout.order_public_access_token!;
    checkoutUrl = checkout.checkout_url;

    try {
      await verifyPrePaymentLookup(currentRunOrderPublicAccessToken);
      logCheck('pre-payment get_order_by_public_token hides tickets', { ok: true });
    } catch (error) {
      logCheck('pre-payment get_order_by_public_token hides tickets', {
        ok: false,
        detail: String(error),
      });
      failAndExit('Pre-payment token exposure check failed.');
    }

    console.log(`current_run_order_public_access_token: ${currentRunOrderPublicAccessToken}`);
    console.log(`checkout_url: ${checkoutUrl}\n`);
    appendArtifact(`checkout_url: ${checkoutUrl}`);
    appendArtifact(`order_token: ${currentRunOrderPublicAccessToken}`);

    if (manualCheckout) {
      console.log('\n=== Manual Stripe payment (SMOKE_MANUAL_CHECKOUT=true) ===\n');
      console.log('1. Open checkout_url in your browser.');
      console.log('2. Pay with test card 4242 4242 4242 4242, any future expiry, any CVC, any ZIP.');
      console.log('3. Confirm stripe listen shows checkout.session.completed.');
      console.log('4. Press Enter here after payment completes.\n');

      const rl = createInterface({ input, output });
      await rl.question('Press Enter after payment completes... ');
      rl.close();
    } else {
      try {
        if (!checkoutUrl) {
          throw new Error('checkout_url missing after create-checkout-session');
        }
        await autoPayCheckout(checkoutUrl);
      } catch (error) {
        logCheck('auto Stripe Checkout payment', { ok: false, detail: String(error) });
        failAndExit(
          `Automatic Stripe test payment failed: ${String(error)}`,
          'Retry with SMOKE_HEADED=true npm run smoke:payments:preview, or SMOKE_MANUAL_CHECKOUT=true. Artifacts: qa/artifacts/smoke-payments/',
        );
      }
    }
  }

  const state = await runPostPaymentVerification(currentRunOrderPublicAccessToken, checkoutUrl);

  const failures = assertPostPayment(currentRunOrderPublicAccessToken, state);
  const passTokens = state.passes.map((pass) => pass.secure_token);

  console.log('\n=== Final result ===\n');
  console.log(`event_id: ${eventId}`);
  console.log(`ticket_type_id: ${ticketTypeId}`);
  console.log(`order_id: ${state.order.order_id}`);
  console.log(`current_run_order_public_access_token: ${currentRunOrderPublicAccessToken}`);
  console.log(
    `fees: subtotal=${state.order.subtotal_cents} service=${state.order.platform_fee_cents} processing=${state.order.processing_fee_cents} total=${state.order.total_cents} organizer_net=${state.order.organizer_net_cents}`,
  );
  if (checkoutUrl) {
    console.log(`checkout_url: ${checkoutUrl}`);
  }
  console.log(`paid ticket tokens: ${passTokens.join(', ')}`);
  for (const token of passTokens) {
    console.log(`ticket URL: ${GUEST_WEB_ORIGIN}/pass/${token}`);
  }

  if (failures.length > 0) {
    console.log('\nRESULT: FAIL\n');
    for (const failure of failures) {
      console.log(`- ${failure}`);
      appendArtifact(`assert fail: ${failure}`);
    }
    await printVerificationDiagnostics(currentRunOrderPublicAccessToken, checkoutUrl);
    flushArtifact({ failed: true, failures, order: state.order });
    process.exit(1);
  }

  console.log('\nRESULT: PASS');
  console.log(
    '\nVerified path: create-checkout-session → Stripe payment → stripe-webhook → fulfill_paid_order → paid passes + transparent fees',
  );
  appendArtifact('RESULT: PASS');
  flushArtifact({ failed: false, order: state.order, passTokens });
}

main().catch((error) => {
  console.error('\nUnhandled smoke test error:', error);
  appendArtifact(`Unhandled: ${String(error)}`);
  flushArtifact({ failed: true, unhandled: String(error) });
  process.exit(1);
});
