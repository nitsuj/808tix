#!/usr/bin/env npx tsx
/**
 * Validates local admin QA prerequisites, prints the three admin QA lanes,
 * and opens the local real-data admin URL only when safe.
 *
 * Usage:
 *   npm run qa:admin
 */
import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();

const DESIGN_REVIEW_URL = 'http://localhost:8081/design/admin-dashboard-review';
const LOCAL_ADMIN_URL = 'http://localhost:8081/admin?qaAdmin=1';
const HOSTED_ADMIN_URL = 'https://808tickets.com/admin';

const QA_ADMIN_EMAIL = 'platform-admin@808tix.test';
const QA_ADMIN_PASSWORD = 'qa-admin-password';
const QA_ADMIN_ID = 'a1000001-0000-4000-8000-000000000099';

type CheckResult = { ok: boolean; label: string; fix?: string };

function parseEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const values: Record<string, string> = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, '');
    values[key] = value;
  }
  return values;
}

function isLocalSupabaseUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === '127.0.0.1' ||
      parsed.hostname === 'localhost' ||
      parsed.hostname.endsWith('.local')
    );
  } catch {
    return false;
  }
}

async function probeLocalWeb(): Promise<boolean> {
  try {
    const response = await fetch('http://localhost:8081/', {
      method: 'GET',
      signal: AbortSignal.timeout(2000),
    });
    return response.ok || response.status === 404;
  } catch {
    return false;
  }
}

async function supabaseStatusRunning(): Promise<boolean> {
  try {
    await execFileAsync('supabase', ['status', '-o', 'env'], { maxBuffer: 2 * 1024 * 1024 });
    return true;
  } catch {
    return false;
  }
}

function parseJsonRows(output: string): Record<string, unknown>[] {
  const start = output.indexOf('{');
  if (start === -1) return [];
  try {
    const parsed = JSON.parse(output.slice(start)) as { rows?: Record<string, unknown>[] };
    return parsed.rows ?? [];
  } catch {
    return [];
  }
}

async function queryLocalAdminState(): Promise<{
  userExists: boolean;
  identityCount: number;
  profileExists: boolean;
  isPlatformAdmin: boolean;
} | null> {
  try {
    const { stdout } = await execFileAsync(
      'supabase',
      [
        'db',
        'query',
        `
select
  exists(select 1 from auth.users where id = '${QA_ADMIN_ID}'::uuid) as user_exists,
  (select count(*)::int from auth.identities where user_id = '${QA_ADMIN_ID}'::uuid) as identity_count,
  exists(select 1 from public.profiles where id = '${QA_ADMIN_ID}'::uuid) as profile_exists,
  coalesce((select is_platform_admin from public.profiles where id = '${QA_ADMIN_ID}'::uuid), false) as is_platform_admin;
`,
        '--local',
      ],
      { maxBuffer: 4 * 1024 * 1024 },
    );
    const rows = parseJsonRows(stdout);
    const row = rows[0];
    if (!row) return null;
    return {
      userExists: Boolean(row.user_exists),
      identityCount: Number(row.identity_count ?? 0),
      profileExists: Boolean(row.profile_exists),
      isPlatformAdmin: Boolean(row.is_platform_admin),
    };
  } catch {
    return null;
  }
}

