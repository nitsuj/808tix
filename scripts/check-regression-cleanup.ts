#!/usr/bin/env npx tsx
/**
 * Guest pass hard-reset guards — self-contained /pass/[token] implementation.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();

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

function read(path: string): string {
  return readFileSync(join(ROOT, path), 'utf8');
}

const guestPass = read('src/app/pass/[token].tsx');
const walletButton = read('src/components/pass/add-to-apple-wallet.tsx');

assert(!guestPass.includes('ArtworkEnvironment'), 'guest pass does not use ArtworkEnvironment');
assert(!guestPass.includes('PassQrCode'), 'guest pass does not use PassQrCode');
assert(
  !guestPass.includes('TEMP DIAGNOSTIC'),
  'guest pass does not contain temporary diagnostic banner text',
);
assert(!guestPass.includes('PASS DIAGNOSTIC'), 'guest pass does not contain diagnostic console logs');
assert(guestPass.includes('contentFit="cover"'), 'guest pass renders local artwork background with cover');
assert(
  guestPass.includes('resolveEventArtworkPublicUrl'),
  'guest pass normalizes uploaded artwork URLs before render',
);
assert(
  guestPass.includes("import QRCode from 'react-native-qrcode-svg'"),
  'guest pass imports react-native-qrcode-svg for native QR',
);
assert(
  guestPass.includes("Platform.OS !== 'web'") && guestPass.includes('QRCodeLib.toDataURL'),
  'guest pass guards qrcode.toDataURL to web only',
);
assert(guestPass.includes('qrDataUrl'), 'guest pass stores generated qrDataUrl for web');
assert(
  guestPass.includes('source={{ uri: qrDataUrl }}'),
  'guest pass renders web QR Image from qrDataUrl',
);
assert(
  guestPass.includes('value={qrToken}') || guestPass.includes('value={pass.secure_token}'),
  'guest pass renders native QRCode from pass.secure_token',
);
assert(guestPass.includes('secureToken={pass.secure_token}'), 'AddToAppleWallet receives pass.secure_token');
assert(guestPass.includes('pass.secure_token'), 'guest pass uses pass.secure_token for QR generation');
assert(
  guestPass.includes('QR failed to generate'),
  'guest pass shows visible QR generation error fallback',
);
assert(
  guestPass.includes('Pass token missing — QR cannot be displayed.'),
  'guest pass shows visible missing-token error card',
);
assert(guestPass.includes('styles.backgroundLayer'), 'guest pass uses absolute background layer');
assert(guestPass.includes('styles.foreground'), 'guest pass uses foreground layer above background');
assert(guestPass.includes('SafeAreaView'), 'guest pass foreground uses SafeAreaView');
assert(!guestPass.includes('credentialCardOuter'), 'guest pass avoids credentialCardOuter experiment');
assert(guestPass.includes('808TIX TICKET'), 'guest pass shows ticket brand label');
assert(guestPass.includes('Ticket holder'), 'guest pass shows ticket holder label');
assert(guestPass.includes('Present this ticket at entry'), 'guest pass shows entry help copy');
assert(
  !guestPass.includes('posterPanel'),
  'guest pass uses unified credential card instead of separate poster panel',
);
assert(!guestPass.includes('qrCenterMark'), 'guest pass does not reference qrCenterMark styles');
assert(!guestPass.includes('qrCenterMarkOverlay'), 'guest pass does not reference qrCenterMarkOverlay');
assert(!guestPass.includes('qrCenterMarkText'), 'guest pass does not reference qrCenterMarkText');
assert(
  !guestPass.includes('platformPointerEventsNone'),
  'guest pass does not use platformPointerEventsNone',
);
assert(
  !guestPass.includes('>808</Text>'),
  'guest pass does not render standalone 808 text inside QR overlay',
);
assert(
  guestPass.includes('styles.qrContent') &&
    guestPass.includes('styles.qrShell') &&
    guestPass.includes('alignItems: \'center\'') &&
    guestPass.includes('justifyContent: \'center\''),
  'guest pass centers QR inside white shell with flex layout',
);
assert(
  !walletButton.includes('window.location.assign'),
  'Add to Apple Wallet does not replace the guest pass page on web',
);
assert(
  walletButton.includes("window.open(walletUrl, '_blank'"),
  'Add to Apple Wallet opens wallet URL in a new web tab',
);

if (failures > 0) {
  console.error(`\ncheck-regression-cleanup: ${failures} failure(s)`);
  process.exit(1);
}

console.log('\ncheck-regression-cleanup: all checks passed');
