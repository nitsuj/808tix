#!/usr/bin/env npx tsx
/**
 * One-command local admin QA orchestrator.
 *
 * Usage:
 *   npm run qa:admin:local
 *   npm run qa:admin:local -- --screenshots
 *   npm run qa:admin:local -- --keep-web
 *
 * Starts/verifies local Supabase, migrates, seeds, launches Expo web with
 * local Supabase env (deterministic — does not rely on parent-shell exports),
 * opens /admin?qaAdmin=1, and keeps Expo running until Ctrl-C.
 */
import { spawn, execFile, type ChildProcess } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();

const DESIGN_REVIEW_URL = 'http://localhost:8081/design/admin-dashboard-review';
const LOCAL_ADMIN_URL = 'http://localhost:8081/admin?qaAdmin=1';
const HOSTED_ADMIN_URL = 'https://808tickets.com/admin';
const WEB_ORIGIN = 'http://localhost:8081';
const WEB_PORT = 8081;

const QA_ADMIN_EMAIL = 'platform-admin@808tix.test';
const QA_ADMIN_PASSWORD = 'qa-admin-password';
const QA_ADMIN_ID = 'a1000001-0000-4000-8000-000000000099';

type LocalEnv = {
  EXPO_PUBLIC_SUPABASE_URL: string;
  EXPO_PUBLIC_SUPABASE_ANON_KEY: string;
};

type PortListener = {
  pid: number;
  command: string;
};

let expoChild: ChildProcess | null = null;
let shuttingDown = false;

function fail(message: string, exitCode = 1): never {
  console.error(`\nFAIL: ${message}\n`);
  process.exit(exitCode);
}

function parseArgs(argv: string[]) {
  return {
    screenshots: argv.includes('--screenshots'),
    keepWeb: argv.includes('--keep-web'),
    restartWeb: argv.includes('--restart-web') || !argv.includes('--keep-web'),
  };
}

function parseStatusEnv(stdout: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const line of stdout.split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)="(.*)"/);
    if (match) values[match[1]] = match[2];
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

async function ensureSupabaseCli(): Promise<void> {
  try {
    await execFileAsync('supabase', ['--version']);
  } catch {
    fail('Supabase CLI not found. Install: https://supabase.com/docs/guides/cli');
  }
}

async function ensureDockerReachable(): Promise<void> {
  try {
    await execFileAsync('docker', ['info'], { maxBuffer: 2 * 1024 * 1024 });
  } catch {
    fail('Docker is not running. Start Docker, then rerun npm run qa:admin:local.');
  }
}

async function ensureLocalSupabaseRunning(): Promise<void> {
  try {
    await execFileAsync('supabase', ['status', '-o', 'env'], { maxBuffer: 2 * 1024 * 1024 });
    console.log('✓ Local Supabase already running');
    return;
  } catch {
    console.log('Local Supabase not running — starting…');
  }

  try {
    await execFileAsync('supabase', ['start'], {
      maxBuffer: 20 * 1024 * 1024,
      cwd: ROOT,
    });
    console.log('✓ Local Supabase started');
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    fail(
      `Local Supabase failed to start. Run supabase status --debug and check Docker.\n${detail}`,
    );
  }
}

async function resolveLocalExpoEnv(): Promise<LocalEnv> {
  let stdout: string;
  try {
    ({ stdout } = await execFileAsync('supabase', ['status', '-o', 'env'], {
      maxBuffer: 10 * 1024 * 1024,
    }));
  } catch {
    fail('Could not read local Supabase env. Run: supabase start');
  }

  const statusEnv = parseStatusEnv(stdout);
  const apiUrl = statusEnv.API_URL?.trim();
  const anonKey = statusEnv.ANON_KEY?.trim();

  if (!apiUrl || !anonKey) {
    fail('API_URL or ANON_KEY missing from `supabase status -o env`. Run: supabase start');
  }
  if (!isLocalSupabaseUrl(apiUrl)) {
    fail(`Refusing non-local Supabase URL from supabase status: ${apiUrl}`);
  }

  console.log(`✓ Using local Supabase: ${apiUrl}`);
  return {
    EXPO_PUBLIC_SUPABASE_URL: apiUrl,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: anonKey,
  };
}

