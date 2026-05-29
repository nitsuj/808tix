import * as Linking from 'expo-linking';

/** Guest pass URL path segment (expo-router: /pass/[token]). */
export function buildPassLinkUrl(secureToken: string): string {
  const configuredBase = process.env.EXPO_PUBLIC_PASS_LINK_BASE_URL?.trim();

  if (configuredBase) {
    const base = configuredBase.replace(/\/$/, '');
    return `${base}/pass/${encodeURIComponent(secureToken)}`;
  }

  return Linking.createURL(`/pass/${encodeURIComponent(secureToken)}`);
}
