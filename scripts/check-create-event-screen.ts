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
assert(source.includes('EventStartTimeField'), 'Create Event uses EventStartTimeField time picker');
assert(
  source.includes('12-hour AM/PM') || source.includes('12-hour'),
  'Create Event start time hint expects 12-hour AM/PM',
);

const dateFieldSource = readFileSync(
  join(process.cwd(), 'src/components/organizer/event-date-form-field.tsx'),
  'utf8',
);
const timeFieldSource = readFileSync(
  join(process.cwd(), 'src/components/organizer/event-start-time-field.tsx'),
  'utf8',
);

assert(
  dateFieldSource.includes('accessibilityRole="button"') &&
    dateFieldSource.includes('Tap to choose a date') &&
    dateFieldSource.includes('type="date"') &&
    dateFieldSource.includes('DateTimePicker') &&
    dateFieldSource.includes('mode="date"'),
  'EventDateFormField exposes date picker trigger and DateTimePicker',
);

assert(
  dateFieldSource.includes('formatEventDateForDisplay') &&
    !dateFieldSource.includes('keyboardType="number-pad"'),
  'EventDateFormField uses display formatter, not number-pad manual date entry',
);

assert(
  timeFieldSource.includes('accessibilityRole="button"') &&
    timeFieldSource.includes('DateTimePicker') &&
    timeFieldSource.includes('mode="time"') &&
    timeFieldSource.includes('is24Hour={false}') &&
    timeFieldSource.includes('formatHhMmTo12HourDisplay') &&
    timeFieldSource.includes('type="time"'),
  'EventStartTimeField exposes 12-hour time picker (not 24-hour-only manual input)',
);

assert(
  !timeFieldSource.includes('keyboardType="number-pad"') &&
    !timeFieldSource.includes('normalizeTimeDisplayFromDigits'),
  'EventStartTimeField is not a digit-only 24-hour TextInput',
);
assert(
  source.includes('EventScreenBackground'),
  'Create Event uses full-bleed artwork background like Event Detail',
);
assert(source.includes('commandPanel'), 'Create Event uses Event Detail-style command panel');
assert(source.includes('organizerOpsScreen.panel'), 'Create Event uses shared organizer ops panel tokens');

const layoutStart = source.indexOf('styles.commandPanel');
const layoutSource = layoutStart >= 0 ? source.slice(layoutStart) : source;

const artworkIndex = layoutSource.indexOf('<EventArtworkUploadField');
const eventNameIndex = layoutSource.indexOf('label="Event Name"');
const venueIndex = layoutSource.indexOf('label="Venue"');
const dateIndex = layoutSource.indexOf('<EventDateFormField');
const startTimeIndex = layoutSource.indexOf('label="Start Time"');
const maxPassesIndex = layoutSource.indexOf('label="Max tickets"');

assert(artworkIndex > -1 && artworkIndex < eventNameIndex, 'artwork field appears before Event Name');
assert(eventNameIndex < venueIndex, 'Event Name before Venue');
assert(venueIndex < dateIndex, 'Venue before Date');
assert(dateIndex < startTimeIndex, 'Date before Start Time');
assert(startTimeIndex < maxPassesIndex, 'Start Time before Max tickets');

assert(
  source.includes('artworkUploadFailed'),
  'Create Event handles artwork upload failure without rolling back event',
);

if (failures > 0) {
  console.error(`\ncheck-create-event-screen: ${failures} failure(s)`);
  process.exit(1);
}

console.log('\ncheck-create-event-screen: all checks passed');
