import { Platform } from 'react-native';

import { getSupabaseTargetInfo } from '@/lib/supabase-target';

/** Deterministic local-only platform admin (created by npm run qa:seed). */
export const LOCAL_QA_PLATFORM_ADMIN_EMAIL = 'platform-admin@808tix.test';
export const LOCAL_QA_PLATFORM_ADMIN_PASSWORD = 'qa-admin-password';

export const LOCAL_QA_ADMIN_PARAM = 'qaAdmin';

function isLocalAppHost(): boolean {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const host = window.location.hostname;
    return host === 'localhost' || host === '127.0.0.1';
  }

  // Native: only in development builds (never production store builds).
  return typeof __DEV__ !== 'undefined' && __DEV__;
}

/**
 * Local admin QA helper (auto-login / Continue as local platform admin).
 *
 * Enabled only when:
 * - App host is localhost / 127.0.0.1 (web) or __DEV__ (native)
 * - EXPO_PUBLIC_SUPABASE_URL points at local Supabase
 * - EXPO_PUBLIC_ENABLE_LOCAL_ADMIN_QA is not explicitly "false"
 *
 * Never enabled for https://808tickets.com or hosted Supabase.
 */
export function isLocalAdminQaEnabled(): boolean {
  if (process.env.EXPO_PUBLIC_ENABLE_LOCAL_ADMIN_QA === 'false') {
    return false;
  }

  if (!isLocalAppHost()) {
    return false;
  }

  const supabase = getSupabaseTargetInfo();
  if (!supabase.isConfigured || !supabase.isLocal) {
    return false;
  }

  return true;
}
