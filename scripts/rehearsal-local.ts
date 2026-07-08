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

  console.log('\n=== Start Expo web for phone testing ===\n');
  console.log('127.0.0.1 works only on the Mac. Your phone must use the LAN IP below.');
  console.log('Supabase API calls from the phone also need the LAN host, not 127.0.0.1.\n');
  console.log('eval "$(npm run -s qa:env -- --exports-only)"');
  console.log(`export EXPO_PUBLIC_SUPABASE_URL="http://${lanIp}:54321"`);
  console.log('npx expo start --web --host lan --port 8081');
  console.log('\nKeep local Supabase running: supabase start');
  console.log(`Open buyer pages on phone: ${baseUrl}`);

  console.log('\n=== Phone URLs (full links) ===');

  printUrl('Buyer / pass URL (pass 1):', `${baseUrl}/pass/${fixtures.pass_tokens[0]}`, fixtures.pass_tokens[0]);

  if (fixtures.pass_tokens[1]) {
    printUrl(
      'Second pass URL (pass 2):',
      `${baseUrl}/pass/${fixtures.pass_tokens[1]}`,
      fixtures.pass_tokens[1],
    );
  }

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

  console.log('\n=== Scanner instructions (QA organizer) ===\n');
  console.log('The seeded event belongs to the deterministic QA organizer from npm run qa:seed.');
  console.log('Credentials (from scripts/seed-qa-purchase-fixtures.ts / scripts/smoke-checkin.ts):');
  console.log(`  email: ${QA_ORGANIZER_EMAIL}`);
  console.log(`  password: ${QA_ORGANIZER_PASSWORD}`);
  console.log('\nOn the scanner device/browser:');
  console.log(`  1. Open ${baseUrl}`);
  console.log('  2. Sign in with the QA organizer email/password above.');
  console.log(`  3. Open event "${QA_EVENT_NAME}" (${fixtures.event_id.slice(0, 8)}...).`);
  console.log(`  4. Open scanner: ${baseUrl}/events/${fixtures.event_id}/scan`);
  console.log('  5. Grant camera permission when prompted.');

  console.log('\n=== Physical rehearsal checklist ===\n');
  console.log('- Start Expo web using the LAN command above.');
  console.log('- Open pass URL on phone.');
  console.log('- Confirm QR visible.');
  console.log('- Log into scanner as QA organizer on scanner device/browser.');
  console.log('- Open seeded QA event.');
  console.log('- Scan first pass.');
  console.log('- Expect valid check-in.');
  console.log('- Scan first pass again.');
  console.log('- Expect already used.');
  if (fixtures.pass_tokens[1]) {
    console.log('- Scan second pass.');
    console.log('- Expect valid check-in.');
  }
  console.log('- If phone cannot load LAN URL, confirm Mac and phone are on same Wi-Fi.');
  console.log('- Allow macOS firewall incoming connections for ports 8081 and 54321 if prompted.');
  console.log('- If passes were already checked in, rerun: npm run qa:seed');

  console.log('\nDone. Use the full URLs above on your phone.');
}

main();
