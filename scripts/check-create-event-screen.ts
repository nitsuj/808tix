#!/usr/bin/env npx tsx
/**
 * Regression guard: Create Event must support artwork upload and date picker.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const CREATE_EVENT_PATH = join(process.cwd(), 'src/app/events/create.tsx');
const source = readFileSync(CREATE_EVENT_PATH, 'utf8');

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

assert(source.includes('EventArtworkUploadField'), 'Create Event imports EventArtworkUploadField');
assert(source.includes('uploadEventArtwork'), 'Create Event uploads artwork via shared helper');
assert(source.includes('persistEventArtworkUrl'), 'Create Event persists image_url after upload');
assert(source.includes('EventDateFormField'), 'Create Event uses EventDateFormField date picker');

assert(
  source.includes('EventScreenBackground'),
  'Create Event uses full-bleed artwork background like Event Detail',
);
assert(source.includes('commandPanel'), 'Create Event uses Event Detail-style command panel');
assert(source.includes('passScreen.credential'), 'Create Event uses credential panel tokens');

const layoutStart = source.indexOf('styles.commandPanel');
const layoutSource = layoutStart >= 0 ? source.slice(layoutStart) : source;

const artworkIndex = layoutSource.indexOf('<EventArtworkUploadField');
const eventNameIndex = layoutSource.indexOf('label="Event Name"');
const venueIndex = layoutSource.indexOf('label="Venue"');
const dateIndex = layoutSource.indexOf('<EventDateFormField');
const startTimeIndex = layoutSource.indexOf('label="Start Time"');
const maxPassesIndex = layoutSource.indexOf('label="Max Passes"');

assert(artworkIndex > -1 && artworkIndex < eventNameIndex, 'artwork field appears before Event Name');
assert(eventNameIndex < venueIndex, 'Event Name before Venue');
assert(venueIndex < dateIndex, 'Venue before Date');
assert(dateIndex < startTimeIndex, 'Date before Start Time');
assert(startTimeIndex < maxPassesIndex, 'Start Time before Max Passes');

assert(
  source.includes('artworkUploadFailed'),
  'Create Event handles artwork upload failure without rolling back event',
);

if (failures > 0) {
  console.error(`\ncheck-create-event-screen: ${failures} failure(s)`);
  process.exit(1);
}

console.log('\ncheck-create-event-screen: all checks passed');
