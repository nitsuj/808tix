#!/usr/bin/env npx tsx
/**
 * Prints the three admin QA lanes and opens the local real-data admin URL when safe.
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
    const response = await fetch('http://localhost:8081/', { method: 'GET', signal: AbortSignal.timeout(2000) });
    return response.ok || response.status === 404;
  } catch {
    return false;
  }
}

async function main() {
  const dotenv = parseEnvFile(join(ROOT, '.env'));
  const supabaseUrl =
    process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() || dotenv.EXPO_PUBLIC_SUPABASE_URL?.trim() || '';
  const localSupabase = supabaseUrl ? isLocalSupabaseUrl(supabaseUrl) : false;
  const webUp = await probeLocalWeb();

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

  console.log('Environment check:');
  if (!supabaseUrl) {
    console.log('  ✗ EXPO_PUBLIC_SUPABASE_URL not set (.env)');
  } else if (localSupabase) {
    console.log(`  ✓ Local Supabase URL: ${supabaseUrl}`);
  } else {
    console.log(`  ✗ Supabase URL is not local: ${supabaseUrl}`);
    console.log('    Local admin QA auto-login will not enable against hosted Supabase.');
  }
  console.log(webUp ? '  ✓ Local web server responding on :8081' : '  ✗ Local web server not reachable on :8081');
  if (!webUp) {
    console.log('    Start with: npm run web');
  }

  console.log('\nSuggested flow:');
  console.log('  1. supabase start  (Docker required)');
  console.log('  2. Point Expo at local Supabase: npm run qa:env  (export those vars / update .env)');
  console.log('  3. npm run qa:seed');
  console.log('  4. npm run web');
  console.log('  5. open local admin URL (or click Continue as local platform admin)');
  console.log('  6. Screenshots: npx tsx scripts/capture-admin-dashboard-screenshots.ts\n');

  if (!localSupabase && supabaseUrl) {
    console.log('Note: local admin auto-login stays OFF while EXPO_PUBLIC_SUPABASE_URL is hosted.');
    console.log('      That is intentional — use local Supabase for lane 2.\n');
  }

  if (webUp && localSupabase) {
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
  } else {
    console.log('Skipping auto-open until local web + local Supabase are ready.');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
