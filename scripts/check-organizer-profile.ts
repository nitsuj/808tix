#!/usr/bin/env npx tsx
/**
 * Organizer Profile v0 — route, persistence, Command Center entry.
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

const profileScreen = readFileSync(join(ROOT, 'src/app/profile.tsx'), 'utf8');
const profileLib = readFileSync(join(ROOT, 'src/lib/organizer-profile.ts'), 'utf8');
const logoUpload = readFileSync(join(ROOT, 'src/components/organizer/organizer-logo-upload.tsx'), 'utf8');
const dashboard = readFileSync(join(ROOT, 'src/components/organizer/organizer-dashboard.tsx'), 'utf8');
const authContext = readFileSync(join(ROOT, 'src/contexts/auth-context.tsx'), 'utf8');

assert(!profileScreen.includes("router.push('/profile'"), 'profile screen does not self-link');
assert(dashboard.includes("router.push('/profile'"), 'dashboard links to profile');
assert(dashboard.includes('Manage profile'), 'dashboard shows manage profile affordance');
assert(!dashboard.includes('profileIdentity'), 'dashboard has no profile identity card');
assert(!dashboard.includes('profileButtonText'), 'dashboard has no top-right Profile link');
assert(dashboard.includes('greetingLine'), 'dashboard shows greeting line');
assert(profileScreen.includes('EventFormField'), 'profile uses shared EventFormField');
assert(profileScreen.includes('Save Profile'), 'profile has Save Profile action');
assert(profileScreen.includes('Sign Out'), 'profile has Sign Out action');
assert(profileScreen.includes('Coming Soon'), 'profile shows coming soon placeholders');
assert(profileScreen.includes('Profile Logo'), 'profile shows profile logo section');
assert(
  profileScreen.includes('OrganizerLogoUpload') &&
    logoUpload.includes('editBadge') &&
    logoUpload.includes('handlePickLogo') &&
    !logoUpload.includes('actionButton') &&
    !logoUpload.includes('EVENT_ARTWORK_REQUIREMENTS_LABEL'),
  'profile uses inline avatar edit affordance without file requirements helper text',
);
assert(
  dashboard.includes('ORGANIZER_AVATAR_SIZE') &&
    !dashboard.includes('size={40}'),
  'dashboard avatar uses shared large organizer avatar size',
);
assert(profileScreen.includes('profileHero'), 'profile shows identity hero');
assert(
  !profileScreen.includes('Profile Photo / Logo'),
  'profile logo is no longer marked coming soon',
);
assert(!profileScreen.includes('Business Information'), 'profile has no separate business section');
assert(profileScreen.includes('Read-only'), 'profile marks email as read-only');

assert(profileLib.includes(".from('profiles')"), 'profile saves display name to profiles table');
assert(profileLib.includes('auth.updateUser'), 'profile saves business/phone to auth user metadata');
assert(profileLib.includes('full_name'), 'profile maps display name to full_name column');
assert(profileLib.includes('business_name'), 'profile uses business_name metadata key');
assert(profileLib.includes('phone_number'), 'profile uses phone_number metadata key');
assert(profileLib.includes('logo_url'), 'profile uses logo_url metadata key');
assert(profileLib.includes('resolveOrganizerLogoUrl'), 'profile resolves logo from profile or metadata');
assert(profileLib.includes('persistOrganizerLogoUrl'), 'profile persists logo_url to auth metadata');
assert(
  dashboard.includes('OrganizerAvatar') &&
    dashboard.includes('avatarHit') &&
    dashboard.includes("router.push('/profile'"),
  'dashboard avatar opens profile',
);
assert(!dashboard.includes('profileIdentity'), 'dashboard does not reintroduce large identity card');
assert(
  profileLib.includes('formatCommandCenterIdentityLine'),
  'Command Center identity line formatter exists',
);
assert(!dashboard.includes('onSignOut'), 'dashboard has no sign out control');
assert(!dashboard.includes('Sign out'), 'dashboard has no sign out control');
assert(
  profileLib.includes('formatDashboardGreeting'),
  'dashboard greeting formatter exists',
);

assert(profileScreen.includes('reloadProfile'), 'profile reloads profile after save');
assert(
  profileScreen.indexOf("authGate.state === 'unauthenticated'") <
    profileScreen.indexOf('!initialValues'),
  'profile handles unauthenticated before empty-profile spinner',
);
assert(
  profileScreen.includes('useOrganizerAuthRedirect') && profileScreen.includes('onSignOut={signOut}'),
  'profile sign out uses auth signOut and effect-based auth redirect',
);
assert(
  !profileScreen.match(/onSignOut[\s\S]*router\.replace/),
  'profile sign out does not router.replace during handler',
);
assert(
  authContext.includes('setSession(null)') &&
    authContext.match(/signOut[\s\S]*setProfile\(null\)/),
  'auth signOut clears session and profile immediately',
);

if (failures > 0) {
  console.error(`\ncheck-organizer-profile: ${failures} failure(s)`);
  process.exit(1);
}

console.log('\ncheck-organizer-profile: all checks passed');
