import type { AuthError } from '@supabase/supabase-js';

export type SupabaseTargetInfo = {
  url: string;
  host: string;
  label: string;
  isLocal: boolean;
  isConfigured: boolean;
};

export function getSupabaseTargetInfo(): SupabaseTargetInfo {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '';
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '';

  if (!url) {
    return {
      url: '',
      host: 'not configured',
      label: 'Supabase',
      isLocal: false,
      isConfigured: false,
    };
  }

  try {
    const parsed = new URL(url);
    const isLocal =
      parsed.hostname === '127.0.0.1' ||
      parsed.hostname === 'localhost' ||
      parsed.hostname.endsWith('.local');

    return {
      url,
      host: parsed.host,
      label: isLocal ? 'Local Supabase' : 'Hosted Supabase',
      isLocal,
      isConfigured: Boolean(anonKey),
    };
  } catch {
    return {
      url,
      host: 'invalid URL',
      label: 'Supabase',
      isLocal: false,
      isConfigured: Boolean(anonKey),
    };
  }
}

export function formatAuthSignInError(error: AuthError | Error, target: SupabaseTargetInfo): string {
  return formatAuthError(error, target);
}

export function formatAuthError(error: AuthError | Error, target: SupabaseTargetInfo): string {
  const message = error.message ?? 'Sign in failed.';

  if (!target.isConfigured) {
    return 'Missing Supabase env vars. Copy .env.example to .env and set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.';
  }

  const lower = message.toLowerCase();

  if (
    lower.includes('failed to fetch') ||
    lower.includes('network request failed') ||
    lower.includes('networkerror') ||
    lower.includes('load failed')
  ) {
    if (target.isLocal) {
      return `Cannot reach local Supabase at ${target.host}. Start it with: supabase start — then restart the app (npm run web).`;
    }

    return `Cannot reach hosted Supabase at ${target.host}. Check EXPO_PUBLIC_SUPABASE_URL and your network connection.`;
  }

  if (lower.includes('invalid login credentials') || lower.includes('invalid email or password')) {
    return 'Email or password is incorrect for this Supabase project.';
  }

  if (lower.includes('user already registered')) {
    return 'An account with this email already exists. Sign in instead.';
  }

  if (lower.includes('password should be at least')) {
    return 'Password does not meet Supabase requirements. Use at least 8 characters.';
  }

  if (lower.includes('signup is disabled')) {
    return 'Account creation is disabled for this Supabase project. Contact support.';
  }

  return message;
}
