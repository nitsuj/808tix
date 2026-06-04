#!/usr/bin/env npx tsx
/**
 * Scanner screen visual wiring — scan logic must remain in scan.tsx handlers only.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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

const scanSource = readFileSync(join(process.cwd(), 'src/app/events/[eventId]/scan.tsx'), 'utf8');
const resultSource = readFileSync(
  join(process.cwd(), 'src/components/scanner/scan-result-view.tsx'),
  'utf8',
);
const cameraNativeSource = readFileSync(
  join(process.cwd(), 'src/components/scanner/event-scanner-camera.tsx'),
  'utf8',
);
const artworkBgSource = readFileSync(
  join(process.cwd(), 'src/components/scanner/scanner-artwork-background.tsx'),
  'utf8',
);
const validateScanSource = readFileSync(join(process.cwd(), 'src/lib/validate-pass-scan.ts'), 'utf8');

assert(scanSource.includes('MOBILE_VIEWPORT_WIDTH = 390'), 'scanner screen uses 390px viewport');
assert(scanSource.includes('formatEventDateTimeLong'), 'scanner shows canonical event date');
assert(scanSource.includes('validatePassScan'), 'scanner still validates via validatePassScan');
assert(scanSource.includes('parseScannedSecureToken'), 'scanner still parses QR payload');
assert(scanSource.includes('canScanPassesForEvent'), 'draft/live scan guard preserved');
assert(!scanSource.includes('.rpc('), 'scan screen does not call validate_pass RPC directly');

assert(resultSource.includes('MOBILE_VIEWPORT_WIDTH = 390'), 'scan result uses 390px viewport');
assert(resultSource.includes('getScannerResultTitle'), 'scan result uses shared result titles');
assert(!resultSource.includes('validatePassScan'), 'scan result view has no validation logic');

assert(cameraNativeSource.includes('eventDateLine'), 'camera overlay shows event date context');
assert(cameraNativeSource.includes('MOBILE_VIEWPORT_WIDTH = 390'), 'native camera respects 390 layout');
assert(cameraNativeSource.includes('SafeAreaView'), 'scanner camera uses SafeAreaView for insets');
assert(
  cameraNativeSource.includes("overflow: 'hidden'") && cameraNativeSource.includes('minHeight: 0'),
  'scanner camera UI is bounded within viewport',
);
assert(
  artworkBgSource.includes("position: 'absolute'") && artworkBgSource.includes('useWindowDimensions'),
  'scanner artwork background is absolutely positioned with explicit window frame',
);

assert(validateScanSource.includes('validate_pass'), 'validate_pass RPC remains in validatePassScan module');

if (failures > 0) {
  console.error(`\ncheck-scanner-screen: ${failures} failure(s)`);
  process.exit(1);
}

console.log('\ncheck-scanner-screen: all checks passed');
