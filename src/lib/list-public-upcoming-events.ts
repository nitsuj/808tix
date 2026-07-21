import { parsePublicUpcomingEvents, type PublicUpcomingEvent } from '@/lib/list-public-upcoming-events.core';
import { supabase } from '@/lib/supabase';

export type { PublicUpcomingEvent };
export { parsePublicUpcomingEvents };

export async function fetchPublicUpcomingEvents(): Promise<{
  events: PublicUpcomingEvent[];
  error: string | null;
}> {
  const { data, error } = await supabase.rpc('list_public_upcoming_events');

  if (error) {
    return { events: [], error: error.message };
  }

  return {
    events: parsePublicUpcomingEvents(data),
    error: null,
  };
}
