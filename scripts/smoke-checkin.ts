#!/usr/bin/env npx tsx
/**
 * Local scanner/check-in smoke test (no camera hardware).
 *
 * Proves validate_pass RPC behavior using qa/fixtures.json passes.
 *
 * Usage:
 *   npm run qa:seed
 *   npm run smoke:checkin
 */
import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const FIXTURES_PATH = join(ROOT, 'qa/fixtures.json');

const QA_ORGANIZER_EMAIL = 'qa@808tix.test';
const QA_ORGANIZER_PASSWORD = 'qa';
const QA_ORGANIZER_ID = 'a1000001-0000-4000-8000-000000000001';
const QA_PLATFORM_ADMIN_EMAIL = 'platform-admin@808tix.test';
const QA_PLATFORM_ADMIN_PASSWORD = 'qa-admin-password';
const QA_DENIED_SCANNER_EMAIL = 'scanner-denied@808tix.test';
const QA_DENIED_SCANNER_PASSWORD = 'qa-denied-password';
const QA_DENIED_SCANNER_ID = 'a1000001-0000-4000-8000-000000000098';
const WRONG_EVENT_ID = 'a1000001-0000-4000-8000-000000000004';

type QaFixtures = {
  event_id: string;
  ticket_type_id: string;
  pending_order_token?: string;
  paid_order_token: string;
  pass_tokens: string[];
  created_at?: string;
};

type ValidatePassResponse = {
  result: string;
  pass_id?: string;
  guest_name?: string;
};

type SmokeCaseResult = {
  caseName: string;
  expected: string;
  actual: string;
  ok: boolean;
  detail?: string;
};

type CheckinCounts = {
  valid_count: number;
  already_used_count: number;
  total_count: number;
};

