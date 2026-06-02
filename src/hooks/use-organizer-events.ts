import { useCallback, useMemo, useState } from 'react';

import type { Event } from '@/lib/database.types';
import { isOrganizerDashboardEvent } from '@/lib/organizer-dashboard-events';
import { supabase } from '@/lib/supabase';

export function useOrganizerEvents(organizerId: string | undefined) {
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    if (!organizerId) {
      setEvents([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from('events')
      .select('*')
      .eq('organizer_id', organizerId)
      .order('event_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.warn('[organizer-events] Failed to load events:', fetchError.message);
      setError(fetchError.message);
      setEvents([]);
    } else {
      setEvents(data ?? []);
    }

    setIsLoading(false);
  }, [organizerId]);

  const dashboardEvents = useMemo(() => events.filter(isOrganizerDashboardEvent), [events]);

  return {
    events,
    dashboardEvents,
    isLoading,
    error,
    refetch: loadEvents,
  };
}
