import { useCallback, useEffect, useState } from 'react';

import type { Event } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

export function useEventDetail(eventId: string | undefined) {
  const [event, setEvent] = useState<Event | null>(null);
  const [issuedCount, setIssuedCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!eventId) {
      setEvent(null);
      setIssuedCount(0);
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
      setIssuedCount(0);
      setIsLoading(false);
      return;
    }

    if (!eventData) {
      setError('Event not found.');
      setEvent(null);
      setIssuedCount(0);
      setIsLoading(false);
      return;
    }

    const { count, error: countError } = await supabase
      .from('passes')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .in('status', ['active', 'checked_in']);

    if (countError) {
      setError(countError.message);
      setEvent(null);
      setIssuedCount(0);
      setIsLoading(false);
      return;
    }

    setEvent(eventData);
    setIssuedCount(count ?? 0);
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
    issuedCount,
    isLoading,
    error,
    refetch: load,
  };
}
