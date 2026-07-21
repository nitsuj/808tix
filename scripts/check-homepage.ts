#!/usr/bin/env npx tsx
/**
 * Public marketing homepage — consumer discovery + secondary organizer entry.
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
const loginRoute = readFileSync(join(ROOT, 'src/app/login.tsx'), 'utf8');
const authScreen = readFileSync(
  join(ROOT, 'src/components/organizer/organizer-auth-screen.tsx'),
  'utf8',
);
const publicEvents = readFileSync(
  join(ROOT, 'src/components/marketing/public-upcoming-events.tsx'),
  'utf8',
);
const listRpcMigration = readFileSync(
  join(ROOT, 'supabase/migrations/20260721120000_list_public_upcoming_events.sql'),
  'utf8',
);

assert(homeRoute.includes('MarketingHomepageScreen'), 'home route renders marketing homepage');
assert(indexRoute.includes('MarketingHomepageScreen'), 'unauthenticated index renders public homepage');
assert(indexRoute.includes('OrganizerDashboard'), 'index route still renders organizer dashboard when authenticated');
assert(loginRoute.includes('OrganizerAuthScreen'), 'login route renders organizer auth');
assert(loginRoute.includes('Redirect'), 'login redirects authenticated organizers to /');
assert(authScreen.includes('validateSignInForm'), 'organizer auth screen handles sign in');
assert(homepage.includes('Ticketing built for independent events.'), 'homepage hero headline present');
assert(
  homepage.includes('Create events. Sell tickets. Issue tickets. Scan guests.'),
  'homepage hero subheadline present',
);
assert(homepage.includes('Browse Events'), 'homepage primary consumer CTA present');
assert(homepage.includes('See How It Works'), 'homepage secondary CTA present');
assert(homepage.includes('Organizer Login'), 'homepage keeps secondary organizer login');
assert(homepage.includes('Create Event'), 'homepage keeps secondary create-event entry');
assert(homepage.includes('HOW IT WORKS'), 'homepage how-it-works section present');
assert(homepage.includes('WHY 808TICKETS'), 'homepage why section present');
assert(homepage.includes('backgrounds/organizer-background.png'), 'homepage uses dot-matrix brand background asset');
assert(homepage.includes('Share links by text or email'), 'homepage mentions text/email ticket delivery');
assert(homepage.includes('Scan Guests'), 'homepage mentions scan guests');
assert(homepage.includes('href="/login"'), 'organizer CTAs link to /login');
assert(homepage.includes('PublicUpcomingEventsSection'), 'homepage includes public upcoming events section');
assert(publicEvents.includes('Get Tickets'), 'public event cards expose Get Tickets CTA');
assert(publicEvents.includes('fetchPublicUpcomingEvents'), 'public events fetch list RPC helper');
assert(
  listRpcMigration.includes('list_public_upcoming_events') &&
    listRpcMigration.includes('security definer') &&
    listRpcMigration.includes('grant execute'),
  'migration defines anon-safe list_public_upcoming_events RPC',
);

if (failures > 0) {
  console.error(`\ncheck-homepage: ${failures} failure(s)`);
  process.exit(1);
}

console.log('\ncheck-homepage: all checks passed');
