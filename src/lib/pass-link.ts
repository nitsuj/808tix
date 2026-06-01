import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

import {
  buildAbsolutePassLinkUrl,
  normalizePassLinkBaseUrl,
} from '@/lib/pass-link.core';

export { normalizePassLinkBaseUrl } from '@/lib/pass-link.core';

/**
 * Guest pass URL for sharing (expo-router: /pass/[token]).
 * Set EXPO_PUBLIC_PASS_LINK_BASE_URL to your deployed origin (protocol required;
 * https:// is prepended automatically if omitted).
 * Vercel rewrites: vercel.json → /pass/:token → /pass/[token].html
 */
function resolvePassLinkBaseUrl(): string {
  const fromEnv = normalizePassLinkBaseUrl(process.env.EXPO_PUBLIC_PASS_LINK_BASE_URL);

  if (fromEnv) {
    return fromEnv;
  }

  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/+$/, '');
  }

  try {
    const linkingRoot = Linking.createURL('/');
    return new URL(linkingRoot).origin;
  } catch {
    return 'http://localhost:8081';
  }
}

/**
 * Absolute guest pass URL — always includes http(s):// origin.
 */
export function buildPassLinkUrl(secureToken: string): string {
  return buildAbsolutePassLinkUrl(resolvePassLinkBaseUrl(), secureToken);
}
