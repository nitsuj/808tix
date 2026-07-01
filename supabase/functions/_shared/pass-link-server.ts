const PREVIEW_PLACEHOLDER_ORIGIN = 'http://public-site-url-not-configured.invalid';

export function normalizePublicSiteUrl(raw: string | undefined | null): string | null {
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

export function isPreviewDeliveryMode(): boolean {
  const mode = Deno.env.get('EMAIL_DELIVERY_MODE')?.trim().toLowerCase();
  return mode === 'preview' || !Deno.env.get('RESEND_API_KEY')?.trim();
}

/**
 * Resolves PUBLIC_SITE_URL for Edge Function email/link building.
 * In preview mode, returns a safe placeholder when unset.
 */
export function resolvePublicSiteUrl(): string {
  const fromEnv = normalizePublicSiteUrl(Deno.env.get('PUBLIC_SITE_URL'));

  if (fromEnv) {
    return fromEnv;
  }

  if (isPreviewDeliveryMode()) {
    return PREVIEW_PLACEHOLDER_ORIGIN;
  }

  throw new Error('PUBLIC_SITE_URL is not configured.');
}

export function buildPassLinkUrl(secureToken: string, baseOrigin?: string): string {
  const token = secureToken.trim();

  if (!token) {
    throw new Error('buildPassLinkUrl: secureToken is required.');
  }

  const base = (baseOrigin ?? resolvePublicSiteUrl()).replace(/\/+$/, '');
  const url = new URL(`/pass/${encodeURIComponent(token)}`, `${base}/`);

  if (!/^https?:\/\//i.test(url.href)) {
    throw new Error(`buildPassLinkUrl: expected absolute URL, got ${url.href}`);
  }

  return url.href;
}

export function buildPurchaseSuccessUrl(
  publicAccessToken: string,
  baseOrigin?: string,
): string {
  const token = publicAccessToken.trim();

  if (!token) {
    throw new Error('buildPurchaseSuccessUrl: publicAccessToken is required.');
  }

  const base = (baseOrigin ?? resolvePublicSiteUrl()).replace(/\/+$/, '');
  const url = new URL('/purchase/success', `${base}/`);
  url.searchParams.set('order_token', token);

  if (!/^https?:\/\//i.test(url.href)) {
    throw new Error(`buildPurchaseSuccessUrl: expected absolute URL, got ${url.href}`);
  }

  return url.href;
}
