import { Platform } from 'react-native';

import {
  buildAuthEmailRedirectUrl,
  resolveAuthEmailRedirectOriginFromSources,
} from '@/lib/auth-redirect-url.core';

export {
  buildAuthEmailRedirectUrl,
  resolveAuthEmailRedirectOriginFromSources,
} from '@/lib/auth-redirect-url.core';

/**
 * Full URL passed to supabase.auth.signUp({ options: { emailRedirectTo } }).
 * On web uses window.location.origin so hosted signup confirms on the same host.
 */
export function resolveAuthEmailRedirectUrl(): string {
  const webOrigin =
    Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : null;

  const origin = resolveAuthEmailRedirectOriginFromSources(
    webOrigin,
    process.env.EXPO_PUBLIC_PASS_LINK_BASE_URL,
  );

  return buildAuthEmailRedirectUrl(origin);
}
