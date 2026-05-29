import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';
import { getSupabaseAuthStorage } from '@/lib/supabase-auth-storage';

if (Platform.OS !== 'web') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('react-native-url-polyfill/auto');
}

function getSupabaseConfig() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'Missing Supabase env vars. Copy .env.example to .env and set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.',
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
