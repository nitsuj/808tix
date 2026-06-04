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
  eventArtwork: join(ROOT, 'src/components/ui/event-artwork.tsx'),
  eventScreenBackground: join(ROOT, 'src/components/ui/event-screen-background.tsx'),
  dateField: join(ROOT, 'src/components/organizer/event-date-form-field.tsx'),
  eventDetail: join(ROOT, 'src/app/events/[eventId]/index.tsx'),
  editEvent: join(ROOT, 'src/app/events/[eventId]/edit.tsx'),
  organizerDashboard: join(ROOT, 'src/components/organizer/organizer-dashboard.tsx'),
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
const eventArtwork = read(FILES.eventArtwork);
const eventScreenBackground = read(FILES.eventScreenBackground);
const dateField = read(FILES.dateField);
const eventDetail = read(FILES.eventDetail);
const editEvent = read(FILES.editEvent);
const organizerDashboard = read(FILES.organizerDashboard);
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
  eventScreenBackground.includes('useWindowDimensions'),
  'full-screen background uses explicit window dimensions',
);

assert(
  eventDetail.includes('EventScreenBackground') &&
    eventDetail.includes('imageUrl={event.image_url}'),
  'Event Detail uses canonical EventScreenBackground with event.image_url',
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
  eventArtwork.includes('source={{ uri: resolvedImageUrl }}') &&
    eventArtwork.includes('cachePolicy="none"') &&
    eventArtwork.includes('StyleSheet.absoluteFill'),
  'Command Center EventArtwork uses uri source, cachePolicy none, absoluteFill',
);
assert(
  artworkEnvironment.includes('source={{ uri: artworkUri }}') &&
    artworkEnvironment.includes('cachePolicy="none"') &&
    artworkEnvironment.includes('styles.uploadedImage'),
  'uploaded full-screen artwork uses same uri source shape as Command Center',
);
assert(
  artworkEnvironment.match(/uploadedImage:[\s\S]*StyleSheet\.absoluteFill/) &&
    !artworkEnvironment.includes('uploadedCoverScale'),
  'uploaded full-screen image uses absoluteFill without overscan transform',
);
assert(
  !artworkEnvironment.includes('COVER_OVERSCAN_PERCENT') &&
    !artworkEnvironment.includes('coverImage'),
  'ArtworkEnvironment does not use broken percentage cover layout',
);
assert(
  artworkEnvironment.includes("height: '100%'") &&
    artworkEnvironment.includes("width: '100%'"),
  'full-screen artwork environment has explicit percent dimensions',
);
assert(
  artworkEnvironment.includes('styles.uploadedBottomFade') &&
    artworkEnvironment.match(/isUploaded \?[\s\S]*styles\.uploadedImage/),
  'uploaded image renders before bottom fade overlay',
);
assert(
  artworkEnvironment.includes('artLayerScaled') &&
    artworkEnvironment.match(/isUploaded \?[\s\S]*: \([\s\S]*artLayerScaled/),
  'cover scale transform applies only to fallback blur layer',
);
assert(
  eventScreenBackground.includes('artwork.uri') &&
    eventScreenBackground.includes('ArtworkEnvironment'),
  'EventScreenBackground passes resolved uri to ArtworkEnvironment',
);

assert(
  artworkEnvironment.includes('contentFit="cover"') &&
    !artworkEnvironment.includes('contentFit="contain"'),
  'artwork background uses cover (not contain)',
);

import { resolveEventScreenBackgroundArtwork } from '../src/lib/event-artwork-display';

const uploaded = resolveEventScreenBackgroundArtwork(
  'https://cdn.example.com/event-artwork.jpg',
  'Summer Session',
);
assert(
  uploaded.uri === 'https://cdn.example.com/event-artwork.jpg' && uploaded.isUploaded === true,
  'resolver preserves image_url when event artwork exists',
);

assert(
  organizerEventTitle.includes("textTransform: 'none'") &&
    organizerEventTitle.includes("textTransform: 'uppercase'"),
  'organizer title styles separate form casing from display uppercase',
);
assert(
  eventDetail.includes('...organizerEventDisplayTitleStyle.title'),
  'Event Detail eventTitle uses shared display uppercase style',
);
assert(
  organizerDashboard.includes('organizerEventDisplayTitleStyle.cardTitle'),
  'Command Center event cards use shared display uppercase style',
);
assert(
  editEvent.includes('...organizerEventTitleStyle.title'),
  'Edit Event eventTitle uses form casing-preserving style',
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
