import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

/**
 * Guest pass URL for sharing (expo-router: /pass/[token]).
 * Set EXPO_PUBLIC_PASS_LINK_BASE_URL to your deployed origin (protocol required;
 * https:// is prepended automatically if omitted).
 * Vercel rewrites: vercel.json → /pass/:token → /pass/[token].html
 */
export function normalizePassLinkBaseUrl(raw: string | undefined | null): string | null {
  const trimmed = raw?.trim();

  if (!trimmed) {
    return null;
  }

  let candidate = trimmed.replace(/\/+$/, '');

  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  try {
    const parsed = new URL(candidate);
    if (!parsed.hostname) {
      return null;
    }

    return parsed.origin;
  } catch {
    return null;
  }
}

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
  const token = secureToken.trim();

  if (!token) {
    throw new Error('buildPassLinkUrl: secureToken is required.');
  }

  const base = resolvePassLinkBaseUrl();
  const url = new URL(`/pass/${encodeURIComponent(token)}`, `${base}/`);

  if (!/^https?:\/\//i.test(url.href)) {
    throw new Error(`buildPassLinkUrl: expected absolute URL, got ${url.href}`);
  }

  return url.href;
}
