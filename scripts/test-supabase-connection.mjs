/**
 * Node CLI connection test (no Expo runtime required).
 * Usage: npm run test:supabase
 * Reads .env from project root for EXPO_PUBLIC_* vars.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

function loadEnvFile(path) {
  if (!existsSync(path)) {
    return;
  }

  const contents = readFileSync(path, 'utf8');

  for (const line of contents.split('\n')) {
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

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(resolve(process.cwd(), '.env'));

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env.',
  );
  process.exit(1);
}

const supabase = createClient(url, anonKey);

const { data, error } = await supabase.rpc('get_pass_by_token', {
  p_secure_token: '__808tix_connection_test__',
});

if (error) {
  console.error(`FAIL: ${error.message}`);
  process.exit(1);
}

if (data !== null) {
  console.error('FAIL: unexpected pass data for connection test token');
  process.exit(1);
}

console.log('OK: Connected to Supabase. get_pass_by_token RPC is reachable.');
