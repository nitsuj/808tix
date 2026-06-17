import type { GetOrderByPublicTokenResult } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

export async function getOrderByPublicToken(
  publicAccessToken: string,
): Promise<GetOrderByPublicTokenResult | null> {
  const token = publicAccessToken.trim();

  if (!token) {
    return null;
  }

  const { data, error } = await supabase.rpc('get_order_by_public_token', {
    p_public_access_token: token,
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  return data as GetOrderByPublicTokenResult;
}
