#!/usr/bin/env node
/**
 * Validates Expo web export output in dist/.
 * Run after: npx expo export --platform web
 */
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, '..', 'dist');

const REQUIRED_FILES = [
  'pass/[token].html',
  'events/[eventId].html',
  'events/[eventId]/scan.html',
  'events/[eventId]/issue.html',
  'events/[eventId]/edit.html',
  'events/[eventId]/passes.html',
];

let failures = 0;

function fail(message) {
  console.error(`✗ ${message}`);
  failures += 1;
}

function pass(message) {
  console.log(`✓ ${message}`);
}

if (!existsSync(distDir)) {
  fail('dist/ directory not found — run "npx expo export --platform web" first');
  process.exit(1);
}

pass('dist/ directory exists');

for (const relativePath of REQUIRED_FILES) {
  const absolutePath = join(distDir, relativePath);

  if (existsSync(absolutePath)) {
    pass(`dist/${relativePath}`);
  } else {
    fail(`Missing dist/${relativePath}`);
  }
}

if (failures > 0) {
  console.error(`\ncheck-export-routes: ${failures} failure(s)`);
  process.exit(1);
}

console.log('\ncheck-export-routes: all checks passed');
