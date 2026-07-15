#!/usr/bin/env npx tsx
/**
 * Public marketing homepage v0 — route, copy, and auth entry preservation.
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

const homeRoute = readFileSync(join(ROOT, 'src/app/home.tsx'), 'utf8');
const homepage = readFileSync(join(ROOT, 'src/components/marketing/marketing-homepage.tsx'), 'utf8');
const indexRoute = readFileSync(join(ROOT, 'src/app/index.tsx'), 'utf8');

assert(homeRoute.includes('MarketingHomepageScreen'), 'home route renders marketing homepage');
assert(homepage.includes('Ticketing built for independent events.'), 'homepage hero headline present');
assert(
  homepage.includes('Create events. Sell tickets. Issue tickets. Scan guests.'),
  'homepage hero subheadline present',
);
assert(homepage.includes('Get Started'), 'homepage primary CTA present');
assert(homepage.includes('See How It Works'), 'homepage secondary CTA present');
assert(homepage.includes('HOW IT WORKS'), 'homepage how-it-works section present');
assert(homepage.includes('WHY 808TICKETS'), 'homepage why section present');
assert(homepage.includes('backgrounds/organizer-background.png'), 'homepage uses dot-matrix brand background asset');
assert(homepage.includes('Share links by text or email'), 'homepage mentions text/email ticket delivery');
assert(homepage.includes('Scan Guests'), 'homepage mentions scan guests');
assert(homepage.includes('href="/"'), 'homepage CTAs link to organizer auth entry at /');
assert(indexRoute.includes('OrganizerDashboard'), 'index route still renders organizer dashboard when authenticated');
assert(indexRoute.includes('validateSignInForm'), 'index route still handles organizer sign in');
assert(!indexRoute.includes('MarketingHomepage'), 'index route is not replaced by marketing homepage');

if (failures > 0) {
  console.error(`\ncheck-homepage: ${failures} failure(s)`);
  process.exit(1);
}

console.log('\ncheck-homepage: all checks passed');
