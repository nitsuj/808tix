import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

import {
  buildAbsolutePassLinkUrl,
  buildPassRoutePath,
  normalizePassLinkBaseUrl,
} from '@/lib/pass-link.core';

export { buildPassRoutePath, normalizePassLinkBaseUrl } from '@/lib/pass-link.core';

/**
 * Guest pass URL for sharing (expo-router: /pass/[token]).
 * Set EXPO_PUBLIC_PASS_LINK_BASE_URL to your deployed origin (protocol required;
 * https:// is prepended automatically if omitted).
 * Vercel rewrites: vercel.json → /pass/:token → /pass/[token].html
 */
function resolvePassLinkBaseUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/+$/, '');
  }

  const fromEnv = normalizePassLinkBaseUrl(process.env.EXPO_PUBLIC_PASS_LINK_BASE_URL);

  if (fromEnv) {
    return fromEnv;
  }

  try {
    const linkingRoot = Linking.createURL('/');
    return new URL(linkingRoot).origin;
  } catch {
    return 'http://localhost:8081';
  }
}

/**
 * In-app guest pass route for organizer "View Guest Pass" and local QA.
 */
export function getPassRoute(secureToken: string): string {
  return buildPassRoutePath(secureToken);
}

/**
 * Absolute public guest pass URL for share, SMS, and email.
 * On web, uses the current browser origin (local QA or production).
 * On native, falls back to EXPO_PUBLIC_PASS_LINK_BASE_URL when set.
 */
export function getPublicPassUrl(secureToken: string): string {
  return buildPassLinkUrl(secureToken);
}

/**
 * Absolute guest pass URL — always includes http(s):// origin.
 */
export function buildPassLinkUrl(secureToken: string): string {
  return buildAbsolutePassLinkUrl(resolvePassLinkBaseUrl(), secureToken);
}
