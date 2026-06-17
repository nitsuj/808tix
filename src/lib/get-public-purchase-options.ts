import {
  parsePublicEventPurchaseOptions,
  type PurchaseUnavailableReason,
  findPurchaseTicketType,
  logPurchaseOptionsDiagnostics,
  normalizeRouteParam,
  purchaseIdsEqual,
} from '@/lib/get-public-purchase-options.core';
import { supabase } from '@/lib/supabase';

export type { PurchaseUnavailableReason };

export {
  findPurchaseTicketType,
  logPurchaseOptionsDiagnostics,
  normalizeRouteParam,
  parsePublicEventPurchaseOptions,
  purchaseIdsEqual,
};

export async function fetchPublicEventPurchaseOptions(eventId: string): Promise<{
  options: ReturnType<typeof parsePublicEventPurchaseOptions>;
  error: string | null;
}> {
  const { data, error } = await supabase.rpc('get_public_event_purchase_options', {
    p_event_id: eventId,
  });

  if (error) {
    return { options: null, error: error.message };
  }

  return {
    options: parsePublicEventPurchaseOptions(data),
    error: null,
  };
}
