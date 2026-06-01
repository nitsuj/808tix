import * as Linking from 'expo-linking';

/**
 * Guest pass URL for sharing (expo-router: /pass/[token]).
 * Set EXPO_PUBLIC_PASS_LINK_BASE_URL to your deployed origin with no trailing slash
 * (e.g. https://808tix.vercel.app). Vercel rewrites are in vercel.json.
 */
export function buildPassLinkUrl(secureToken: string): string {
  const configuredBase = process.env.EXPO_PUBLIC_PASS_LINK_BASE_URL?.trim();

  if (configuredBase) {
    const base = configuredBase.replace(/\/+$/, '');
    const token = secureToken.trim();
    return `${base}/pass/${encodeURIComponent(token)}`;
  }

  return Linking.createURL(`/pass/${encodeURIComponent(secureToken)}`);
}
