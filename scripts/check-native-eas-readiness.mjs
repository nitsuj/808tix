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

assert(app.expo?.ios?.bundleIdentifier, 'app.json defines ios.bundleIdentifier');
assert(app.expo?.android?.package, 'app.json defines android.package');
assert(app.expo?.scheme, 'app.json defines URL scheme');
assert(app.expo?.extra?.eas?.projectId, 'app.json links EAS projectId');

const plugins = app.expo?.plugins ?? [];
const pluginNames = plugins.map((entry) => (Array.isArray(entry) ? entry[0] : entry));

assert(pluginNames.includes('expo-dev-client'), 'expo-dev-client plugin configured');
assert(pluginNames.some((name) => name === 'expo-camera'), 'expo-camera plugin configured');

if (failures > 0) {
  console.error(`\ncheck-native-eas-readiness: ${failures} failure(s)`);
  process.exit(1);
}

console.log('\ncheck-native-eas-readiness: all checks passed');
