/**
 * Pure pass-link helpers (no React Native). Used by pass-link.ts and QA scripts.
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

/** In-app expo-router path for organizer preview and local QA. */
export function buildPassRoutePath(secureToken: string): string {
  const token = secureToken.trim();

  if (!token) {
    throw new Error('buildPassRoutePath: secureToken is required.');
  }

  return `/pass/${encodeURIComponent(token)}`;
}

export function buildAbsolutePassLinkUrl(baseOrigin: string, secureToken: string): string {
  const token = secureToken.trim();

  if (!token) {
    throw new Error('buildAbsolutePassLinkUrl: secureToken is required.');
  }

  const base = baseOrigin.replace(/\/+$/, '');
  const url = new URL(`/pass/${encodeURIComponent(token)}`, `${base}/`);

  if (!/^https?:\/\//i.test(url.href)) {
    throw new Error(`buildAbsolutePassLinkUrl: expected absolute URL, got ${url.href}`);
  }

  return url.href;
}
