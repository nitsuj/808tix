#!/usr/bin/env npx tsx
/**
 * Auth response-shape smoke (does NOT prove inbox delivery).
 *
 * Calls Supabase Auth signup + recover endpoints with the configured anon key
 * and prints whether responses look healthy. Email delivery depends on hosted
 * SMTP (Resend) and must be verified manually — see docs/AUTH_EMAIL_RESEND.md.
 *
 * Usage:
 *   npm run smoke:auth:response
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();

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

function hydrateEnv(): void {
  const fromFile = parseEnvFile(join(ROOT, '.env'));
  for (const [key, value] of Object.entries(fromFile)) {
    if (!process.env[key]?.trim() && value.trim()) {
      process.env[key] = value;
    }
  }
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`Missing ${name}. Set it in .env or the environment.`);
    process.exit(1);
  }
  return value;
}

async function main(): Promise<void> {
  hydrateEnv();

  const supabaseUrl = requireEnv('EXPO_PUBLIC_SUPABASE_URL').replace(/\/+$/, '');
  const anonKey = requireEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  const stamp = Date.now();
  const signupEmail = `auth-smoke-signup-${stamp}@example.com`;
  const recoverEmail = `auth-smoke-recover-${stamp}@example.com`;
  const redirectTo =
    process.env.EXPO_PUBLIC_PASS_LINK_BASE_URL?.trim().replace(/\/+$/, '') ||
    'https://808tickets.com';

  console.log('808Tix auth response-shape smoke');
  console.log(`Supabase: ${supabaseUrl}`);
  console.log(`redirectTo: ${redirectTo}/`);
  console.log('');
  console.log(
    'NOTE: A 2xx Auth response does NOT prove the message reached an inbox.',
  );
  console.log('Confirm delivery via Resend + mailbox — docs/AUTH_EMAIL_RESEND.md');
  console.log('');

  const signupResponse = await fetch(`${supabaseUrl}/auth/v1/signup`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: signupEmail,
      password: 'password123',
      data: {},
      gotrue_meta_security: {},
      code_challenge: null,
      code_challenge_method: null,
      // emailRedirectTo is sent by client as options; GoTrue accepts redirect_to query.
    }),
  });

  const signupText = await signupResponse.text();
  console.log(`[signup] HTTP ${signupResponse.status}`);
  console.log(signupText.slice(0, 500));
  console.log('');

  const recoverUrl = new URL(`${supabaseUrl}/auth/v1/recover`);
  recoverUrl.searchParams.set('redirect_to', `${redirectTo}/`);

  const recoverResponse = await fetch(recoverUrl.toString(), {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email: recoverEmail }),
  });

  const recoverText = await recoverResponse.text();
  console.log(`[recover] HTTP ${recoverResponse.status}`);
  console.log(recoverText.slice(0, 500) || '(empty body)');
  console.log('');

  const signupOk = signupResponse.ok;
  const recoverOk = recoverResponse.ok;

  if (!signupOk || !recoverOk) {
    console.error('FAIL: Auth endpoint response shape/status unexpected.');
    console.error('Fix Auth API reachability before claiming email UX is launch-ready.');
    process.exit(1);
  }

  console.log('PASS: Auth signup + recover endpoints returned OK.');
  console.log('Inbox delivery remains an EXTERNAL manual verification step.');
}

main().catch((error) => {
  console.error('FAIL: smoke-auth-response error:', error);
  process.exit(1);
});
