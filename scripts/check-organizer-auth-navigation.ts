#!/usr/bin/env npx tsx
/**
 * Auth guards must not call router.replace/router.push during render.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const APP_DIR = join(ROOT, 'src/app');

let failures = 0;

function fail(message: string) {
  console.error(`✗ ${message}`);
  failures += 1;
}

function pass(message: string) {
  console.log(`✓ ${message}`);
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    fail(message);
    return;
  }
  pass(message);
}

function listTsxFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...listTsxFiles(fullPath));
      continue;
    }

    if (entry.endsWith('.tsx')) {
      files.push(fullPath);
    }
  }

  return files;
}

const renderTimeAuthNav =
  /if\s*\(\s*authGate\.state\s*===\s*['"]unauthenticated['"]\s*\)\s*\{[^}]*router\.(replace|push)\s*\(/s;

const appFiles = listTsxFiles(APP_DIR);

for (const filePath of appFiles) {
  const source = readFileSync(filePath, 'utf8');
  const relative = filePath.replace(`${ROOT}/`, '');

  if (renderTimeAuthNav.test(source)) {
    fail(`${relative} calls router navigation during unauthenticated render guard`);
  }
}

assert(
  failures === 0,
  'no organizer screen calls router.replace/push inside unauthenticated render guards',
);

const hookSource = readFileSync(join(ROOT, 'src/hooks/use-organizer-auth-redirect.ts'), 'utf8');
assert(
  hookSource.includes('useEffect') && hookSource.includes("authState === 'unauthenticated'"),
  'useOrganizerAuthRedirect redirects in useEffect',
);

const profileSource = readFileSync(join(ROOT, 'src/app/profile.tsx'), 'utf8');
assert(
  profileSource.includes('useOrganizerAuthRedirect') &&
    !profileSource.match(/onSignOut[\s\S]*router\.replace/),
  'profile sign out does not manually router.replace after signOut',
);

if (failures > 0) {
  console.error(`\ncheck-auth-redirect: ${failures} failure(s)`);
  process.exit(1);
}

console.log('\ncheck-organizer-auth-navigation: all checks passed');
