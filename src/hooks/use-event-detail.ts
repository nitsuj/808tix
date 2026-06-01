import { useCallback, useEffect, useState } from 'react';

import type { Event } from '@/lib/database.types';
import { fetchEventStats, type EventStats } from '@/lib/event-stats';
import { supabase } from '@/lib/supabase';

const EMPTY_STATS: EventStats = {
  issuedCount: 0,
  checkedInCount: 0,
  capacity: 0,
  remainingCount: 0,
};

export function useEventDetail(eventId: string | undefined) {
  const [event, setEvent] = useState<Event | null>(null);
  const [stats, setStats] = useState<EventStats>(EMPTY_STATS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!eventId) {
      setEvent(null);
      setStats(EMPTY_STATS);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const { data: eventData, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .maybeSingle();

    if (eventError) {
      setError(eventError.message);
      setEvent(null);
      setStats(EMPTY_STATS);
      setIsLoading(false);
      return;
    }

    if (!eventData) {
      setError('Event not found.');
      setEvent(null);
      setStats(EMPTY_STATS);
      setIsLoading(false);
      return;
    }

    const statsOutcome = await fetchEventStats(eventId);

    if (!statsOutcome.ok) {
      setError(statsOutcome.error);
      setEvent(null);
      setStats(EMPTY_STATS);
      setIsLoading(false);
      return;
    }

    setEvent(eventData);
    setStats(statsOutcome.stats);
    setIsLoading(false);
  }, [eventId]);

  useEffect(() => {
    let isMounted = true;

    async function fetchDetail() {
      await load();
    }

    if (isMounted) {
      void fetchDetail();
    }

    return () => {
      isMounted = false;
    };
  }, [load]);

  return {
    event,
    stats,
    issuedCount: stats.issuedCount,
    checkedInCount: stats.checkedInCount,
    remainingCount: stats.remainingCount,
    capacity: stats.capacity,
    isLoading,
    error,
    refetch: load,
  };
}
