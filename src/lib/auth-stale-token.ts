import type { AuthError } from '@supabase/supabase-js';

const STALE_REFRESH_TOKEN_MESSAGE_FRAGMENTS = [
  'invalid refresh token',
  'refresh token not found',
] as const;

/** Known recoverable stale-session errors from Supabase GoTrue refresh. */
export function isStaleRefreshTokenError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const authError = error as Partial<AuthError> & { message?: string; code?: string };
  const message = (authError.message ?? '').toLowerCase();
  const code = (authError.code ?? '').toLowerCase();

  if (code === 'refresh_token_not_found') {
    return true;
  }

  return STALE_REFRESH_TOKEN_MESSAGE_FRAGMENTS.some((fragment) => message.includes(fragment));
}
