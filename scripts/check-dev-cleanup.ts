#!/usr/bin/env npx tsx
/**
 * Safe back navigation + web deprecation cleanup guards.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');

let failures = 0;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`✗ ${message}`);
    failures += 1;
    return;
  }
  console.log(`✓ ${message}`);
}

function read(path: string) {
  return readFileSync(join(ROOT, path), 'utf8');
}

function collectSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
      continue;
    }

    if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      files.push(fullPath);
    }
  }

  return files;
}

const safeRouterBack = read('src/lib/safe-router-back.ts');
const platformStyles = read('src/theme/platform-styles.ts');
const shadows = read('src/theme/shadows.ts');

assert(safeRouterBack.includes('canGoBack()'), 'safeRouterBack checks navigation history');
assert(safeRouterBack.includes('router.replace(fallbackRoute)'), 'safeRouterBack replaces on empty stack');
assert(platformStyles.includes('boxShadow'), 'platformViewShadow uses boxShadow on web');
assert(platformStyles.includes('textShadow'), 'platformTextShadow uses textShadow on web');
assert(shadows.includes('walletCardStyle'), 'shadow tokens expose platform-safe styles');

const profile = read('src/app/profile.tsx');
assert(profile.includes('safeRouterBack(router, ORGANIZER_DASHBOARD_ROUTE)'), 'profile uses safe back');
assert(!profile.includes('router.back()'), 'profile does not call router.back directly');

const organizerScreens = [
  'src/app/events/create.tsx',
  'src/app/events/[eventId]/edit.tsx',
  'src/app/events/[eventId]/issue.tsx',
  'src/app/events/[eventId]/passes.tsx',
  'src/app/events/[eventId]/scan.tsx',
  'src/app/events/[eventId]/index.tsx',
];

for (const screen of organizerScreens) {
  const source = read(screen);
  assert(source.includes('safeRouterBack'), `${screen} uses safeRouterBack`);
}

const sourceFiles = collectSourceFiles(SRC);
const deprecatedPointerEventsProp = sourceFiles.filter((file) =>
  /pointerEvents=["']/.test(readFileSync(file, 'utf8')),
);

assert(
  deprecatedPointerEventsProp.length === 0,
  `no View pointerEvents props remain (${deprecatedPointerEventsProp.length} files)`,
);

const styleSheetShadowUsage = sourceFiles.filter((file) => {
  const source = readFileSync(file, 'utf8');
  if (file.endsWith('platform-styles.ts') || file.endsWith('shadows.ts')) {
    return false;
  }

  return /shadowColor:\s/.test(source) && !source.includes('platformViewShadow');
});

assert(
  styleSheetShadowUsage.length === 0,
  `StyleSheet shadowColor only via platformViewShadow (${styleSheetShadowUsage.length} files)`,
);

const guestPass = read('src/app/pass/[token].tsx');
assert(!guestPass.includes('safeRouterBack'), 'guest pass route unchanged');

if (failures > 0) {
  console.error(`\ncheck-dev-cleanup: ${failures} failure(s)`);
  process.exit(1);
}

console.log('\ncheck-dev-cleanup: all checks passed');
