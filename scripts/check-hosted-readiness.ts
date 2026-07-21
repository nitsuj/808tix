#!/usr/bin/env npx tsx
/**
 * Hosted readiness gate for 808Tickets launch.
 *
 * Usage:
 *   npm run check:hosted
 *
 * Read-only: lists migrations/functions/secrets/RPC presence and probes public domains.
 * Never prints secret values. Never mutates hosted DB or secrets.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();

type CheckResult = 'PASS' | 'FAIL' | 'WARN';

type CheckRow = {
  check: string;
  expected: string;
  actual: string;
  result: CheckResult;
  required: boolean;
  remediation?: string;
};

const REQUIRED_RPCS = [
  'create_pending_order',
  'fulfill_paid_order',
  'get_order_by_public_token',
  'get_pass_by_token',
  'validate_pass',
] as const;

const REQUIRED_FUNCTIONS = [
  'create-checkout-session',
  'stripe-webhook',
  'send-order-confirmation-email',
  'wallet-apple',
] as const;

const OPTIONAL_FUNCTIONS = ['send-pass-sms'] as const;

const REQUIRED_SECRETS = [
  'PUBLIC_SITE_URL',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'EMAIL_DELIVERY_MODE',
  'EMAIL_FROM',
  'RESEND_API_KEY',
  'APPLE_PASS_TYPE_IDENTIFIER',
  'APPLE_TEAM_ID',
  'APPLE_ORGANIZATION_NAME',
  'APPLE_PASS_CERT_P12_BASE64',
  'APPLE_PASS_CERT_PASSWORD',
  'APPLE_WWDR_CERT_PEM',
] as const;

const OPTIONAL_SECRETS = [
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_PHONE_NUMBER',
] as const;

const CANONICAL_ORIGIN = 'https://808tickets.com';
const WWW_ORIGIN = 'https://www.808tickets.com';
const LEGACY_ORIGIN = 'https://808tix.vercel.app';

function addRow(
  rows: CheckRow[],
  check: string,
  expected: string,
  actual: string,
  result: CheckResult,
  required = true,
  remediation?: string,
): void {
  rows.push({ check, expected, actual, result, required, remediation });
}

async function runSupabase(
  args: string[],
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const result = await execFileAsync('supabase', args, {
      cwd: ROOT,
      maxBuffer: 10 * 1024 * 1024,
    });
    return { stdout: result.stdout, stderr: result.stderr, exitCode: 0 };
  } catch (error) {
    const execError = error as { stdout?: string; stderr?: string; code?: number | string };
    return {
      stdout: execError.stdout ?? '',
      stderr: execError.stderr ?? String(error),
      exitCode: typeof execError.code === 'number' ? execError.code : 1,
    };
  }
}

function stripAnsi(output: string): string {
  return output.replace(/\u001b\[[0-9;]*m/g, '');
}

function stripCliNoise(output: string): string {
  return stripAnsi(output)
    .split('\n')
    .filter((line) => !/A new version of Supabase CLI is available/i.test(line))
    .filter((line) => !/We recommend updating regularly/i.test(line))
    .filter((line) => !/^Initialising login role/i.test(line))
    .filter((line) => !/^Connecting to remote database/i.test(line))
    .join('\n');
}

function parseSecretNames(output: string): Set<string> {
  const names = new Set<string>();
  const cleaned = stripCliNoise(output);

  for (const line of cleaned.split('\n')) {
    if (!line.includes('|')) {
      continue;
    }

    const trimmed = line.trim();
    if (/^-{2,}|^[┌├└]/.test(trimmed)) {
      continue;
    }

    // Header row only: "NAME | DIGEST"
    if (/^\s*NAME\s*\|/i.test(line)) {
      continue;
    }

    const cells = line
      .split('|')
      .map((cell) => cell.trim())
      .filter(Boolean);

    if (cells.length === 0) {
      continue;
    }

    const name = cells[0];
    if (/^[A-Z][A-Z0-9_]*$/.test(name)) {
      names.add(name);
    }
  }

  return names;
}

function parseFunctionSlugs(output: string): Map<string, string> {
  const statusBySlug = new Map<string, string>();
  const cleaned = stripCliNoise(output);

  for (const line of cleaned.split('\n')) {
    if (!line.includes('|') || /SLUG\s*\|/i.test(line) || /NAME\s*\|/i.test(line)) {
      continue;
    }

    if (/^-{2,}|^[┌├└]/.test(line.trim())) {
      continue;
    }

    const cells = line
      .split('|')
      .map((cell) => cell.trim())
      .filter(Boolean);

    // ID | NAME | SLUG | STATUS | VERSION | UPDATED_AT
    if (cells.length < 4) {
      continue;
    }

    const slug = cells[2] || cells[1];
    const status = cells[3] || '';
    if (slug && !/^id$/i.test(slug) && slug.includes('-')) {
      statusBySlug.set(slug, status.toUpperCase());
    }
  }

  return statusBySlug;
}

function parseMigrationPending(output: string): {
  pendingLocalOnly: string[];
  pendingRemoteOnly: string[];
  paired: number;
  parseOk: boolean;
} {
  const pendingLocalOnly: string[] = [];
  const pendingRemoteOnly: string[] = [];
  let paired = 0;
  let parseOk = false;
  const cleaned = stripCliNoise(output);

  for (const line of cleaned.split('\n')) {
    if (!line.includes('|') || /Local\s*\|/i.test(line)) {
      continue;
    }

    if (/^-{2,}|^[┌├└]/.test(line.trim())) {
      continue;
    }

    const cells = line
      .split('|')
      .map((cell) => cell.trim());

    // Expect: Local | Remote | Time
    if (cells.length < 3) {
      continue;
    }

    // split leaves empty edges when line starts with spaces + |
    const nonempty = cells.filter((cell, index) => !(index === 0 && cell === ''));
    if (nonempty.length < 2) {
      continue;
    }

    const local = nonempty[0] ?? '';
    const remote = nonempty[1] ?? '';

    if (!/^\d{14}$/.test(local) && local !== '' && !/^\d{14}$/.test(remote) && remote !== '') {
      continue;
    }

    if (/^\d{14}$/.test(local) || /^\d{14}$/.test(remote) || local === '' || remote === '') {
      parseOk = true;
    }

    if (/^\d{14}$/.test(local) && /^\d{14}$/.test(remote)) {
      paired += 1;
      continue;
    }

    if (/^\d{14}$/.test(local) && remote === '') {
      pendingLocalOnly.push(local);
      continue;
    }

    if (local === '' && /^\d{14}$/.test(remote)) {
      pendingRemoteOnly.push(remote);
    }
  }

  return { pendingLocalOnly, pendingRemoteOnly, paired, parseOk };
}

function extractBalancedJson(output: string, openChar: '{' | '['): string | null {
  const start = output.indexOf(openChar);
  if (start === -1) {
    return null;
  }

  const closeChar = openChar === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let index = start; index < output.length; index += 1) {
    const char = output[index];

    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (char === '\\') {
        escape = true;
        continue;
      }
      if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === openChar) {
      depth += 1;
      continue;
    }

    if (char === closeChar) {
      depth -= 1;
      if (depth === 0) {
        return output.slice(start, index + 1);
      }
    }
  }

  return null;
}

function collectRpcNameFromRow(row: Record<string, unknown>, names: Set<string>): void {
  const candidate = row.function_name ?? row.routine_name ?? row.proname ?? row.name;
  if (typeof candidate === 'string' && candidate.trim()) {
    names.add(candidate.trim());
  }
}

function describeOutputShape(cleaned: string): string {
  const trimmed = cleaned.trim();
  if (!trimmed) {
    return 'empty';
  }
  if (trimmed.startsWith('{')) {
    return 'json-object';
  }
  if (trimmed.startsWith('[')) {
    return 'json-array';
  }
  if (/[│┃]/.test(trimmed) || /┌|├|└/.test(trimmed)) {
    return 'box-table';
  }
  if (trimmed.includes('|')) {
    return 'pipe-table';
  }
  return 'text';
}

function parseRpcNamesFromTable(cleaned: string): Set<string> {
  const names = new Set<string>();

  for (const line of cleaned.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || /^[┌├└┬┴┼─═\s]+$/.test(trimmed)) {
      continue;
    }

    // Unicode box tables use │; older ASCII tables use |.
    const divider = trimmed.includes('│') ? '│' : trimmed.includes('|') ? '|' : null;
    if (!divider) {
      for (const rpc of REQUIRED_RPCS) {
        if (new RegExp(`(?:^|\\s)${rpc}(?:\\s|$)`).test(trimmed)) {
          names.add(rpc);
        }
      }
      continue;
    }

    const cells = trimmed
      .split(divider)
      .map((cell) => cell.trim())
      .filter(Boolean);

    // Skip header rows.
    if (
      cells.some((cell) =>
        /^(schema|function_name|routine_name|proname|args|name)$/i.test(cell),
      )
    ) {
      continue;
    }

    for (const cell of cells) {
      if ((REQUIRED_RPCS as readonly string[]).includes(cell)) {
        names.add(cell);
      }
    }
  }

  return names;
}

function parseRpcNamesFromQuery(output: string): {
  names: Set<string>;
  parseOk: boolean;
  detail: string;
} {
  const names = new Set<string>();
  const cleaned = stripCliNoise(output);
  const shape = describeOutputShape(cleaned);

  const jsonArrayText = extractBalancedJson(cleaned, '[');
  if (jsonArrayText) {
    try {
      const parsed = JSON.parse(jsonArrayText) as unknown;
      if (Array.isArray(parsed)) {
        for (const row of parsed) {
          if (row && typeof row === 'object') {
            collectRpcNameFromRow(row as Record<string, unknown>, names);
          } else if (typeof row === 'string' && (REQUIRED_RPCS as readonly string[]).includes(row)) {
            names.add(row);
          }
        }

        return {
          names,
          parseOk: true,
          detail: `json-array rows=${parsed.length}`,
        };
      }
    } catch {
      // fall through
    }
  }

  const jsonObjectText = extractBalancedJson(cleaned, '{');
  if (jsonObjectText) {
    try {
      const parsed = JSON.parse(jsonObjectText) as {
        rows?: Array<Record<string, unknown>>;
      };

      if (Array.isArray(parsed.rows)) {
        for (const row of parsed.rows) {
          collectRpcNameFromRow(row, names);
        }

        return {
          names,
          parseOk: true,
          detail: `json-object rows=${parsed.rows.length}`,
        };
      }
    } catch {
      // fall through
    }
  }

  for (const match of cleaned.matchAll(
    /"(?:function_name|routine_name|proname)"\s*:\s*"([^"]+)"/g,
  )) {
    names.add(match[1]);
  }

  const tableNames = parseRpcNamesFromTable(cleaned);
  for (const name of tableNames) {
    names.add(name);
  }

  if (names.size > 0) {
    return { names, parseOk: true, detail: `fallback shape=${shape} names=${names.size}` };
  }

  // Empty JSON array/object with rows:[] is a successful parse of an empty result set.
  if (jsonArrayText === '[]' || /"rows"\s*:\s*\[\s*\]/.test(cleaned)) {
    return { names, parseOk: true, detail: `empty-result shape=${shape}` };
  }

  const preview = cleaned.replace(/\s+/g, ' ').trim().slice(0, 160);
  return {
    names,
    parseOk: false,
    detail: `parser-failed shape=${shape} preview=${preview || '(empty)'}`,
  };
}

function missingRpcRemediation(migrationsSynced: boolean, pendingLocal: boolean): string {
  if (pendingLocal) {
    return 'Local migrations are pending. Apply with: supabase db push';
  }

  if (migrationsSynced) {
    return [
      'Investigate remote schema drift; do not blindly push.',
      'Run direct pg_proc query and compare migration history:',
      `supabase db query --linked -o json "select n.nspname as schema, p.proname as function_name, pg_get_function_identity_arguments(p.oid) as args from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('create_pending_order','fulfill_paid_order','get_order_by_public_token','get_pass_by_token','validate_pass') order by p.proname;"`,
      'If functions exist in pg_proc but API still fails, reload PostgREST:',
      `supabase db query --linked "notify pgrst, 'reload schema';"`,
    ].join('\n');
  }

  return [
    'Confirm supabase link, then compare migration list vs pg_proc.',
    'Only run supabase db push if migration list shows local-only pending migrations.',
  ].join('\n');
}

function parserFailedRemediation(migrationsSynced: boolean): string {
  const lines = [
    'Hosted checker could not parse the remote RPC query output. Fix the checker/parser or run the direct pg_proc query. Do not assume hosted schema drift or run supabase db push.',
    'Preferred machine-readable query:',
    `supabase db query --linked -o json "select p.proname as function_name from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('create_pending_order','fulfill_paid_order','get_order_by_public_token','get_pass_by_token','validate_pass') order by 1;"`,
  ];

  if (migrationsSynced) {
    lines.push('Migrations are synced — do not run supabase db push for a parser failure.');
  }

  return lines.join('\n');
}

async function probeUrl(
  url: string,
): Promise<{ ok: boolean; status: number | null; finalUrl: string; detail: string }> {
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(15_000),
    });

    return {
      ok: response.ok,
      status: response.status,
      finalUrl: response.url,
      detail: `HTTP ${response.status} → ${response.url}`,
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      finalUrl: url,
      detail: String(error),
    };
  }
}

function printTable(rows: CheckRow[]): void {
  const checkW = Math.max(5, ...rows.map((row) => row.check.length));
  const expectedW = Math.max(8, ...rows.map((row) => row.expected.length));
  const actualW = Math.max(6, ...rows.map((row) => Math.min(row.actual.length, 64)));
  const resultW = 6;

  const header = `${'Check'.padEnd(checkW)} | ${'Expected'.padEnd(expectedW)} | ${'Actual'.padEnd(actualW)} | ${'Result'.padEnd(resultW)}`;
  const rule = '-'.repeat(header.length);

  console.log('\n808Tickets hosted readiness\n');
  console.log(header);
  console.log(rule);

  for (const row of rows) {
    const actual = row.actual.length > 64 ? `${row.actual.slice(0, 61)}...` : row.actual;
    console.log(
      `${row.check.padEnd(checkW)} | ${row.expected.padEnd(expectedW)} | ${actual.padEnd(actualW)} | ${row.result.padEnd(resultW)}`,
    );
  }

  console.log(rule);
}

async function checkMigrations(rows: CheckRow[]): Promise<{
  synced: boolean;
  pendingLocal: boolean;
}> {
  const { stdout, stderr, exitCode } = await runSupabase(['migration', 'list']);
  const combined = `${stdout}\n${stderr}`;

  if (exitCode !== 0) {
    addRow(
      rows,
      'migration list',
      'local == remote',
      `cli exit ${exitCode}`,
      'FAIL',
      true,
      'Link project and retry: supabase link --project-ref <ref>\nThen: supabase migration list\nIf local ahead: supabase db push',
    );
    return { synced: false, pendingLocal: false };
  }

  const parsed = parseMigrationPending(combined);

  if (!parsed.parseOk) {
    addRow(
      rows,
      'migration list',
      'parsable Local|Remote table',
      'unparsed output',
      'FAIL',
      true,
      'Run: supabase migration list',
    );
    return { synced: false, pendingLocal: false };
  }

  if (parsed.pendingLocalOnly.length > 0) {
    addRow(
      rows,
      'migrations synced',
      'no local-only pending',
      `local-only: ${parsed.pendingLocalOnly.join(', ')}`,
      'FAIL',
      true,
      'supabase db push',
    );
    return { synced: false, pendingLocal: true };
  }

  if (parsed.pendingRemoteOnly.length > 0) {
    addRow(
      rows,
      'migrations synced',
      'no remote-only drift',
      `remote-only: ${parsed.pendingRemoteOnly.join(', ')}`,
      'WARN',
      false,
      'Pull or reconcile remote migrations before launch claims.',
    );
  }

  addRow(
    rows,
    'migrations synced',
    'no local-only pending',
    `${parsed.paired} paired migration(s)`,
    'PASS',
  );

  return { synced: true, pendingLocal: false };
}

async function checkRemoteRpcs(
  rows: CheckRow[],
  migrationState: { synced: boolean; pendingLocal: boolean },
): Promise<void> {
  const rpcList = REQUIRED_RPCS.map((name) => `'${name}'`).join(', ');
  const sql = [
    'select n.nspname as schema,',
    '       p.proname as function_name,',
    '       pg_get_function_identity_arguments(p.oid) as args',
    'from pg_proc p',
    'join pg_namespace n on n.oid = p.pronamespace',
    "where n.nspname = 'public'",
    `  and p.proname in (${rpcList})`,
    'order by p.proname;',
  ].join(' ');

  const { stdout, stderr, exitCode } = await runSupabase([
    'db',
    'query',
    '--linked',
    '-o',
    'json',
    sql,
  ]);
  const combined = `${stdout}\n${stderr}`;

  if (exitCode !== 0) {
    addRow(
      rows,
      'remote RPCs',
      REQUIRED_RPCS.join(', '),
      `query failed (exit ${exitCode})`,
      'FAIL',
      true,
      'supabase link --project-ref <ref>\n' +
        'supabase db query --linked -o json "select p.proname as function_name from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = \'public\'"',
    );
    return;
  }

  const parsed = parseRpcNamesFromQuery(combined);

  if (!parsed.parseOk) {
    addRow(
      rows,
      'remote RPC query parse',
      'parsable pg_proc JSON/table',
      parsed.detail,
      'FAIL',
      true,
      parserFailedRemediation(migrationState.synced),
    );
    return;
  }

  for (const rpc of REQUIRED_RPCS) {
    const present = parsed.names.has(rpc);
    addRow(
      rows,
      `RPC ${rpc}`,
      'exists on remote public schema',
      present ? 'present' : 'missing',
      present ? 'PASS' : 'FAIL',
      true,
      present
        ? undefined
        : missingRpcRemediation(migrationState.synced, migrationState.pendingLocal),
    );
  }
}

async function checkFunctions(rows: CheckRow[]): Promise<void> {
  const { stdout, stderr, exitCode } = await runSupabase(['functions', 'list']);
  const combined = `${stdout}\n${stderr}`;

  if (exitCode !== 0) {
    addRow(
      rows,
      'functions list',
      'deployed ACTIVE functions',
      `cli exit ${exitCode}`,
      'FAIL',
      true,
      'supabase functions list',
    );
    return;
  }

  const bySlug = parseFunctionSlugs(combined);

  for (const name of REQUIRED_FUNCTIONS) {
    const status = bySlug.get(name);
    const ok = Boolean(status && status.includes('ACTIVE'));
    addRow(
      rows,
      `function ${name}`,
      'ACTIVE',
      status ?? 'missing',
      ok ? 'PASS' : 'FAIL',
      true,
      ok ? undefined : `supabase functions deploy ${name}`,
    );
  }

  for (const name of OPTIONAL_FUNCTIONS) {
    const status = bySlug.get(name);
    if (!status) {
      addRow(
        rows,
        `function ${name}`,
        'ACTIVE (optional SMS)',
        'missing',
        'WARN',
        false,
        `supabase functions deploy ${name}`,
      );
      continue;
    }

    addRow(
      rows,
      `function ${name}`,
      'ACTIVE (optional SMS)',
      status,
      status.includes('ACTIVE') ? 'PASS' : 'WARN',
      false,
    );
  }
}

async function checkSecrets(rows: CheckRow[]): Promise<void> {
  const { stdout, stderr, exitCode } = await runSupabase(['secrets', 'list']);
  const combined = `${stdout}\n${stderr}`;

  if (exitCode !== 0) {
    addRow(
      rows,
      'secrets list',
      'required secret names present',
      `cli exit ${exitCode}`,
      'FAIL',
      true,
      'supabase secrets list',
    );
    return;
  }

  const names = parseSecretNames(combined);

  for (const secret of REQUIRED_SECRETS) {
    const present = names.has(secret);
    addRow(
      rows,
      `secret ${secret}`,
      'present (value not shown)',
      present ? '(set)' : '(missing)',
      present ? 'PASS' : 'FAIL',
      true,
      present ? undefined : `supabase secrets set ${secret}=...`,
    );
  }

  for (const secret of OPTIONAL_SECRETS) {
    const present = names.has(secret);
    addRow(
      rows,
      `secret ${secret}`,
      'present for SMS (optional)',
      present ? '(set)' : '(missing)',
      present ? 'PASS' : 'WARN',
      false,
      present ? undefined : `supabase secrets set ${secret}=...`,
    );
  }
}

async function checkDomains(rows: CheckRow[]): Promise<void> {
  const apex = await probeUrl(CANONICAL_ORIGIN);
  addRow(
    rows,
    'canonical domain',
    `${CANONICAL_ORIGIN} OK`,
    apex.detail,
    apex.ok ? 'PASS' : 'FAIL',
    true,
    apex.ok ? undefined : 'Verify Vercel production domain for 808tickets.com',
  );

  const www = await probeUrl(WWW_ORIGIN);
  const wwwEndsOnApex =
    www.ok &&
    (() => {
      try {
        return new URL(www.finalUrl).hostname.replace(/^www\./, '') === '808tickets.com';
      } catch {
        return false;
      }
    })();

  addRow(
    rows,
    'www domain',
    `${WWW_ORIGIN} redirects/responds`,
    www.detail,
    www.ok && wwwEndsOnApex ? 'PASS' : www.ok ? 'WARN' : 'FAIL',
    true,
    www.ok
      ? wwwEndsOnApex
        ? undefined
        : 'Prefer www → https://808tickets.com redirect'
      : 'Configure www.808tickets.com DNS/redirect',
  );

  const legacy = await probeUrl(LEGACY_ORIGIN);
  addRow(
    rows,
    'legacy vercel.app',
    'transition redirect allowed (not canonical)',
    legacy.detail,
    legacy.ok ? 'WARN' : 'WARN',
    false,
    'Canonical launch origin is https://808tickets.com — see docs/DOMAIN_CUTOVER.md',
  );
}

async function main(): Promise<void> {
  if (process.argv.includes('--self-test')) {
    runParserSelfTest();
    return;
  }

  const rows: CheckRow[] = [];

  console.log('Checking hosted readiness (read-only; secret values never printed)...');

  const migrationState = await checkMigrations(rows);
  await checkRemoteRpcs(rows, migrationState);
  await checkFunctions(rows);
  await checkSecrets(rows);
  await checkDomains(rows);

  printTable(rows);

  const failures = rows.filter((row) => row.required && row.result === 'FAIL');
  const warnings = rows.filter((row) => row.result === 'WARN');

  if (warnings.length > 0) {
    console.log(`\nWarnings (${warnings.length}):`);
    for (const row of warnings) {
      console.log(`- ${row.check}: ${row.actual}`);
      if (row.remediation) {
        console.log(`  Remediation: ${row.remediation}`);
      }
    }
  }

  if (failures.length > 0) {
    console.error(`\nFAIL: ${failures.length} required hosted check(s) failed.`);
    for (const row of failures) {
      console.error(`- ${row.check}: expected ${row.expected}; actual ${row.actual}`);
      if (row.remediation) {
        console.error(`  Remediation: ${row.remediation}`);
      }
    }
    console.error('\nSee docs/P0_ACCEPTANCE.md');
    process.exit(1);
  }

  console.log('\nPASS: hosted readiness checks succeeded (required).');
  console.log('Note: this does not prove hosted Stripe checkout, inbox delivery, or door scans.');
  console.log('Complete manual hosted checkout smoke before any launch claim.');
}

function runParserSelfTest(): void {
  let failures = 0;

  function assert(condition: boolean, message: string): void {
    if (!condition) {
      console.error(`✗ ${message}`);
      failures += 1;
      return;
    }
    console.log(`✓ ${message}`);
  }

  const noisyWrappedJson = `Initialising login role...
{
  "boundary": "abc",
  "rows": [
    { "function_name": "create_pending_order", "schema": "public", "args": "uuid" },
    { "function_name": "validate_pass", "schema": "public", "args": "text, uuid" }
  ],
  "warning": "untrusted <boundary>"
}
A new version of Supabase CLI is available: v9.9.9
We recommend updating regularly for new features and bug fixes: https://example.com
`;

  const wrapped = parseRpcNamesFromQuery(noisyWrappedJson);
  assert(wrapped.parseOk, 'parses wrapped CLI JSON object');
  assert(wrapped.names.has('create_pending_order'), 'finds create_pending_order via function_name');
  assert(wrapped.names.has('validate_pass'), 'finds validate_pass via function_name');

  const bareArray = parseRpcNamesFromQuery(`[
  { "function_name": "fulfill_paid_order" },
  { "routine_name": "get_order_by_public_token" },
  { "proname": "get_pass_by_token" }
]`);
  assert(bareArray.parseOk, 'parses bare JSON array (-o json + agent no)');
  assert(bareArray.names.has('fulfill_paid_order'), 'array: function_name');
  assert(bareArray.names.has('get_order_by_public_token'), 'array: routine_name');
  assert(bareArray.names.has('get_pass_by_token'), 'array: proname');

  const boxTable = `
┌────────┬───────────────────────────┬────────────────────────┐
│ schema │       function_name       │          args          │
├────────┼───────────────────────────┼────────────────────────┤
│ public │ create_pending_order      │ p_event_id uuid        │
│ public │ fulfill_paid_order        │ p_order_id uuid        │
│ public │ get_order_by_public_token │ p_public_access_token  │
│ public │ get_pass_by_token         │ p_secure_token text    │
│ public │ validate_pass             │ p_secure_token text    │
└────────┴───────────────────────────┴────────────────────────┘
`;
  const boxParsed = parseRpcNamesFromQuery(boxTable);
  assert(boxParsed.parseOk, 'parses Supabase ASCII/Unicode box table');
  assert(boxParsed.names.size === 5, 'box table extracts all 5 RPC names');
  assert(boxParsed.names.has('validate_pass'), 'box table includes validate_pass');

  const emptyArray = parseRpcNamesFromQuery('[]');
  assert(emptyArray.parseOk, 'empty JSON array is parse success');
  assert(emptyArray.names.size === 0, 'empty JSON array yields zero names');

  const emptyRows = parseRpcNamesFromQuery('{ "boundary": "x", "rows": [] }');
  assert(emptyRows.parseOk, 'empty rows object is parse success');
  assert(emptyRows.names.size === 0, 'empty rows yields zero names');

  const garbage = parseRpcNamesFromQuery('Initialising login role...\nnot a result set\n');
  assert(!garbage.parseOk, 'unparseable output fails as parser-failed');
  assert(garbage.detail.includes('parser-failed'), 'unparseable detail marks parser-failed');
  assert(garbage.names.size === 0, 'unparseable yields no names');

  const parserRemediation = parserFailedRemediation(true);
  assert(
    parserRemediation.includes('Do not assume hosted schema drift or run supabase db push') &&
      !parserRemediation.includes('Apply with: supabase db push'),
    'migrations synced + parser failed does not recommend supabase db push',
  );

  const syncedRemediation = missingRpcRemediation(true, false);
  assert(
    syncedRemediation.includes('do not blindly push') &&
      syncedRemediation.includes("notify pgrst, 'reload schema'"),
    'synced+missing remediation avoids blind db push',
  );

  const pendingRemediation = missingRpcRemediation(false, true);
  assert(pendingRemediation.includes('supabase db push'), 'pending-local remediation suggests db push');

  if (failures > 0) {
    console.error(`\ncheck-hosted-readiness --self-test: ${failures} failure(s)`);
    process.exit(1);
  }

  console.log('\ncheck-hosted-readiness --self-test: all checks passed');
}

main().catch((error) => {
  console.error('\nFAIL: check-hosted-readiness error:', error);
  process.exit(1);
});
