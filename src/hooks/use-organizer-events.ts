import { useCallback, useEffect, useMemo, useState } from 'react';

import type { Event } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

function isUpcomingEvent(event: Event): boolean {
  if (event.status === 'completed' || event.status === 'cancelled') {
    return false;
  }

  if (!event.event_date) {
    return true;
  }

  const today = new Date().toISOString().slice(0, 10);
  return event.event_date >= today;
}

export function useOrganizerEvents(organizerId: string | undefined) {
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    if (!organizerId) {
      setEvents([]);
      setIsLoading(false);
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
      setError(fetchError.message);
      setEvents([]);
    } else {
      setEvents(data ?? []);
    }

    setIsLoading(false);
  }, [organizerId]);

  useEffect(() => {
    let isMounted = true;

    async function fetchEvents() {
      if (!organizerId) {
        if (isMounted) {
          setEvents([]);
          setIsLoading(false);
        }
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

      if (!isMounted) {
        return;
      }

      if (fetchError) {
        setError(fetchError.message);
        setEvents([]);
      } else {
        setEvents(data ?? []);
      }

      setIsLoading(false);
    }

    void fetchEvents();

    return () => {
      isMounted = false;
    };
  }, [organizerId]);

  const upcomingEvents = useMemo(() => events.filter(isUpcomingEvent), [events]);

  return {
    upcomingEvents,
    isLoading,
    error,
    refetch: loadEvents,
  };
}
