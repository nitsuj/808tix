#!/usr/bin/env npx tsx
/**
 * Organizer avatar crop/fit — shared CoverImageFrame and picker wiring.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();

const coverFrame = readFileSync(join(ROOT, 'src/components/ui/cover-image-frame.tsx'), 'utf8');
const organizerAvatar = readFileSync(join(ROOT, 'src/components/organizer/organizer-avatar.tsx'), 'utf8');
const logoUpload = readFileSync(join(ROOT, 'src/components/organizer/organizer-logo-upload.tsx'), 'utf8');
const dashboard = readFileSync(join(ROOT, 'src/components/organizer/organizer-dashboard.tsx'), 'utf8');
const profileScreen = readFileSync(join(ROOT, 'src/app/profile.tsx'), 'utf8');
const eventArtworkUpload = readFileSync(
  join(ROOT, 'src/components/organizer/event-artwork-upload-field.tsx'),
  'utf8',
);

let failures = 0;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`✗ ${message}`);
    failures += 1;
    return;
  }
  console.log(`✓ ${message}`);
}

assert(coverFrame.includes('contentFit="cover"'), 'CoverImageFrame uses cover fit');
assert(coverFrame.includes('contentPosition="center"'), 'CoverImageFrame center-crops');
assert(coverFrame.includes("overflow: 'hidden'"), 'CoverImageFrame enforces clip overflow');
assert(
  coverFrame.includes('Future event artwork'),
  'CoverImageFrame documents future event artwork reuse',
);
assert(
  coverFrame.includes("shape: CoverImageShape = 'circle' | 'rounded' | 'square'") ||
    coverFrame.includes("'circle' | 'rounded' | 'square'"),
  'CoverImageFrame supports circle, rounded, and square shapes',
);

assert(organizerAvatar.includes('CoverImageFrame'), 'OrganizerAvatar uses CoverImageFrame');
assert(organizerAvatar.includes('shape="circle"'), 'OrganizerAvatar uses circular shape');
assert(!organizerAvatar.includes('from \'expo-image\''), 'OrganizerAvatar has no duplicate expo-image path');
assert(organizerAvatar.includes('808'), 'OrganizerAvatar preserves 808 placeholder');

assert(
  logoUpload.includes('OrganizerAvatar') && !logoUpload.includes('from \'expo-image\''),
  'Profile logo upload renders via OrganizerAvatar only',
);
assert(logoUpload.includes('allowsEditing: true'), 'Logo picker keeps native crop editor enabled');
assert(logoUpload.includes('aspect: [1, 1]'), 'Logo picker keeps square aspect ratio');
assert(!logoUpload.includes('EVENT_ARTWORK_REQUIREMENTS_LABEL'), 'Logo upload helper text remains removed');

assert(
  dashboard.includes('OrganizerAvatar') && !dashboard.match(/logoUrl[\s\S]*from 'expo-image'/),
  'Dashboard avatar uses OrganizerAvatar without separate image renderer',
);
assert(
  profileScreen.includes('OrganizerLogoUpload'),
  'Profile uses OrganizerLogoUpload for avatar',
);

assert(
  eventArtworkUpload.includes('allowsEditing: false'),
  'Event artwork upload behavior unchanged',
);
assert(
  !eventArtworkUpload.includes('CoverImageFrame'),
  'Event artwork upload not migrated in this pass',
);

if (failures > 0) {
  console.error(`\ncheck-organizer-avatar: ${failures} failure(s)`);
  process.exit(1);
}

console.log('\ncheck-organizer-avatar: all checks passed');