function maskToken(token: string): string {
  if (token.length <= 12) {
    return '***';
  }

  return `${token.slice(0, 8)}...`;
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

function failAndExit(message: string, nextAction?: string): never {
  console.error(`\nCheck-in smoke stopped: ${message}`);
  if (nextAction) {
    console.error(`Next action: ${nextAction}`);
  }
  process.exit(1);
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

function extractJsonCell<T>(output: string, columnName: string): T {
  const jsonRows = parseJsonRows(output);
  if (jsonRows.length > 0 && columnName in jsonRows[0]) {
    const value = jsonRows[0][columnName];
    if (typeof value === 'string') {
      return JSON.parse(value) as T;
    }
    return value as T;
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
    const values = parseRow(cellLines[1]);
    const columnIndex = columns.indexOf(columnName);

    if (columnIndex >= 0) {
      const cell = values[columnIndex];
      if (cell.startsWith('{') || cell.startsWith('[')) {
        return JSON.parse(cell) as T;
      }
      return cell as T;
    }
  }

  const balanced = extractBalancedJson(output);
  if (balanced) {
    return JSON.parse(balanced) as T;
  }

  throw new Error(`Could not parse ${columnName} from supabase db query output`);
}

async function runSupabaseQuery(sql: string): Promise<string> {
  const { stdout, stderr } = await execFileAsync('supabase', ['db', 'query', '--local', sql], {
    cwd: ROOT,
    maxBuffer: 10 * 1024 * 1024,
  });

  if (/^ERROR:/im.test(stdout) || /^ERROR:/im.test(stderr)) {
    throw new Error(stderr.trim() || stdout.trim() || 'supabase db query failed');
  }

  return stdout;
}

async function loadLocalSupabaseEnv(): Promise<{ apiUrl: string; anonKey: string }> {
  try {
    const { stdout } = await execFileAsync('supabase', ['status', '-o', 'env'], {
      cwd: ROOT,
      maxBuffer: 10 * 1024 * 1024,
    });
    const statusEnv = parseStatusEnv(stdout);
    const apiUrl = statusEnv.API_URL?.trim();
    const anonKey = statusEnv.ANON_KEY?.trim();

    if (!apiUrl || !anonKey) {
      failAndExit('API_URL or ANON_KEY missing from supabase status.', 'Run: supabase start');
    }

    const allowRemote = process.env.SMOKE_ALLOW_REMOTE === 'true';
    if (!isLocalSupabaseUrl(apiUrl) && !allowRemote) {
      failAndExit(
        `Refusing to run check-in smoke against non-local Supabase URL: ${apiUrl}`,
        'Set SMOKE_ALLOW_REMOTE=true only if you intentionally know what you are doing.',
      );
    }

    return { apiUrl, anonKey };
  } catch (error) {
    failAndExit('Local Supabase is not running.', `Run: supabase start\n${String(error)}`);
  }
}

function loadFixtures(): QaFixtures {
  if (!existsSync(FIXTURES_PATH)) {
    failAndExit(
      'qa/fixtures.json is missing.',
      'Run:\n  npm run qa:seed\n  npm run smoke:checkin',
    );
  }

  const fixtures = JSON.parse(readFileSync(FIXTURES_PATH, 'utf8')) as QaFixtures;

  if (!fixtures.event_id || !Array.isArray(fixtures.pass_tokens) || fixtures.pass_tokens.length < 1) {
    failAndExit('qa/fixtures.json is missing event_id or pass_tokens.', 'Run: npm run qa:seed');
  }

  return fixtures;
}

async function ensureWrongEventFixture(): Promise<void> {
  const sql = `
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
      '${WRONG_EVENT_ID}'::uuid,
      '${QA_ORGANIZER_ID}'::uuid,
      'qa-checkin-other-event',
      'QA Check-in Other Event',
      'QA Venue',
      'published',
      100,
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
      status = excluded.status;
  `;

  await runSupabaseQuery(sql);
}

async function getPassStatusByToken(secureToken: string): Promise<{ id: string; status: string } | null> {
  const sql = `
    select coalesce(
      (
        select row_to_json(t)::text
        from (
          select id::text as id, status
          from public.passes
          where secure_token = '${secureToken.replace(/'/g, "''")}'
          limit 1
        ) t
      ),
      'null'
    ) as result;
  `;

  const output = await runSupabaseQuery(sql);
  const row = extractJsonCell<{ id: string; status: string } | null>(output, 'result');
  return row;
}

async function getCheckinCounts(passId: string, eventId: string): Promise<CheckinCounts> {
  const sql = `
    select coalesce(
      (
        select row_to_json(t)::text
        from (
          select
            count(*) filter (where result = 'valid')::int as valid_count,
            count(*) filter (where result = 'already_used')::int as already_used_count,
            count(*)::int as total_count
          from public.checkins
          where pass_id = '${passId}'::uuid
            and event_id = '${eventId}'::uuid
        ) t
      ),
      '{"valid_count":0,"already_used_count":0,"total_count":0}'
    ) as result;
  `;

  const output = await runSupabaseQuery(sql);
  return extractJsonCell<CheckinCounts>(output, 'result');
}

async function ensureQaOrganizerGoTrueReady(): Promise<void> {
  await runSupabaseQuery(`
    insert into auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    )
    select
      gen_random_uuid(),
      u.id,
      jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
      'email',
      u.id::text,
      now(),
      now(),
      now()
    from auth.users u
    where u.id = '${QA_ORGANIZER_ID}'::uuid
      and not exists (
        select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email'
      );
  `);

  await runSupabaseQuery(`
    update auth.users
    set
      confirmation_token = coalesce(confirmation_token, ''),
      recovery_token = coalesce(recovery_token, ''),
      email_change_token_new = coalesce(email_change_token_new, ''),
      email_change = coalesce(email_change, ''),
      phone_change = coalesce(phone_change, ''),
      email_confirmed_at = coalesce(email_confirmed_at, now())
    where id = '${QA_ORGANIZER_ID}'::uuid;
  `);
}

async function ensureDeniedScannerUser(): Promise<void> {
  await runSupabaseQuery(`
    insert into auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change,
      phone_change,
      phone_change_token,
      email_change_token_current,
      reauthentication_token,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data
    )
    values (
      '${QA_DENIED_SCANNER_ID}'::uuid,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      '${QA_DENIED_SCANNER_EMAIL}',
      crypt('${QA_DENIED_SCANNER_PASSWORD}', gen_salt('bf')),
      now(),
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      now(),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb
    )
    on conflict (id) do update
    set
      email = excluded.email,
      encrypted_password = excluded.encrypted_password,
      email_confirmed_at = coalesce(auth.users.email_confirmed_at, now()),
      confirmation_token = coalesce(auth.users.confirmation_token, ''),
      recovery_token = coalesce(auth.users.recovery_token, '');
  `);

  await runSupabaseQuery(`
    insert into auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    )
    values (
      '${QA_DENIED_SCANNER_ID}'::uuid,
      '${QA_DENIED_SCANNER_ID}'::uuid,
      jsonb_build_object('sub', '${QA_DENIED_SCANNER_ID}', 'email', '${QA_DENIED_SCANNER_EMAIL}'),
      'email',
      '${QA_DENIED_SCANNER_ID}',
      now(),
      now(),
      now()
    )
    on conflict (provider_id, provider) do update
    set
      user_id = excluded.user_id,
      identity_data = excluded.identity_data,
      updated_at = now();
  `);

  await runSupabaseQuery(`
    insert into public.profiles (id, email, is_platform_admin)
    values (
      '${QA_DENIED_SCANNER_ID}'::uuid,
      '${QA_DENIED_SCANNER_EMAIL}',
      false
    )
    on conflict (id) do update
    set
      email = excluded.email,
      is_platform_admin = false;
  `);
}

async function signInWithPassword(
  apiUrl: string,
  anonKey: string,
  email: string,
  password: string,
  label: string,
): Promise<SupabaseClient> {
  const client = createClient(apiUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session) {
    failAndExit(
      `Could not sign in as ${label} (${email}).`,
      'Run: npm run qa:seed\nThen retry: npm run smoke:checkin',
    );
  }

  return client;
}

async function signInOrganizer(apiUrl: string, anonKey: string): Promise<SupabaseClient> {
  await ensureQaOrganizerGoTrueReady();

  return signInWithPassword(
    apiUrl,
    anonKey,
    QA_ORGANIZER_EMAIL,
    QA_ORGANIZER_PASSWORD,
    'QA organizer',
  );
}

async function callValidatePass(
  client: SupabaseClient,
  secureToken: string,
  eventId: string,
): Promise<ValidatePassResponse> {
  const { data, error } = await client.rpc('validate_pass', {
    p_secure_token: secureToken,
    p_event_id: eventId,
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data || typeof data !== 'object' || !('result' in data)) {
    throw new Error('Unexpected validate_pass response');
  }

  return data as ValidatePassResponse;
}

function printResultsTable(results: SmokeCaseResult[]): void {
  console.log('\n=== Check-in smoke results ===\n');
  console.log(`${'Case'.padEnd(28)} ${'Expected'.padEnd(14)} ${'Actual'.padEnd(14)} Result`);
  console.log('-'.repeat(72));

  for (const row of results) {
    console.log(
      `${row.caseName.padEnd(28)} ${row.expected.padEnd(14)} ${row.actual.padEnd(14)} ${row.ok ? 'PASS' : 'FAIL'}`,
    );

    if (row.detail) {
      console.log(`  ${row.detail}`);
    }
  }
}

async function main(): Promise<void> {
  console.log('808Tix local check-in smoke (validate_pass)\n');

  const fixtures = loadFixtures();
  const passToken0 = fixtures.pass_tokens[0];
  const passToken1 = fixtures.pass_tokens[1];
  const eventId = fixtures.event_id;

  console.log(`event_id: ${eventId}`);
  console.log(`pass_token[0]: ${maskToken(passToken0)}`);
  if (passToken1) {
    console.log(`pass_token[1]: ${maskToken(passToken1)}`);
  }

  const { apiUrl, anonKey } = await loadLocalSupabaseEnv();
  console.log(`Using local Supabase: ${apiUrl}\n`);

  const pass0Before = await getPassStatusByToken(passToken0);
  if (!pass0Before) {
    failAndExit(
      `Fixture pass ${maskToken(passToken0)} was not found in local database.`,
      'Run: npm run qa:seed',
    );
  }

  if (pass0Before.status === 'checked_in') {
    failAndExit(
      `Fixture pass ${maskToken(passToken0)} is already checked_in.`,
      'Run npm run qa:seed before rerunning smoke:checkin.',
    );
  }

  if (passToken1) {
    const pass1Before = await getPassStatusByToken(passToken1);
    if (pass1Before?.status === 'checked_in') {
      failAndExit(
        `Fixture pass ${maskToken(passToken1)} is already checked_in.`,
        'Run npm run qa:seed before rerunning smoke:checkin.',
      );
    }
  }

  await ensureWrongEventFixture();
  await ensureDeniedScannerUser();

  const client = await signInOrganizer(apiUrl, anonKey);
  const results: SmokeCaseResult[] = [];

  // A. Valid check-in
  let validResponse: ValidatePassResponse;
  try {
    validResponse = await callValidatePass(client, passToken0, eventId);
  } catch (error) {
    results.push({
      caseName: 'Valid check-in',
      expected: 'valid',
      actual: 'rpc_error',
      ok: false,
      detail: String(error),
    });
    printResultsTable(results);
    process.exit(1);
  }

  const pass0AfterValid = validResponse.pass_id
    ? await getPassStatusByToken(passToken0)
    : pass0Before;
  const checkinsAfterValid = validResponse.pass_id
    ? await getCheckinCounts(validResponse.pass_id, eventId)
    : { valid_count: 0, already_used_count: 0, total_count: 0 };

  const validOk =
    validResponse.result === 'valid' &&
    pass0AfterValid?.status === 'checked_in' &&
    checkinsAfterValid.valid_count === 1 &&
    checkinsAfterValid.already_used_count === 0;

  results.push({
    caseName: 'Valid check-in',
    expected: 'valid',
    actual: validResponse.result,
    ok: validOk,
    detail: validOk
      ? `pass status=${pass0AfterValid?.status}, checkins valid=${checkinsAfterValid.valid_count}`
      : `pass status=${pass0AfterValid?.status ?? 'unknown'}, checkins valid=${checkinsAfterValid.valid_count}, already_used=${checkinsAfterValid.already_used_count}`,
  });

  // B. Duplicate scan
  let duplicateResponse: ValidatePassResponse;
  try {
    duplicateResponse = await callValidatePass(client, passToken0, eventId);
  } catch (error) {
    results.push({
      caseName: 'Duplicate scan',
      expected: 'already_used',
      actual: 'rpc_error',
      ok: false,
      detail: String(error),
    });
    printResultsTable(results);
    process.exit(1);
  }

  const checkinsAfterDuplicate = validResponse.pass_id
    ? await getCheckinCounts(validResponse.pass_id, eventId)
    : { valid_count: 0, already_used_count: 0, total_count: 0 };

  const duplicateOk =
    duplicateResponse.result === 'already_used' &&
    checkinsAfterDuplicate.valid_count === 1 &&
    checkinsAfterDuplicate.already_used_count === 1;

  results.push({
    caseName: 'Duplicate scan',
    expected: 'already_used',
    actual: duplicateResponse.result,
    ok: duplicateOk,
    detail: duplicateOk
      ? `checkins valid=${checkinsAfterDuplicate.valid_count}, already_used=${checkinsAfterDuplicate.already_used_count}`
      : `checkins valid=${checkinsAfterDuplicate.valid_count}, already_used=${checkinsAfterDuplicate.already_used_count}, total=${checkinsAfterDuplicate.total_count}`,
  });

  // C. Invalid token
  let invalidResponse: ValidatePassResponse;
  try {
    invalidResponse = await callValidatePass(client, 'not-a-real-token', eventId);
  } catch (error) {
    results.push({
      caseName: 'Invalid token',
      expected: 'invalid',
      actual: 'rpc_error',
      ok: false,
      detail: String(error),
    });
    printResultsTable(results);
    process.exit(1);
  }

  results.push({
    caseName: 'Invalid token',
    expected: 'invalid',
    actual: invalidResponse.result,
    ok: invalidResponse.result === 'invalid',
  });

  // D. Wrong event
  let wrongEventResponse: ValidatePassResponse;
  try {
    wrongEventResponse = await callValidatePass(client, passToken0, WRONG_EVENT_ID);
  } catch (error) {
    results.push({
      caseName: 'Wrong event',
      expected: 'wrong_event',
      actual: 'rpc_error',
      ok: false,
      detail: String(error),
    });
    printResultsTable(results);
    process.exit(1);
  }

  results.push({
    caseName: 'Wrong event',
    expected: 'wrong_event',
    actual: wrongEventResponse.result,
    ok: wrongEventResponse.result === 'wrong_event',
  });

  // E. Second fresh pass (organizer)
  if (passToken1) {
    let secondValidResponse: ValidatePassResponse;
    try {
      secondValidResponse = await callValidatePass(client, passToken1, eventId);
    } catch (error) {
      results.push({
        caseName: 'Second pass check-in',
        expected: 'valid',
        actual: 'rpc_error',
        ok: false,
        detail: String(error),
      });
      printResultsTable(results);
      process.exit(1);
    }

    const pass1After = await getPassStatusByToken(passToken1);
    const secondOk =
      secondValidResponse.result === 'valid' && pass1After?.status === 'checked_in';

    results.push({
      caseName: 'Second pass check-in',
      expected: 'valid',
      actual: secondValidResponse.result,
      ok: secondOk,
      detail: secondOk ? `pass status=${pass1After?.status}` : `pass status=${pass1After?.status ?? 'unknown'}`,
    });
  }

  // F. Platform admin can load event stats + already_used authorize path
  const adminClient = await signInWithPassword(
    apiUrl,
    anonKey,
    QA_PLATFORM_ADMIN_EMAIL,
    QA_PLATFORM_ADMIN_PASSWORD,
    'platform admin',
  );

  const { data: adminEventRow, error: adminEventError } = await adminClient
    .from('events')
    .select('id,name')
    .eq('id', eventId)
    .maybeSingle();

  results.push({
    caseName: 'Platform admin event load',
    expected: 'found',
    actual: adminEventRow?.id === eventId ? 'found' : 'missing',
    ok: !adminEventError && adminEventRow?.id === eventId,
    detail: adminEventError?.message,
  });

  const { data: adminStats, error: adminStatsError } = await adminClient.rpc('get_event_stats', {
    p_event_id: eventId,
  });

  results.push({
    caseName: 'Platform admin get_event_stats',
    expected: 'ok',
    actual: adminStatsError ? 'rpc_error' : 'ok',
    ok: !adminStatsError && adminStats && typeof adminStats === 'object',
    detail: adminStatsError?.message,
  });

  let adminAlreadyUsed: ValidatePassResponse;
  try {
    adminAlreadyUsed = await callValidatePass(adminClient, passToken0, eventId);
  } catch (error) {
    results.push({
      caseName: 'Platform admin already_used',
      expected: 'already_used',
      actual: 'rpc_error',
      ok: false,
      detail: String(error),
    });
    printResultsTable(results);
    process.exit(1);
  }

  results.push({
    caseName: 'Platform admin already_used',
    expected: 'already_used',
    actual: adminAlreadyUsed.result,
    ok:
      adminAlreadyUsed.result === 'already_used' &&
      typeof adminAlreadyUsed.pass_id === 'string' &&
      adminAlreadyUsed.pass_id.length > 0,
    detail:
      adminAlreadyUsed.result === 'already_used'
        ? 'authorized platform admin received normal already_used payload'
        : 'platform admin was not authorized or unexpected result',
  });

  // G. Non-owner non-admin unauthorized → PII-free invalid
  const deniedClient = await signInWithPassword(
    apiUrl,
    anonKey,
    QA_DENIED_SCANNER_EMAIL,
    QA_DENIED_SCANNER_PASSWORD,
    'denied scanner',
  );

  let deniedResponse: ValidatePassResponse;
  try {
    deniedResponse = await callValidatePass(deniedClient, passToken0, eventId);
  } catch (error) {
    results.push({
      caseName: 'Unauthorized non-owner',
      expected: 'invalid',
      actual: 'rpc_error',
      ok: false,
      detail: String(error),
    });
    printResultsTable(results);
    process.exit(1);
  }

  const deniedKeys = Object.keys(deniedResponse).sort();
  const deniedPiiFree =
    deniedResponse.result === 'invalid' &&
    deniedKeys.length === 1 &&
    deniedKeys[0] === 'result' &&
    deniedResponse.pass_id === undefined &&
    deniedResponse.guest_name === undefined;

  results.push({
    caseName: 'Unauthorized non-owner',
    expected: 'invalid',
    actual: deniedResponse.result,
    ok: deniedPiiFree,
    detail: deniedPiiFree
      ? 'PII-free invalid payload'
      : `keys=${deniedKeys.join(',')}`,
  });

  const { data: deniedEventRow, error: deniedEventError } = await deniedClient
    .from('events')
    .select('id')
    .eq('id', eventId)
    .maybeSingle();

  results.push({
    caseName: 'Denied scanner event load',
    expected: 'missing',
    actual: deniedEventRow?.id ? 'found' : 'missing',
    ok: !deniedEventError && !deniedEventRow,
  });

  // H. Anon cannot call validate_pass
  const anonClient = createClient(apiUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { error: anonError } = await anonClient.rpc('validate_pass', {
    p_secure_token: passToken0,
    p_event_id: eventId,
  });

  results.push({
    caseName: 'Anon validate_pass blocked',
    expected: 'error',
    actual: anonError ? 'error' : 'ok',
    ok: Boolean(anonError),
    detail: anonError?.message,
  });

  printResultsTable(results);

  const failed = results.filter((row) => !row.ok);
  if (failed.length > 0) {
    console.error(`\nFAIL: ${failed.length} check-in smoke case(s) failed.`);
    process.exit(1);
  }

  console.log('\nPASS: check-in smoke completed (validate_pass backend path).');
}

main().catch((error) => {
  console.error('\nFAIL: smoke-checkin error:', error);
  process.exit(1);
});
