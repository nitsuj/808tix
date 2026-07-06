#!/usr/bin/env npx tsx
/**
 * Print copy-pasteable shell exports for local Expo + Supabase QA.
 *
 * Usage:
 *   npm run qa:env
 *   npm run qa:env -- --exports-only
 *   npm run qa:env -- --eval
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

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

async function loadLocalSupabaseEnv(): Promise<Record<string, string>> {
  try {
    const { stdout } = await execFileAsync('supabase', ['status', '-o', 'env'], {
      maxBuffer: 10 * 1024 * 1024,
    });
    return parseStatusEnv(stdout);
  } catch {
    console.error('Local Supabase is not running.');
    console.error('Next action: run `supabase start` and retry.');
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const exportsOnly = args.has('--exports-only');
  const evalMode = args.has('--eval');

  const statusEnv = await loadLocalSupabaseEnv();
  const apiUrl = statusEnv.API_URL?.trim();
  const anonKey = statusEnv.ANON_KEY?.trim();

  if (!apiUrl || !anonKey) {
    console.error('API_URL or ANON_KEY missing from `supabase status -o env`.');
    console.error('Next action: run `supabase start` and retry.');
    process.exit(1);
  }

  if (exportsOnly) {
    console.log(
      `unset EXPO_PUBLIC_SUPABASE_URL; unset EXPO_PUBLIC_SUPABASE_ANON_KEY; export EXPO_PUBLIC_SUPABASE_URL="${apiUrl}"; export EXPO_PUBLIC_SUPABASE_ANON_KEY="${anonKey}"`,
    );
    return;
  }

  if (evalMode) {
    console.log('Paste this in your current terminal to apply local Expo Supabase env:\n');
    console.log('eval "$(npm run -s qa:env -- --exports-only)"\n');
    console.log('Then run:\n');
    console.log('npm run qa:seed');
    console.log('npm run qa:web');
    return;
  }

  console.log('808Tix local Expo Supabase env\n');
  console.log(
    'npm scripts cannot modify your parent shell. Copy/paste the commands below into the terminal where you run QA.\n',
  );

  console.log('unset EXPO_PUBLIC_SUPABASE_URL');
  console.log('unset EXPO_PUBLIC_SUPABASE_ANON_KEY');
  console.log('');
  console.log(`export EXPO_PUBLIC_SUPABASE_URL="${apiUrl}"`);
  console.log(`export EXPO_PUBLIC_SUPABASE_ANON_KEY="${anonKey}"`);
  console.log('');
  console.log('npm run qa:seed');
  console.log('npm run qa:web');
  console.log('');
  console.log('One-liner (eval-safe):');
  console.log('eval "$(npm run -s qa:env -- --exports-only)"');
}

main().catch((error) => {
  console.error('qa:env failed:', error);
  process.exit(1);
});
