import type { Profile } from '@/lib/database.types';
import { validateGuestPhone } from '@/lib/phone-validation';
import { supabase } from '@/lib/supabase';

export const ORGANIZER_PROFILE_METADATA_KEYS = {
  businessName: 'business_name',
  phoneNumber: 'phone_number',
  logoUrl: 'logo_url',
} as const;

export type OrganizerProfileFormValues = {
  displayName: string;
  businessName: string;
  phoneNumber: string;
  email: string;
  logoUrl: string | null;
};

type ProfileWithOptionalLogo = Profile & {
  logo_url?: string | null;
};

export type OrganizerProfileFieldErrors = {
  displayName?: string;
  businessName?: string;
  phoneNumber?: string;
};

function readMetadataString(metadata: Record<string, unknown> | undefined, key: string): string {
  const value = metadata?.[key];

  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
}

/** Maps existing profile row + auth user metadata into v0 profile form fields. */
/** Command Center identity line: `Name · Business` or `Name · Email` when business is empty. */
export function formatCommandCenterIdentityLine(params: {
  displayName: string;
  businessName: string;
  email: string;
}): string {
  const email = params.email.trim();
  const name = params.displayName.trim() || email || 'Organizer';
  const secondary = params.businessName.trim() || email;

  if (!secondary || secondary.toLowerCase() === name.toLowerCase()) {
    return name;
  }

  return `${name} · ${secondary}`;
}

/** First token of display name for Dashboard greeting copy. */
export function organizerFirstNameFromDisplayName(displayName: string): string {
  const trimmed = displayName.trim();

  if (!trimmed) {
    return 'Organizer';
  }

  return trimmed.split(/\s+/)[0] ?? trimmed;
}

export function formatDashboardGreeting(displayName: string, welcomeBack: boolean): string {
  const firstName = organizerFirstNameFromDisplayName(displayName);

  return welcomeBack ? `Welcome back, ${firstName}` : `Welcome, ${firstName}`;
}

/** v0 logo URL — profiles.logo_url when present, otherwise auth user_metadata.logo_url. */
export function resolveOrganizerLogoUrl(
  profile: Profile,
  userMetadata: Record<string, unknown> | undefined,
): string | null {
  const profileLogo = (profile as ProfileWithOptionalLogo).logo_url?.trim();

  if (profileLogo) {
    return profileLogo;
  }

  const metadataLogo = readMetadataString(userMetadata, ORGANIZER_PROFILE_METADATA_KEYS.logoUrl);

  return metadataLogo || null;
}

export function organizerProfileFromSources(
  profile: Profile,
  sessionEmail: string | null | undefined,
  userMetadata: Record<string, unknown> | undefined,
): OrganizerProfileFormValues {
  return {
    displayName: profile.full_name?.trim() ?? '',
    businessName: readMetadataString(userMetadata, ORGANIZER_PROFILE_METADATA_KEYS.businessName),
    phoneNumber: readMetadataString(userMetadata, ORGANIZER_PROFILE_METADATA_KEYS.phoneNumber),
    email: profile.email?.trim() || sessionEmail?.trim() || '',
    logoUrl: resolveOrganizerLogoUrl(profile, userMetadata),
  };
}

export async function persistOrganizerLogoUrl(
  logoUrl: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.auth.updateUser({
    data: {
      [ORGANIZER_PROFILE_METADATA_KEYS.logoUrl]: logoUrl.trim(),
    },
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export function validateOrganizerProfileForm(values: OrganizerProfileFormValues): OrganizerProfileFieldErrors {
  const errors: OrganizerProfileFieldErrors = {};

  if (!values.displayName.trim()) {
    errors.displayName = 'Display name is required.';
  }

  const phoneError = validateGuestPhone(values.phoneNumber);

  if (phoneError) {
    errors.phoneNumber = phoneError;
  }

  return errors;
}

export async function saveOrganizerProfile(params: {
  organizerId: string;
  displayName: string;
  businessName: string;
  phoneNumber: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const full_name = params.displayName.trim();

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ full_name })
    .eq('id', params.organizerId);

  if (profileError) {
    return { ok: false, error: profileError.message };
  }

  const { error: authError } = await supabase.auth.updateUser({
    data: {
      [ORGANIZER_PROFILE_METADATA_KEYS.businessName]: params.businessName.trim(),
      [ORGANIZER_PROFILE_METADATA_KEYS.phoneNumber]: params.phoneNumber.trim(),
    },
  });

  if (authError) {
    return { ok: false, error: authError.message };
  }

  return { ok: true };
}
