#!/usr/bin/env node
/**
 * Native Phase 0 — verify Expo public env vars for native builds.
 * Reads .env when present; always validates .env.example documents required keys.
 * Run: npm run check:native-env
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const REQUIRED_KEYS = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'EXPO_PUBLIC_PASS_LINK_BASE_URL',
];

const GUEST_PASS_ORIGIN = 'https://808tickets.com';

let failures = 0;
let warnings = 0;

function fail(message) {
  console.error(`✗ ${message}`);
  failures += 1;
}

function warn(message) {
  console.warn(`⚠ ${message}`);
  warnings += 1;
}

function pass(message) {
  console.log(`✓ ${message}`);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
    return;
  }
  pass(message);
}

function parseEnvFile(content) {
  const values = new Map();

  for (const line of content.split('\n')) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const eq = trimmed.indexOf('=');

    if (eq === -1) {
      continue;
    }

    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    values.set(key, value);
  }

  return values;
}

function normalizePassLinkBaseUrl(raw) {
  const trimmed = raw?.trim();

  if (!trimmed) {
    return null;
  }

  let candidate = trimmed.replace(/\/+$/, '');

  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  try {
    const parsed = new URL(candidate);
    if (!parsed.hostname) {
      return null;
    }

    return parsed.origin;
  } catch {
    return null;
  }
}

const examplePath = join(root, '.env.example');
assert(existsSync(examplePath), '.env.example exists');

const exampleContent = readFileSync(examplePath, 'utf8');

for (const key of REQUIRED_KEYS) {
  assert(exampleContent.includes(`${key}=`), `.env.example documents ${key}`);
}

const envPath = join(root, '.env');

if (!existsSync(envPath)) {
  warn('.env not found — skipping local value checks (set vars in EAS for device builds)');
} else {
  const envValues = parseEnvFile(readFileSync(envPath, 'utf8'));

  for (const key of REQUIRED_KEYS) {
    const value = envValues.get(key);

    if (!value || value === 'your-anon-key') {
      fail(`.env missing or placeholder value for ${key}`);
      continue;
    }

    pass(`.env defines ${key}`);
  }

  const supabaseUrl = envValues.get('EXPO_PUBLIC_SUPABASE_URL');

  if (supabaseUrl && !normalizePassLinkBaseUrl(supabaseUrl)) {
    fail('EXPO_PUBLIC_SUPABASE_URL must be a valid http(s) URL');
  }

  const passBaseRaw = envValues.get('EXPO_PUBLIC_PASS_LINK_BASE_URL');
  const passBase = normalizePassLinkBaseUrl(passBaseRaw);

  if (passBaseRaw) {
    if (!passBase) {
      fail('EXPO_PUBLIC_PASS_LINK_BASE_URL must normalize to a valid https origin');
    } else if (passBase !== GUEST_PASS_ORIGIN) {
      warn(
        `EXPO_PUBLIC_PASS_LINK_BASE_URL normalizes to ${passBase} — native builds should use ${GUEST_PASS_ORIGIN} for guest links`,
      );
    } else {
      pass('EXPO_PUBLIC_PASS_LINK_BASE_URL points at production guest web origin');
    }
  }
}

console.log('\nEAS secret reminder (set on Expo dashboard or via eas env):');
console.log('  EXPO_PUBLIC_SUPABASE_URL');
console.log('  EXPO_PUBLIC_SUPABASE_ANON_KEY');
console.log('  EXPO_PUBLIC_PASS_LINK_BASE_URL=https://808tickets.com (also in eas.json preview/production)');

if (failures > 0) {
  console.error(`\ncheck-native-env: ${failures} failure(s)`);
  process.exit(1);
}

console.log(`\ncheck-native-env: all checks passed${warnings ? ` (${warnings} warning(s))` : ''}`);
