import { supabase } from '@/lib/supabase';

export { isStaleRefreshTokenError } from '@/lib/auth-stale-token';

/** Drop persisted auth tokens without requiring a valid server refresh token. */
export async function clearStaleLocalAuthSession(): Promise<void> {
  await supabase.auth.signOut({ scope: 'local' });
}
