import { normalizePassLinkBaseUrl } from '@/lib/pass-link.core';

const PRODUCTION_FALLBACK_ORIGIN = 'https://808tickets.com';

/**
 * Resolve origin for Supabase auth emailRedirectTo (signup / magic-link callbacks).
 * Web prefers the current browser origin; falls back to EXPO_PUBLIC_PASS_LINK_BASE_URL.
 */
export function resolveAuthEmailRedirectOriginFromSources(
  webOrigin: string | null | undefined,
  envPassLinkBaseUrl: string | null | undefined,
): string {
  const trimmedWeb = webOrigin?.trim().replace(/\/+$/, '');

  if (trimmedWeb && /^https?:\/\//i.test(trimmedWeb)) {
    try {
      return new URL(trimmedWeb).origin;
    } catch {
      // fall through
    }
  }

  const fromEnv = normalizePassLinkBaseUrl(envPassLinkBaseUrl);

  if (fromEnv) {
    return fromEnv;
  }

  return PRODUCTION_FALLBACK_ORIGIN;
}

export function buildAuthEmailRedirectUrl(origin: string): string {
  const base = origin.replace(/\/+$/, '');
  return `${base}/`;
}
