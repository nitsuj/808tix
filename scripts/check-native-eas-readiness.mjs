#!/usr/bin/env node
/**
 * Native Phase 0 — EAS / app.json readiness (no secrets required).
 * Run: npm run check:native-eas
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

/**
 * Slug registered on expo.dev for extra.eas.projectId.
 * EAS rejects builds when app.json slug differs from this value.
 * https://expo.fyi/eas-project-id
 */
const EAS_PROJECT_SLUG = '808Tix';

const VALID_SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*$/;

let failures = 0;

function fail(message) {
  console.error(`✗ ${message}`);
  failures += 1;
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

/**
 * expo-dev-client/plugin/build/getDefaultScheme.js — dev-client scheme from slug only.
 */
function getDevClientSchemeFromSlug(slug) {
  let scheme = slug.replace(/[^A-Za-z0-9+\-.]/g, '');
  scheme = scheme.toLowerCase();
  return `exp+${scheme}`;
}

const easPath = join(root, 'eas.json');
const appPath = join(root, 'app.json');
const docPath = join(root, 'docs/NATIVE_PHASE_0.md');

assert(existsSync(easPath), 'eas.json exists');
assert(existsSync(appPath), 'app.json exists');
assert(existsSync(docPath), 'docs/NATIVE_PHASE_0.md exists');

const eas = JSON.parse(readFileSync(easPath, 'utf8'));
const app = JSON.parse(readFileSync(appPath, 'utf8'));

assert(eas.build?.development, 'eas.json has development profile');
assert(eas.build?.preview, 'eas.json has preview profile');
assert(eas.build?.production, 'eas.json has production profile');

assert(
  eas.build.development.developmentClient === true,
  'development profile uses developmentClient',
);
assert(eas.build.preview.distribution === 'internal', 'preview profile is internal distribution');
assert(eas.build.production.distribution === 'store', 'production profile is store distribution');

const previewPassBase = eas.build.preview.env?.EXPO_PUBLIC_PASS_LINK_BASE_URL;
const productionPassBase = eas.build.production.env?.EXPO_PUBLIC_PASS_LINK_BASE_URL;

assert(
  previewPassBase === 'https://808tix.vercel.app',
  'preview profile sets EXPO_PUBLIC_PASS_LINK_BASE_URL to production guest web origin',
);
assert(
  productionPassBase === 'https://808tix.vercel.app',
  'production profile sets EXPO_PUBLIC_PASS_LINK_BASE_URL to production guest web origin',
);

const slug = app.expo?.slug;
const scheme = app.expo?.scheme;
const projectId = app.expo?.extra?.eas?.projectId;

assert(typeof slug === 'string' && slug.length > 0, 'app.json defines slug');
assert(typeof scheme === 'string' && scheme.length > 0, 'app.json defines URL scheme');
assert(
  slug === EAS_PROJECT_SLUG,
  `slug "${slug}" matches EAS project slug "${EAS_PROJECT_SLUG}" (required for projectId ${projectId ?? 'unknown'})`,
);
assert(VALID_SCHEME_PATTERN.test(scheme), `scheme "${scheme}" matches Expo scheme pattern`);

const devClientScheme = getDevClientSchemeFromSlug(slug);
assert(
  devClientScheme === 'exp+808tix',
  `dev-client scheme is ${devClientScheme} (Metro QR uses ${devClientScheme}://expo-development-client/...)`,
);

assert(
  scheme !== devClientScheme.replace(/^exp\+/, ''),
  'custom scheme is separate from dev-client slug scheme (slug drives exp+808tix, scheme is for app deep links)',
);

assert(app.expo?.ios?.bundleIdentifier, 'app.json defines ios.bundleIdentifier');
assert(app.expo?.android?.package, 'app.json defines android.package');
assert(projectId, 'app.json links EAS projectId');

const plugins = app.expo?.plugins ?? [];
const pluginNames = plugins.map((entry) => (Array.isArray(entry) ? entry[0] : entry));

assert(pluginNames.includes('expo-dev-client'), 'expo-dev-client plugin configured');
assert(pluginNames.some((name) => name === 'expo-camera'), 'expo-camera plugin configured');

const docContent = readFileSync(docPath, 'utf8');
assert(docContent.includes(devClientScheme), 'NATIVE_PHASE_0.md documents dev-client scheme');
assert(docContent.includes(EAS_PROJECT_SLUG), 'NATIVE_PHASE_0.md documents EAS project slug');

if (failures > 0) {
  console.error(`\ncheck-native-eas-readiness: ${failures} failure(s)`);
  process.exit(1);
}

console.log('\ncheck-native-eas-readiness: all checks passed');
