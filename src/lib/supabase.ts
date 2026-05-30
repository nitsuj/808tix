import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';
import { getSupabaseAuthStorage } from '@/lib/supabase-auth-storage';

if (Platform.OS !== 'web') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('react-native-url-polyfill/auto');
}

function getSupabaseConfig() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    throw new Error(
      'Missing Supabase env vars. Copy .env.example to .env and set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.',
    );
  }

  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    throw new Error(
      `Invalid EXPO_PUBLIC_SUPABASE_URL: must be a valid HTTP or HTTPS URL. Received ${JSON.stringify(url)}.`,
    );
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(
      `Invalid EXPO_PUBLIC_SUPABASE_URL: must use http: or https:. Received ${JSON.stringify(url)}.`,
    );
  }

  return { url, anonKey };
}

const { url, anonKey } = getSupabaseConfig();

export const supabase = createClient<Database>(url, anonKey, {
  auth: {
    storage: getSupabaseAuthStorage(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