async function runMigrationUp(): Promise<void> {
  try {
    const { stdout, stderr } = await execFileAsync(
      'supabase',
      ['migration', 'up', '--local'],
      { maxBuffer: 10 * 1024 * 1024, cwd: ROOT },
    );
    const combined = `${stdout}\n${stderr}`.trim();
    if (combined) console.log(combined.split('\n').slice(-5).join('\n'));
    console.log('✓ Local migrations applied');
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    fail(`Local migrations failed. Fix migration error above, then rerun npm run qa:admin:local.\n${detail}`);
  }
}

async function reloadPostgrestSchema(): Promise<void> {
  try {
    await execFileAsync(
      'supabase',
      ['db', 'query', "notify pgrst, 'reload schema';", '--local'],
      { maxBuffer: 2 * 1024 * 1024, cwd: ROOT },
    );
    console.log('✓ PostgREST schema reloaded');
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    fail(
      `PostgREST schema reload failed. Rerun: supabase db query "notify pgrst, 'reload schema';" --local\n${detail}`,
    );
  }
}

async function runQaSeed(localEnv: LocalEnv): Promise<void> {
  try {
    await execFileAsync('npm', ['run', 'qa:seed'], {
      cwd: ROOT,
      maxBuffer: 20 * 1024 * 1024,
      env: {
        ...process.env,
        ...localEnv,
      },
    });
    console.log('✓ QA seed completed');
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    fail(`QA seed failed. Fix npm run qa:seed output, then rerun npm run qa:admin:local.\n${detail}`);
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
    const row = parseJsonRows(stdout)[0];
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

async function validateAdminPrereqs(localEnv: LocalEnv): Promise<void> {
  const state = await queryLocalAdminState();
  if (!state?.userExists) {
    fail(`Local QA admin user missing (${QA_ADMIN_EMAIL}). npm run qa:seed should create auth.users.`);
  }
  if (!state || state.identityCount < 1) {
    fail(
      'Local QA admin identity missing. npm run qa:seed should create auth.identities; inspect seed script.',
    );
  }
  if (!state.profileExists) {
    fail('Local QA admin profile missing. Run: npm run qa:seed');
  }
  if (!state.isPlatformAdmin) {
    fail('Local QA admin profile exists but is_platform_admin is false. Run: npm run qa:seed');
  }

  const grant = await probePasswordGrant(
    localEnv.EXPO_PUBLIC_SUPABASE_URL,
    localEnv.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  );
  if (!grant.ok) {
    fail(
      `Local QA admin password grant failed (${grant.message}). Re-run npm run qa:seed; auth.users/auth.identities may be mismatched.`,
    );
  }
  console.log('✓ Local platform admin Auth + profile prerequisites OK');
}

async function listPortListeners(port: number): Promise<PortListener[]> {
  try {
    const { stdout } = await execFileAsync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN'], {
      maxBuffer: 2 * 1024 * 1024,
    });
    const lines = stdout.trim().split('\n').slice(1);
    const listeners: PortListener[] = [];
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 2) continue;
      const command = parts[0] ?? '';
      const pid = Number(parts[1]);
      if (!Number.isFinite(pid)) continue;
      listeners.push({ pid, command });
    }
    return listeners;
  } catch {
    return [];
  }
}

function looksLikeExpoProcess(listener: PortListener): boolean {
  const cmd = listener.command.toLowerCase();
  if (cmd.includes('node') || cmd.includes('expo') || cmd.includes('metro')) return true;
  try {
    const args = readFileSync(`/proc/${listener.pid}/cmdline`, 'utf8');
    return /expo|metro|react-native/i.test(args);
  } catch {
    // macOS: use ps
  }
  try {
    // sync-ish via later await — handled in caller with ps
  } catch {
    // ignore
  }
  return cmd === 'node';
}

async function processCommandLine(pid: number): Promise<string> {
  try {
    const { stdout } = await execFileAsync('ps', ['-p', String(pid), '-o', 'command='], {
      maxBuffer: 1024 * 1024,
    });
    return stdout.trim();
  } catch {
    return '';
  }
}

