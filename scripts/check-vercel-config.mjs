#!/usr/bin/env node
/**
 * Validates vercel.json for Expo static export routing.
 * Run: npm run check:vercel
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const vercelPath = join(root, 'vercel.json');
const distDir = join(root, 'dist');

const EXPECTED_REWRITES = [
  { source: '/pass/:token', destination: '/pass/[token].html', distFile: 'pass/[token].html' },
  { source: '/events/:eventId', destination: '/events/[eventId].html', distFile: 'events/[eventId].html' },
  {
    source: '/events/:eventId/scan',
    destination: '/events/[eventId]/scan.html',
    distFile: 'events/[eventId]/scan.html',
  },
  {
    source: '/events/:eventId/issue',
    destination: '/events/[eventId]/issue.html',
    distFile: 'events/[eventId]/issue.html',
  },
  {
    source: '/events/:eventId/edit',
    destination: '/events/[eventId]/edit.html',
    distFile: 'events/[eventId]/edit.html',
  },
  {
    source: '/events/:eventId/passes',
    destination: '/events/[eventId]/passes.html',
    distFile: 'events/[eventId]/passes.html',
  },
];

let failures = 0;

function fail(message) {
  console.error(`✗ ${message}`);
  failures += 1;
}

function pass(message) {
  console.log(`✓ ${message}`);
}

let config;

try {
  const raw = readFileSync(vercelPath, 'utf8');
  config = JSON.parse(raw);
  pass('vercel.json is valid JSON');
} catch (error) {
  fail(`vercel.json is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

const rewrites = config.rewrites;

if (!Array.isArray(rewrites)) {
  fail('vercel.json must define a "rewrites" array');
  process.exit(1);
}

const hasFilesystemHandle = rewrites.some(
  (entry) => entry && typeof entry === 'object' && entry.handle === 'filesystem',
);

if (hasFilesystemHandle) {
  fail(
    'vercel.json must NOT contain { "handle": "filesystem" } — use source/destination rewrites only',
  );
}

const hasAnyHandle = rewrites.some((entry) => entry && typeof entry === 'object' && 'handle' in entry);

if (hasAnyHandle) {
  fail('vercel.json rewrites must not use "handle" entries');
}

const routeRewrites = rewrites.filter(
  (entry) => entry && typeof entry === 'object' && typeof entry.source === 'string',
);

for (const expected of EXPECTED_REWRITES) {
  const match = routeRewrites.find(
    (entry) => entry.source === expected.source && entry.destination === expected.destination,
  );

  if (!match) {
    fail(
      `Missing rewrite: "${expected.source}" → "${expected.destination}"`,
    );
    continue;
  }

  pass(`Rewrite present: ${expected.source} → ${expected.destination}`);

  const distPath = join(distDir, expected.distFile);

  if (existsSync(distDir)) {
    if (existsSync(distPath)) {
      pass(`dist/${expected.distFile} exists (matches rewrite destination)`);
    } else {
      fail(
        `dist/${expected.distFile} missing — run "npm run check:export" after changing routes`,
      );
    }
  }
}

if (!existsSync(distDir)) {
  console.log('ℹ dist/ not found — destination file checks skipped (run check:export to verify)');
}

if (failures > 0) {
  console.error(`\ncheck-vercel-config: ${failures} failure(s)`);
  process.exit(1);
}

console.log('\ncheck-vercel-config: all checks passed');
