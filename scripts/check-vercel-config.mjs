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

/** Static Expo HTML pages that must resolve without a .html suffix. */
const STATIC_CLEAN_URL_REWRITES = [
  { source: '/login', destination: '/login.html', distFile: 'login.html' },
  { source: '/admin', destination: '/admin/index.html', distFile: 'admin/index.html' },
  { source: '/privacy', destination: '/privacy.html', distFile: 'privacy.html' },
  { source: '/terms', destination: '/terms.html', distFile: 'terms.html' },
  { source: '/home', destination: '/home.html', distFile: 'home.html' },
  { source: '/profile', destination: '/profile.html', distFile: 'profile.html' },
  { source: '/events/create', destination: '/events/create.html', distFile: 'events/create.html' },
];

const DYNAMIC_REWRITES = [
  {
    source: '/admin/events/:eventId',
    destination: '/admin/events/[eventId].html',
    distFile: 'admin/events/[eventId].html',
  },
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
  {
    source: '/events/:eventId/buy',
    destination: '/events/[eventId]/buy.html',
    distFile: 'events/[eventId]/buy.html',
  },
  { source: '/events/:eventId', destination: '/events/[eventId].html', distFile: 'events/[eventId].html' },
  {
    source: '/purchase/success',
    destination: '/purchase/success.html',
    distFile: 'purchase/success.html',
  },
  {
    source: '/purchase/cancel',
    destination: '/purchase/cancel.html',
    distFile: 'purchase/cancel.html',
  },
  { source: '/pass/:token', destination: '/pass/[token].html', distFile: 'pass/[token].html' },
];

const EXPECTED_REWRITES = [...STATIC_CLEAN_URL_REWRITES, ...DYNAMIC_REWRITES];

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
    fail(`Missing rewrite: "${expected.source}" → "${expected.destination}"`);
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

const createIndex = routeRewrites.findIndex((entry) => entry.source === '/events/create');
const eventIdIndex = routeRewrites.findIndex((entry) => entry.source === '/events/:eventId');
const buyIndex = routeRewrites.findIndex((entry) => entry.source === '/events/:eventId/buy');

if (createIndex === -1 || eventIdIndex === -1) {
  fail('Could not verify /events/create vs /events/:eventId rewrite order');
} else if (createIndex > eventIdIndex) {
  fail('/events/create rewrite must appear before /events/:eventId');
} else {
  pass('/events/create rewrite is ordered before /events/:eventId');
}

if (buyIndex === -1 || eventIdIndex === -1) {
  fail('Could not verify /events/:eventId/buy vs /events/:eventId rewrite order');
} else if (buyIndex > eventIdIndex) {
  fail('/events/:eventId/buy rewrite must appear before /events/:eventId');
} else {
  pass('/events/:eventId/buy rewrite is ordered before /events/:eventId');
}

if (!existsSync(distDir)) {
  console.log('ℹ dist/ not found — destination file checks skipped (run check:export to verify)');
}

if (failures > 0) {
  console.error(`\ncheck-vercel-config: ${failures} failure(s)`);
  process.exit(1);
}

console.log('\ncheck-vercel-config: all checks passed');
