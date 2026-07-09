#!/usr/bin/env npx tsx
/**
 * Local physical-device rehearsal helper.
 *
 * Prints LAN-accessible URLs and scanner login steps for qa/fixtures.json passes.
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

const QA_ORGANIZER_EMAIL = 'qa-purchase-organizer@808tix.test';
const QA_ORGANIZER_PASSWORD = 'qa-purchase-local-password';
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
  const baseUrl = `http://${lanIp}:8081`;
  const scannerUrl = `${baseUrl}/events/${fixtures.event_id}/scan`;

  console.log('808Tix local physical rehearsal helper\n');
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
  console.log('127.0.0.1 works only on the Mac. Your phone must use the LAN IP below.');
  console.log('Supabase API calls from the phone also need the LAN host, not 127.0.0.1.\n');
  console.log('eval "$(npm run -s qa:env -- --exports-only)"');
  console.log(`export EXPO_PUBLIC_SUPABASE_URL="http://${lanIp}:54321"`);
  console.log('npx expo start --web --host lan --port 8081');
  console.log('\nKeep local Supabase running: supabase start');
  console.log('Allow macOS firewall incoming connections for ports 8081 and 54321 if prompted.');

  console.log('\n=== Step 2 — Open pass on phone ===\n');
  console.log('LAN HTTP pass pages are valid local rehearsal on iPhone/Android.');

  printUrl('Pass 1 URL:', `${baseUrl}/pass/${fixtures.pass_tokens[0]}`, fixtures.pass_tokens[0]);

  if (fixtures.pass_tokens[1]) {
    printUrl('Pass 2 URL:', `${baseUrl}/pass/${fixtures.pass_tokens[1]}`, fixtures.pass_tokens[1]);
  }

  console.log('\nChecklist:');
  console.log('- Open pass URL on phone.');
  console.log('- Confirm QR visible and guest name looks correct.');
  console.log('- If the page does not load, confirm Mac and phone are on the same Wi-Fi.');

  console.log('\n=== Step 3 — Scanner testing options ===\n');
  console.log('iOS Safari camera limitation (secure context):');
  console.log('- getUserMedia requires HTTPS or localhost.');
  console.log('- http://LAN_IP:8081 is NOT a secure context on iPhone Safari.');
  console.log('- You may see: "Camera access not supported in this browser".');
  console.log('- That is expected for LAN HTTP — not a scanner product failure.\n');
  console.log('For real camera scan rehearsal:');
  console.log('- Use your deployed HTTPS URL (staging/production), or');
  console.log('- Use a native/dev build with camera permissions.\n');
  console.log('LAN HTTP scanner is still useful for:');
  console.log('- Organizer login flow');
  console.log('- Scanner page layout and navigation');
  console.log('- Confirming the correct seeded event opens\n');
  console.log('TODO: QA credentials are intentionally deterministic for local rehearsal.');
  console.log('Credentials (from scripts/seed-qa-purchase-fixtures.ts / scripts/smoke-checkin.ts):');
  console.log(`  email: ${QA_ORGANIZER_EMAIL}`);
  console.log(`  password: ${QA_ORGANIZER_PASSWORD}`);
  console.log('\nScanner page/layout URL — camera may be unavailable over LAN HTTP on iOS Safari:');
  console.log(`  ${scannerUrl}`);
  console.log('\nSteps:');
  console.log(`  1. Open ${baseUrl}`);
  console.log('  2. Sign in with the QA organizer email/password above.');
  console.log(`  3. Open event "${QA_EVENT_NAME}" (${fixtures.event_id.slice(0, 8)}...).`);
  console.log(`  4. Open the scanner URL above (layout/login check; camera may not work on iOS Safari).`);
  console.log('\nBackend check-in without camera: npm run qa:seed && npm run smoke:checkin');

  console.log('\n=== Step 4 — Optional buyer page spot-check URLs ===');

  printUrl(
    'Purchase page:',
    `${baseUrl}/events/${fixtures.event_id}/buy?ticket_type_id=${fixtures.ticket_type_id}`,
  );

  printUrl(
    'Success page:',
    `${baseUrl}/purchase/success?order_token=${fixtures.paid_order_token}`,
    fixtures.paid_order_token,
  );

  if (fixtures.pending_order_token) {
    printUrl(
      'Cancel page:',
      `${baseUrl}/purchase/cancel?order_token=${fixtures.pending_order_token}&event_id=${fixtures.event_id}&ticket_type_id=${fixtures.ticket_type_id}`,
      fixtures.pending_order_token,
    );
  }

  console.log('\n=== Physical rehearsal checklist ===\n');
  console.log('- Step 1: Start Expo web using the LAN command above.');
  console.log('- Step 2: Open pass URL on phone; confirm QR visible.');
  console.log('- Step 3: For camera scans, use HTTPS deploy or native/dev build — not LAN HTTP on iOS Safari.');
  console.log('- Step 3 (LAN): Optional scanner page/login/layout check at the labeled scanner URL.');
  console.log('- Backend: npm run smoke:checkin proves validate_pass without camera.');
  console.log('- If passes were already checked in, rerun: npm run qa:seed');

  console.log('\nDone. Pass URLs are the primary LAN rehearsal target on phone.');
}

main();