async function isExpoLikeListener(listener: PortListener): Promise<boolean> {
  if (looksLikeExpoProcess(listener)) {
    const cmdline = await processCommandLine(listener.pid);
    if (!cmdline) return true;
    return /expo|metro|node_modules\/\.bin\/expo|react-native|@expo\/cli/i.test(cmdline);
  }
  const cmdline = await processCommandLine(listener.pid);
  return /expo|metro|@expo\/cli/i.test(cmdline);
}

async function stopExpoListeners(listeners: PortListener[]): Promise<void> {
  for (const listener of listeners) {
    const expoLike = await isExpoLikeListener(listener);
    if (!expoLike) {
      fail(
        `Port ${WEB_PORT} is in use by a non-Expo process (pid ${listener.pid}, ${listener.command}). Stop it or free the port, then rerun npm run qa:admin:local.`,
      );
    }
  }

  for (const listener of listeners) {
    console.log(`Stopping Expo/Metro on :${WEB_PORT} (pid ${listener.pid})…`);
    try {
      process.kill(listener.pid, 'SIGTERM');
    } catch {
      // already gone
    }
  }

  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    const remaining = await listPortListeners(WEB_PORT);
    if (remaining.length === 0) return;
    await new Promise((r) => setTimeout(r, 250));
  }

  for (const listener of await listPortListeners(WEB_PORT)) {
    try {
      process.kill(listener.pid, 'SIGKILL');
    } catch {
      // ignore
    }
  }
}

async function probeWeb(): Promise<boolean> {
  try {
    const response = await fetch(WEB_ORIGIN, {
      method: 'GET',
      signal: AbortSignal.timeout(2000),
    });
    return response.ok || response.status === 404;
  } catch {
    return false;
  }
}