async function probePasswordGrant(
  supabaseUrl: string,
  anonKey: string,
): Promise<{ ok: boolean; message: string }> {
  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: QA_ADMIN_EMAIL, password: QA_ADMIN_PASSWORD }),
      signal: AbortSignal.timeout(8000),
    });
    const body = (await response.json().catch(() => ({}))) as {
      access_token?: string;
      msg?: string;
      message?: string;
      error_code?: string;
      code?: number | string;
    };
    if (response.ok && body.access_token) {
      return { ok: true, message: 'password grant succeeded' };
    }
    return {
      ok: false,
      message: body.msg || body.message || `HTTP ${response.status} ${body.error_code ?? ''}`.trim(),
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main() {
  const dotenv = parseEnvFile(join(ROOT, '.env'));
  const supabaseUrl =
    process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() || dotenv.EXPO_PUBLIC_SUPABASE_URL?.trim() || '';
  const anonKey =
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    dotenv.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    '';
  const localSupabase = supabaseUrl ? isLocalSupabaseUrl(supabaseUrl) : false;
  const webUp = await probeLocalWeb();
  const supabaseRunning = await supabaseStatusRunning();
  const adminState = supabaseRunning ? await queryLocalAdminState() : null;
  const passwordGrant =
    localSupabase && anonKey
      ? await probePasswordGrant(supabaseUrl, anonKey)
      : { ok: false, message: 'skipped (need local Supabase URL + anon key)' };

  console.log('\n808Tickets admin QA lanes\n');
  console.log('1) Design review (mock data, no auth)');
  console.log(`   ${DESIGN_REVIEW_URL}`);
  console.log('   Visual layout only — not live RPCs.\n');
  console.log('2) Local real-data admin QA (localhost + local Supabase)');
  console.log(`   ${LOCAL_ADMIN_URL}`);
  console.log(`   Account: ${QA_ADMIN_EMAIL} / ${QA_ADMIN_PASSWORD}`);
  console.log('   Uses normal Auth sign-in; admin RPCs still require is_platform_admin.');
  console.log('   Seed first: npm run qa:seed\n');
  console.log('3) Hosted production admin (real auth, no bypass)');
  console.log(`   ${HOSTED_ADMIN_URL}`);
  console.log('   Platform-admin session required. No auto-login.\n');

  const checks: CheckResult[] = [
    {
      ok: supabaseRunning,
      label: 'Local Supabase running',
      fix: 'supabase start',
    },
    {
      ok: Boolean(supabaseUrl) && localSupabase,
      label: 'Shell/app env points at local Supabase',
      fix: 'npm run qa:admin:local',
    },
    {
      ok: Boolean(adminState?.userExists),
      label: `Auth user ${QA_ADMIN_EMAIL} exists`,
      fix: 'npm run qa:admin:local',
    },
    {
      ok: Boolean(adminState && adminState.identityCount > 0),
      label: 'auth.identities row exists for platform admin',
      fix: 'npm run qa:admin:local',
    },
    {
      ok: Boolean(adminState?.profileExists),
      label: 'public.profiles row exists',
      fix: 'npm run qa:admin:local',
    },
    {
      ok: Boolean(adminState?.isPlatformAdmin),
      label: 'profiles.is_platform_admin = true',
      fix: 'npm run qa:admin:local',
    },
    {
      ok: passwordGrant.ok,
      label: `Auth password grant works (${passwordGrant.message})`,
      fix: 'npm run qa:admin:local',
    },
    {
      ok: webUp,
      label: 'Expo web reachable on localhost:8081',
      fix: 'npm run qa:admin:local',
    },
  ];

  console.log('Prerequisite check:');
  let allOk = true;
  for (const check of checks) {
    console.log(`  ${check.ok ? '✓' : '✗'} ${check.label}`);
    if (!check.ok) {
      allOk = false;
      if (check.fix) console.log(`      Fix: ${check.fix}`);
    }
  }

  console.log('\nFor full setup, run: npm run qa:admin:local');
  console.log('(That starts local Supabase, migrates, seeds, launches Expo with local env, and opens admin.)\n');

  console.log('Lightweight path (everything already running):');
  console.log('  npm run qa:admin\n');

  if (!allOk) {
    console.log('Not opening browser — fix prerequisites above, or run: npm run qa:admin:local');
    process.exitCode = 1;
    return;
  }

  try {
    if (process.platform === 'darwin') {
      await execFileAsync('open', [LOCAL_ADMIN_URL]);
      console.log(`Opened ${LOCAL_ADMIN_URL}`);
    } else if (process.platform === 'linux') {
      await execFileAsync('xdg-open', [LOCAL_ADMIN_URL]);
      console.log(`Opened ${LOCAL_ADMIN_URL}`);
    } else {
      console.log(`Open manually: ${LOCAL_ADMIN_URL}`);
    }
  } catch {
    console.log(`Could not auto-open browser. Open manually: ${LOCAL_ADMIN_URL}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
