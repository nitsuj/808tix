/**
 * Public wallet download URL for an existing secure_token.
 * Uses only EXPO_PUBLIC Supabase URL + anon key (no Apple signing secrets).
 */
export function buildWalletAppleUrl(secureToken: string): string | null {
  const trimmedToken = secureToken.trim();

  if (!trimmedToken) {
    return null;
  }

  const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!baseUrl || !anonKey) {
    return null;
  }

  const url = new URL(`${baseUrl.replace(/\/$/, '')}/functions/v1/wallet-apple`);
  url.searchParams.set('token', trimmedToken);
  url.searchParams.set('apikey', anonKey);

  return url.toString();
}
