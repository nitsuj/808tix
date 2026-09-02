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

/**
 * Map Auth / local QA failures to actionable remediation.
 * Never surface bare GoTrue "Database error querying schema" without next steps.
 */
export function formatLocalAdminQaSignInError(error: {
  message?: string;
  code?: string;
  status?: number;
  name?: string;
}): string {
  const message = error.message ?? 'Sign in failed';
  const lower = message.toLowerCase();
  const supabase = getSupabaseTargetInfo();

  if (!supabase.isConfigured) {
    return 'Missing Supabase env. Run: eval "$(npm run -s qa:env -- --exports-only)" then restart Expo web.';
  }

  if (!supabase.isLocal) {
    return 'Local admin QA is disabled because this app is not pointed at local Supabase. Run: eval "$(npm run -s qa:env -- --exports-only)" and restart Expo.';
  }

  if (
    lower.includes('failed to fetch') ||
    lower.includes('network request failed') ||
    lower.includes('networkerror') ||
    lower.includes('load failed')
  ) {
    return 'Local Supabase is not reachable. Run: supabase start';
  }

  if (lower.includes('invalid login') || lower.includes('invalid email or password')) {
    return 'Local platform admin user missing or password mismatch. Run: npm run qa:seed';
  }

  if (
    lower.includes('database error querying schema') ||
    lower.includes('unexpected_failure') ||
    error.code === 'unexpected_failure'
  ) {
    return 'Local Auth user is incomplete (missing auth.identities). Run: npm run qa:seed';
  }

  if (lower.includes('email not confirmed')) {
    return 'Local platform admin email is unconfirmed. Run: npm run qa:seed';
  }

  return `${message} — try: npm run qa:seed`;
}