function buildChildEnv(localEnv: LocalEnv): NodeJS.ProcessEnv {
  // Deterministic: force local Supabase for the Expo child regardless of .env hosted values.
  // Expo/dotenv does not override already-set process env.
  const passLink =
    process.env.EXPO_PUBLIC_PASS_LINK_BASE_URL?.trim() ||
    (existsSync(join(ROOT, '.env'))
      ? (() => {
          for (const line of readFileSync(join(ROOT, '.env'), 'utf8').split('\n')) {
            const m = line.match(/^EXPO_PUBLIC_PASS_LINK_BASE_URL=(.*)$/);
            if (m) return m[1].trim().replace(/^["']|["']$/g, '');
          }
          return '';
        })()
      : '') ||
    WEB_ORIGIN;

  return {
    ...process.env,
    EXPO_PUBLIC_SUPABASE_URL: localEnv.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: localEnv.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    EXPO_PUBLIC_PASS_LINK_BASE_URL: passLink,
    BROWSER: 'none',
  };
}

async function startExpoWeb(localEnv: LocalEnv): Promise<void> {
  const childEnv = buildChildEnv(localEnv);
  if (!isLocalSupabaseUrl(childEnv.EXPO_PUBLIC_SUPABASE_URL ?? '')) {
    fail('Internal error: refusing to launch Expo without local Supabase URL.');
  }

  console.log('Starting Expo web with local Supabase env…');
  expoChild = spawn(
    'npx',
    ['expo', 'start', '--web', '--port', String(WEB_PORT)],
    {
      cwd: ROOT,
      env: childEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

  expoChild.stdout?.on('data', (chunk: Buffer) => {
    const text = chunk.toString();
    process.stdout.write(text);
  });
  expoChild.stderr?.on('data', (chunk: Buffer) => {
    const text = chunk.toString();
    process.stderr.write(text);
  });

  expoChild.on('exit', (code, signal) => {
    if (shuttingDown) return;
    fail(`Expo web exited unexpectedly (code=${code}, signal=${signal}).`);
  });
}

async function waitForWeb(timeoutMs = 120_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await probeWeb()) {
      console.log(`✓ Expo web reachable at ${WEB_ORIGIN}`);
      return;
    }
    if (expoChild?.exitCode != null) {
      fail('Expo web failed to start on 8081.');
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  fail('Expo web failed to start on 8081 (timeout waiting for http://localhost:8081).');
}

async function openAdminUrl(): Promise<void> {
  try {
    if (process.platform === 'darwin') {
      await execFileAsync('open', [LOCAL_ADMIN_URL]);
    } else if (process.platform === 'linux') {
      await execFileAsync('xdg-open', [LOCAL_ADMIN_URL]);
    } else {
      console.log(`Open manually: ${LOCAL_ADMIN_URL}`);
      return;
    }
    console.log(`✓ Opened ${LOCAL_ADMIN_URL}`);
  } catch {
    console.log(`Could not auto-open browser. Open manually: ${LOCAL_ADMIN_URL}`);
  }
}

async function runScreenshots(localEnv: LocalEnv): Promise<void> {
  console.log('Capturing authenticated admin screenshots…');
  try {
    await execFileAsync('npx', ['tsx', 'scripts/capture-admin-dashboard-screenshots.ts'], {
      cwd: ROOT,
      maxBuffer: 20 * 1024 * 1024,
      env: {
        ...process.env,
        ...localEnv,
        SCREENSHOT_BASE_URL: WEB_ORIGIN,
      },
    });
    console.log('✓ Screenshots written under qa/artifacts/screenshots/latest/');
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(`Screenshot capture failed (non-fatal): ${detail}`);
  }
}

function installSignalHandlers(): void {
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\nShutting down Expo (${signal})…`);
    if (expoChild && expoChild.exitCode == null) {
      expoChild.kill('SIGTERM');
      setTimeout(() => {
        if (expoChild && expoChild.exitCode == null) expoChild.kill('SIGKILL');
        process.exit(0);
      }, 3000);
    } else {
      process.exit(0);
    }
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

async function ensureWebServer(localEnv: LocalEnv, opts: { keepWeb: boolean; restartWeb: boolean }) {
  const listeners = await listPortListeners(WEB_PORT);

  if (listeners.length === 0) {
    await startExpoWeb(localEnv);
    return;
  }

  for (const listener of listeners) {
    if (!(await isExpoLikeListener(listener))) {
      fail(
        `Port 8081 is in use by a non-Expo process (pid ${listener.pid}, ${listener.command}). Stop it or free the port, then rerun npm run qa:admin:local.`,
      );
    }
  }

  if (opts.keepWeb && (await probeWeb())) {
    console.log(
      '⚠ Reusing existing Expo on :8081 (--keep-web). If it was started against hosted Supabase, local admin QA may fail — omit --keep-web to restart with local env.',
    );
    return;
  }

  if (opts.restartWeb) {
    await stopExpoListeners(listeners);
    await startExpoWeb(localEnv);
    return;
  }

  fail(
    'Port 8081 already has Expo. Rerun with default restart behavior, or pass --keep-web to reuse.',
  );
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  console.log('\n808Tickets qa:admin:local — full local admin QA setup\n');

  await ensureSupabaseCli();
  await ensureDockerReachable();
  await ensureLocalSupabaseRunning();
  const localEnv = await resolveLocalExpoEnv();
  await runMigrationUp();
  await reloadPostgrestSchema();
  await runQaSeed(localEnv);
  await validateAdminPrereqs(localEnv);
  await ensureWebServer(localEnv, opts);
  await waitForWeb();

  console.log('\nUseful URLs:');
  console.log(`  Local real admin:  ${LOCAL_ADMIN_URL}`);
  console.log(`  Design review:     ${DESIGN_REVIEW_URL}`);
  console.log(`  Hosted production: ${HOSTED_ADMIN_URL}`);
  console.log(`  Account: ${QA_ADMIN_EMAIL} / ${QA_ADMIN_PASSWORD}\n`);

  await openAdminUrl();

  if (opts.screenshots) {
    await runScreenshots(localEnv);
  }

  if (!expoChild) {
    console.log('Expo was reused (--keep-web). Script exiting; server remains running.');
    return;
  }

  installSignalHandlers();
  console.log('Expo web is running with local Supabase env. Press Ctrl-C to stop Expo (Supabase stays up).\n');

  await new Promise<void>(() => {
    // Keep process alive while Expo child runs.
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
