#!/usr/bin/env npx tsx
/**
 * Local physical-device rehearsal helper.
 *
 * Confirmed local flow:
 * - Phone displays passes via LAN IP
 * - Laptop scanner uses localhost (camera works on localhost secure context)
 *
 * Usage:
 *   npm run rehearsal:local
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { join } from 'node:path';

const ROOT = process.cwd();
const FIXTURES_PATH = join(ROOT, 'qa/fixtures.json');

const QA_ORGANIZER_EMAIL = 'qa@808tix.test';
const QA_ORGANIZER_PASSWORD = 'qa';
const QA_EVENT_NAME = 'QA Paid Event';

type QaFixtures = {
  event_id: string;
  ticket_type_id: string;
  pending_order_token?: string;
  paid_order_token: string;
  pass_tokens: string[];
};

function maskToken(token: string): string {
  if (token.length <= 12) {
    return '***';
  }

  return `${token.slice(0, 8)}...`;
}

function isIpv4Entry(family: string | number): boolean {
  return family === 'IPv4' || family === 4;
}

function detectLanIps(): { primary: string; candidates: string[] } {
  let en0Ip: string | null = null;

  if (process.platform === 'darwin') {
    try {
      const ip = execFileSync('ipconfig', ['getifaddr', 'en0'], { encoding: 'utf8' }).trim();
      if (ip && ip !== '127.0.0.1') {
        en0Ip = ip;
      }
    } catch {
      // Fall back to networkInterfaces().
    }
  }

  const candidates: string[] = [];

  for (const entries of Object.values(networkInterfaces())) {
    if (!entries) {
      continue;
    }

    for (const entry of entries) {
      if (!isIpv4Entry(entry.family) || entry.internal || entry.address === '127.0.0.1') {
        continue;
      }

      if (!candidates.includes(entry.address)) {
        candidates.push(entry.address);
      }
    }
  }

  if (en0Ip && !candidates.includes(en0Ip)) {
    candidates.unshift(en0Ip);
  }

  const primary = en0Ip ?? candidates[0];

  if (!primary) {
    console.error('\nCould not detect a LAN IPv4 address for this Mac.');
    console.error('Connect to Wi-Fi/Ethernet and retry.');
    process.exit(1);
  }

  return { primary, candidates };
}

function loadFixtures(): QaFixtures {
  if (!existsSync(FIXTURES_PATH)) {
    console.error('\nqa/fixtures.json is missing.\n');
    console.error('Run:');
    console.error('  eval "$(npm run -s qa:env -- --exports-only)"');
    console.error('  npm run qa:seed');
    console.error('  npm run rehearsal:local');
    process.exit(1);
  }

  const fixtures = JSON.parse(readFileSync(FIXTURES_PATH, 'utf8')) as QaFixtures;

  if (!fixtures.event_id || !fixtures.ticket_type_id || !fixtures.paid_order_token) {
    console.error('\nqa/fixtures.json is incomplete. Run: npm run qa:seed');
    process.exit(1);
  }

  if (!Array.isArray(fixtures.pass_tokens) || fixtures.pass_tokens.length < 1) {
    console.error('\nqa/fixtures.json is missing pass_tokens. Run: npm run qa:seed');
    process.exit(1);
  }

  return fixtures;
}

function printUrl(label: string, url: string, tokenForMask?: string): void {
  console.log(`\n${label}`);
  if (tokenForMask) {
    console.log(`  token: ${maskToken(tokenForMask)}`);
  }
  console.log(`  ${url}`);
}

function main(): void {
  const fixtures = loadFixtures();
  const { primary: lanIp, candidates } = detectLanIps();
  const phoneBaseUrl = `http://${lanIp}:8081`;
  const laptopBaseUrl = 'http://localhost:8081';
  const laptopScannerUrl = `${laptopBaseUrl}/events/${fixtures.event_id}/scan`;
  const lanScannerUrl = `${phoneBaseUrl}/events/${fixtures.event_id}/scan`;

  console.log('808Tickets local physical rehearsal helper\n');
  console.log('Confirmed local flow: phone shows pass (LAN IP) + laptop scanner (localhost).');
  console.log('Summary');
  console.log(`  event_id: ${fixtures.event_id}`);
  console.log(`  event_name: ${QA_EVENT_NAME}`);
  console.log(`  pass_token[0]: ${maskToken(fixtures.pass_tokens[0])}`);
  if (fixtures.pass_tokens[1]) {
    console.log(`  pass_token[1]: ${maskToken(fixtures.pass_tokens[1])}`);
  }

  console.log('\n=== LAN IP ===\n');
  console.log(`Primary LAN IP: ${lanIp}`);
  if (candidates.length > 1) {
    console.log(`Other candidates: ${candidates.filter((ip) => ip !== lanIp).join(', ')}`);
  }

  console.log('\n=== Step 1 — Start local web on LAN ===\n');
  console.log('Phone cannot use localhost/127.0.0.1 (those mean the phone itself).');
  console.log('Laptop scanner should use localhost so camera getUserMedia works.\n');
  console.log('eval "$(npm run -s qa:env -- --exports-only)"');
  console.log(`export EXPO_PUBLIC_SUPABASE_URL="http://${lanIp}:54321"`);
  console.log('npx expo start --web --host lan --port 8081');
  console.log('\nKeep local Supabase running: supabase start');
  console.log('Allow macOS firewall incoming connections for ports 8081 and 54321 if prompted.');

  console.log('\n=== Step 2 — Phone ticket/pass (LAN IP) ===\n');
  console.log('Open these on the phone:');

  printUrl('Pass 1 URL:', `${phoneBaseUrl}/pass/${fixtures.pass_tokens[0]}`, fixtures.pass_tokens[0]);

  if (fixtures.pass_tokens[1]) {
    printUrl('Pass 2 URL:', `${phoneBaseUrl}/pass/${fixtures.pass_tokens[1]}`, fixtures.pass_tokens[1]);
  }

  console.log('\nChecklist:');
  console.log('- Open ticket URL on phone.');
  console.log('- Confirm QR visible and guest name looks correct.');
  console.log('- If the page does not load, confirm Mac and phone are on the same Wi-Fi.');

  console.log('\n=== Step 3 — Laptop scanner (localhost) ===\n');
  console.log('Primary local camera path: phone QR + laptop scanner on localhost.');
  console.log('- localhost is a secure context → camera works on laptop browser');
  console.log('- http://LAN_IP scanner is layout-only / not reliable for camera (not secure context)\n');
  console.log('QA credentials are intentionally deterministic for local rehearsal:');
  console.log(`  email: ${QA_ORGANIZER_EMAIL}`);
  console.log(`  password: ${QA_ORGANIZER_PASSWORD}`);
  console.log('\nLaptop scanner URL (use this for camera):');
  console.log(`  ${laptopScannerUrl}`);
  console.log('\nSteps:');
  console.log(`  1. On the laptop, open ${laptopBaseUrl}`);
  console.log('  2. Sign in with the QA organizer email/password above.');
  console.log(`  3. Open event "${QA_EVENT_NAME}" (${fixtures.event_id.slice(0, 8)}...).`);
  console.log(`  4. Open scanner: ${laptopScannerUrl}`);
  console.log('  5. Scan the phone pass QR → expect valid, then already_used on rescan.');
  console.log('\nLAN scanner URL (layout/login only — camera may fail on iOS Safari / non-localhost HTTP):');
  console.log(`  ${lanScannerUrl}`);
  console.log('\nFor phone-as-scanner camera rehearsal:');
  console.log('- Use deployed HTTPS staging/production, or a native/dev build.');
  console.log('- Do not treat LAN HTTP camera failure as a scanner product bug.');
  console.log('\nBackend check-in without camera: npm run qa:seed && npm run smoke:checkin');

  console.log('\n=== Step 4 — Optional buyer page spot-check URLs ===');

  printUrl(
    'Purchase page:',
    `${phoneBaseUrl}/events/${fixtures.event_id}/buy?ticket_type_id=${fixtures.ticket_type_id}`,
  );

  printUrl(
    'Success page:',
    `${phoneBaseUrl}/purchase/success?order_token=${fixtures.paid_order_token}`,
    fixtures.paid_order_token,
  );

  if (fixtures.pending_order_token) {
    printUrl(
      'Cancel page:',
      `${phoneBaseUrl}/purchase/cancel?order_token=${fixtures.pending_order_token}&event_id=${fixtures.event_id}&ticket_type_id=${fixtures.ticket_type_id}`,
      fixtures.pending_order_token,
    );
  }

  console.log('\n=== Physical rehearsal checklist ===\n');
  console.log('- Step 1: Start Expo web using the LAN command above.');
  console.log('- Step 2: Open ticket URL on phone (LAN IP); confirm QR visible.');
  console.log('- Step 3: On laptop, open localhost scanner and sign in as qa@808tix.test / qa.');
  console.log('- Scan phone QR from laptop → valid check-in.');
  console.log('- Rescan same pass → already used.');
  if (fixtures.pass_tokens[1]) {
    console.log('- Scan Pass 2 → valid check-in.');
  }
  console.log('- Backend: npm run smoke:checkin proves validate_pass without camera.');
  console.log('- If passes were already checked in, rerun: npm run qa:seed');

  console.log('\nDone. Primary path: phone pass (LAN) + laptop scanner (localhost).');
}

main();
