/**
 * Parse Supabase auth callback parameters from email confirmation / magic links.
 * Mirrors @supabase/auth-js parseParametersFromURL (hash + query; query wins).
 */
export type AuthCallbackParams = Record<string, string>;

export function parseAuthCallbackParams(href: string): AuthCallbackParams {
  const result: AuthCallbackParams = {};

  let url: URL;

  try {
    url = new URL(href);
  } catch {
    return result;
  }

  if (url.hash && url.hash.startsWith('#')) {
    try {
      const hashParams = new URLSearchParams(url.hash.slice(1));
      hashParams.forEach((value, key) => {
        result[key] = value;
      });
    } catch {
      // ignore malformed hash
    }
  }

  url.searchParams.forEach((value, key) => {
    result[key] = value;
  });

  return result;
}

export function hasSupabaseAuthCallbackParams(params: AuthCallbackParams): boolean {
  return Boolean(
    params.access_token ||
      params.code ||
      params.token_hash ||
      params.error ||
      params.error_description ||
      params.error_code,
  );
}

export type AuthCallbackIntent = {
  hasCallback: boolean;
  isSignupConfirmation: boolean;
  isRecovery: boolean;
  hasError: boolean;
  errorMessage: string | null;
};

export function getAuthCallbackIntent(params: AuthCallbackParams): AuthCallbackIntent {
  const hasCallback = hasSupabaseAuthCallbackParams(params);

  if (!hasCallback) {
    return {
      hasCallback: false,
      isSignupConfirmation: false,
      isRecovery: false,
      hasError: false,
      errorMessage: null,
    };
  }

  const hasError = Boolean(params.error || params.error_description || params.error_code);
  const errorMessage = hasError
    ? (params.error_description?.trim() || params.error?.trim() || 'Confirmation link failed.')
    : null;

  const type = params.type?.toLowerCase() ?? '';
  const isRecovery = type === 'recovery';
  const isSignupConfirmation =
    !isRecovery &&
    (type === 'signup' ||
      type === 'email' ||
      type === 'invite' ||
      Boolean(params.access_token || params.code || params.token_hash));

  return {
    hasCallback: true,
    isSignupConfirmation,
    isRecovery,
    hasError,
    errorMessage,
  };
}

/** Remove Supabase auth tokens from a URL string (for tests and post-callback cleanup). */
export function stripAuthCallbackFromUrl(href: string): string {
  let url: URL;

  try {
    url = new URL(href);
  } catch {
    return href;
  }

  const authKeys = new Set([
    'access_token',
    'refresh_token',
    'expires_in',
    'expires_at',
    'token_type',
    'type',
    'code',
    'token_hash',
    'error',
    'error_description',
    'error_code',
    'provider_token',
    'provider_refresh_token',
  ]);

  url.hash = '';
  authKeys.forEach((key) => {
    url.searchParams.delete(key);
  });

  const query = url.searchParams.toString();
  return `${url.origin}${url.pathname}${query ? `?${query}` : ''}`;
}
