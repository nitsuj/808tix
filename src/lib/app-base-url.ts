import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

import { normalizePassLinkBaseUrl } from '@/lib/pass-link.core';

/**
 * Absolute site origin for buyer purchase return URLs (Stripe success/cancel).
 * Web prefers the current browser origin; production builds may set EXPO_PUBLIC_PASS_LINK_BASE_URL.
 */
export function resolveAppBaseUrl(): string {
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

export function buildAbsoluteAppUrl(pathname: string): string {
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const base = resolveAppBaseUrl();
  const url = new URL(path, `${base}/`);

  if (!/^https?:\/\//i.test(url.href)) {
    throw new Error(`buildAbsoluteAppUrl: expected absolute URL, got ${url.href}`);
  }

  return url.href;
}
