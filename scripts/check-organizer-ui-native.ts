#!/usr/bin/env npx tsx
/**
 * Native/UI regression guards — artwork background, event title casing, iOS date picker.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();

const FILES = {
  artworkDisplay: join(ROOT, 'src/lib/event-artwork-display.ts'),
  artworkEnvironment: join(ROOT, 'src/components/ui/artwork-environment.tsx'),
  eventScreenBackground: join(ROOT, 'src/components/ui/event-screen-background.tsx'),
  dateField: join(ROOT, 'src/components/organizer/event-date-form-field.tsx'),
  eventDetail: join(ROOT, 'src/app/events/[eventId]/index.tsx'),
  editEvent: join(ROOT, 'src/app/events/[eventId]/edit.tsx'),
  organizerEventTitle: join(ROOT, 'src/theme/organizer-event-title.ts'),
} as const;

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
  return readFileSync(path, 'utf8');
}

const artworkDisplay = read(FILES.artworkDisplay);
const artworkEnvironment = read(FILES.artworkEnvironment);
const eventScreenBackground = read(FILES.eventScreenBackground);
const dateField = read(FILES.dateField);
const eventDetail = read(FILES.eventDetail);
const editEvent = read(FILES.editEvent);
const organizerEventTitle = read(FILES.organizerEventTitle);

assert(
  artworkDisplay.includes('resolveEventScreenBackgroundArtwork'),
  'shared artwork resolver exists',
);
assert(
  eventScreenBackground.includes('resolveEventScreenBackgroundArtwork'),
  'EventScreenBackground uses shared artwork resolver',
);

assert(
  eventDetail.includes('EventScreenBackground') &&
    eventDetail.includes('imageUrl={event.image_url}'),
  'Event Detail uses EventScreenBackground with event.image_url',
);
assert(
  editEvent.includes('EventScreenBackground') &&
    editEvent.includes('imageUrl={event.image_url}'),
  'Edit Event uses EventScreenBackground with event.image_url',
);
assert(
  editEvent.includes('pendingLocalUri={pendingArtwork?.localUri}'),
  'Edit Event passes pending local artwork to background',
);

assert(
  artworkEnvironment.includes('contentFit="cover"') &&
    !artworkEnvironment.includes('contentFit="contain"'),
  'artwork background uses cover (not contain)',
);
assert(
  artworkEnvironment.includes('uploadedCoverScale') || artworkEnvironment.includes('COVER_OVERSCAN'),
  'artwork background applies cover overscan',
);

assert(
  organizerEventTitle.includes("textTransform: 'none'"),
  'organizer event title style preserves casing',
);
assert(
  eventDetail.includes('...organizerEventTitleStyle.title'),
  'Event Detail eventTitle uses shared casing-preserving style',
);
assert(
  editEvent.includes('...organizerEventTitleStyle.title'),
  'Edit Event eventTitle uses shared casing-preserving style',
);

assert(
  dateField.includes('themeVariant="light"') &&
    dateField.includes("background: '#F2F2F7'") &&
    dateField.includes('presentationStyle="overFullScreen"'),
  'iOS date picker uses light readable modal presentation',
);
assert(
  !dateField.includes('formField.inputBackground') ||
    !dateField.match(/iosModalSheet:[\s\S]*formField\.inputBackground/),
  'iOS date picker sheet is not styled with dark form input background',
);

if (failures > 0) {
  console.error(`\ncheck-organizer-ui-native: ${failures} failure(s)`);
  process.exit(1);
}

console.log('\ncheck-organizer-ui-native: all checks passed');
