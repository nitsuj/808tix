import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import type { Event } from '@/lib/database.types';
import { fetchEventStats, type EventStats } from '@/lib/event-stats';
import { supabase } from '@/lib/supabase';

const EMPTY_STATS: EventStats = {
  issuedCount: 0,
  checkedInCount: 0,
  capacity: 0,
  remainingCount: 0,
};

type LoadOptions = {
  /** Keep showing current event/stats while refreshing (focus return from Issue Pass). */
  silent?: boolean;
};

export function useEventDetail(eventId: string | undefined) {
  const [event, setEvent] = useState<Event | null>(null);
  const [stats, setStats] = useState<EventStats>(EMPTY_STATS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  const load = useCallback(
    async (options?: LoadOptions) => {
      if (!eventId) {
        setEvent(null);
        setStats(EMPTY_STATS);
        setIsLoading(false);
        setStatsError(null);
        hasLoadedRef.current = false;
        return;
      }

      if (!options?.silent) {
        setIsLoading(true);
      }

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
        setStatsError(null);
        setIsLoading(false);
        hasLoadedRef.current = false;
        return;
      }

      if (!eventData) {
        setError('Event not found.');
        setEvent(null);
        setStats(EMPTY_STATS);
        setStatsError(null);
        setIsLoading(false);
        hasLoadedRef.current = false;
        return;
      }

      const statsOutcome = await fetchEventStats(eventId, eventData.capacity);

      if (!statsOutcome.ok) {
        setEvent(eventData);
        setStats(EMPTY_STATS);
        setStatsError(statsOutcome.error);
        setIsLoading(false);
        hasLoadedRef.current = true;
        return;
      }

      setEvent(eventData);
      setStats(statsOutcome.stats);
      setStatsError(null);
      setIsLoading(false);
      hasLoadedRef.current = true;
    },
    [eventId],
  );

  useFocusEffect(
    useCallback(() => {
      if (!eventId) {
        return;
      }

      void load({ silent: hasLoadedRef.current });
    }, [eventId, load]),
  );

  return {
    event,
    stats,
    issuedCount: stats.issuedCount,
    checkedInCount: stats.checkedInCount,
    remainingCount: stats.remainingCount,
    capacity: stats.capacity,
    isLoading,
    error,
    statsError,
    refetch: () => load({ silent: true }),
  };
}
