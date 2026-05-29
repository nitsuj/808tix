import { supabase } from '@/lib/supabase';

export type SupabaseConnectionTestResult = {
  ok: boolean;
  message: string;
};

const CONNECTION_TEST_TOKEN = '__808tix_connection_test__';

/**
 * Calls the public get_pass_by_token RPC with a bogus token.
 * Success means Supabase is reachable and migrations/RPCs are applied.
 */
export async function testSupabaseConnection(): Promise<SupabaseConnectionTestResult> {
  const { data, error } = await supabase.rpc('get_pass_by_token', {
    p_secure_token: CONNECTION_TEST_TOKEN,
  });

  if (error) {
    return {
      ok: false,
      message: `Supabase RPC error: ${error.message}`,
    };
  }

  if (data !== null) {
    return {
      ok: false,
      message: 'Unexpected pass data returned for connection test token.',
    };
  }

  return {
    ok: true,
    message: 'Connected to Supabase. get_pass_by_token RPC is reachable.',
  };
}
