#!/usr/bin/env npx tsx
/**
 * Regression guard: Edit Event matches Create Event command-panel + field hierarchy.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const EDIT_EVENT_PATH = join(process.cwd(), 'src/app/events/[eventId]/edit.tsx');
const source = readFileSync(EDIT_EVENT_PATH, 'utf8');

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

assert(source.includes('EventDateFormField'), 'Edit Event uses EventDateFormField');
assert(source.includes('OrganizerAmbientBackground'), 'Edit Event uses ambient artwork background');
assert(source.includes('commandPanel'), 'Edit Event uses Event Detail-style command panel');
assert(source.includes('previewMode="background"'), 'Edit Event uses background artwork upload preview mode');

const layoutStart = source.indexOf('styles.commandPanel');
const layoutSource = layoutStart >= 0 ? source.slice(layoutStart) : source;

const artworkIndex = layoutSource.indexOf('<EventArtworkUploadField');
const eventNameIndex = layoutSource.indexOf('label="Event Name"');
const venueIndex = layoutSource.indexOf('label="Venue"');
const dateIndex = layoutSource.indexOf('<EventDateFormField');
const startTimeIndex = layoutSource.indexOf('label="Start Time"');
const maxPassesIndex = layoutSource.indexOf('label="Max Passes"');

assert(artworkIndex > -1 && artworkIndex < eventNameIndex, 'artwork field appears before Event Name');
assert(eventNameIndex > -1 && venueIndex > -1 && eventNameIndex < venueIndex, 'Event Name before Venue');
assert(venueIndex > -1 && dateIndex > -1 && venueIndex < dateIndex, 'Venue before Date');
assert(dateIndex > -1 && startTimeIndex > -1 && dateIndex < startTimeIndex, 'Date before Start Time');
assert(startTimeIndex > -1 && maxPassesIndex > -1 && startTimeIndex < maxPassesIndex, 'Start Time before Max Passes');

if (failures > 0) {
  console.error(`\ncheck-edit-event-screen: ${failures} failure(s)`);
  process.exit(1);
}

console.log('\ncheck-edit-event-screen: all checks passed');

