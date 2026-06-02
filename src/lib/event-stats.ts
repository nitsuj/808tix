import { supabase } from '@/lib/supabase';

export type EventStats = {
  issuedCount: number;
  checkedInCount: number;
  capacity: number;
  remainingCount: number;
};

type EventStatsRpcResponse = {
  issued_count?: number;
  checked_in_count?: number;
  capacity?: number;
  remaining_count?: number;
};

const ISSUED_PASS_STATUSES = ['active', 'checked_in'] as const;

export function formatScannerCheckInFooter(stats: EventStats): string {
  if (stats.issuedCount === 0) {
    return '0 Checked In';
  }

  return `${stats.checkedInCount} / ${stats.issuedCount} Checked In`;
}

export function formatCheckInRatePercent(stats: EventStats): number {
  if (stats.issuedCount === 0) {
    return 0;
  }

  return Math.round((stats.checkedInCount / stats.issuedCount) * 100);
}

function buildStatsFromCounts(
  issuedCount: number,
  checkedInCount: number,
  capacity: number,
): EventStats {
  return {
    issuedCount,
    checkedInCount,
    capacity,
    remainingCount: Math.max(capacity - issuedCount, 0),
  };
}

/** Count active + checked_in passes via RLS (fallback when RPC unavailable). */
export async function fetchEventStatsFromPasses(
  eventId: string,
  capacity: number,
): Promise<{ ok: true; stats: EventStats } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from('passes')
    .select('status')
    .eq('event_id', eventId)
    .in('status', [...ISSUED_PASS_STATUSES]);

  if (error) {
    return { ok: false, error: error.message };
  }

  let issuedCount = 0;
  let checkedInCount = 0;

  for (const row of data ?? []) {
    issuedCount += 1;

    if (row.status === 'checked_in') {
      checkedInCount += 1;
    }
  }

  return {
    ok: true,
    stats: buildStatsFromCounts(issuedCount, checkedInCount, capacity),
  };
}

export async function fetchEventStats(
  eventId: string,
  eventCapacity?: number,
): Promise<{ ok: true; stats: EventStats } | { ok: false; error: string }> {
  const { data, error } = await supabase.rpc('get_event_stats', {
    p_event_id: eventId,
  });

  if (!error && data && typeof data === 'object') {
    const payload = data as EventStatsRpcResponse;

    return {
      ok: true,
      stats: {
        issuedCount: payload.issued_count ?? 0,
        checkedInCount: payload.checked_in_count ?? 0,
        capacity: payload.capacity ?? eventCapacity ?? 0,
        remainingCount: payload.remaining_count ?? 0,
      },
    };
  }

  const rpcMessage = error?.message ?? 'Could not load event stats.';

  if (eventCapacity != null) {
    const fallback = await fetchEventStatsFromPasses(eventId, eventCapacity);

    if (fallback.ok) {
      console.warn('[event-stats] get_event_stats failed; using passes query fallback:', rpcMessage);
      return fallback;
    }
  }

  return { ok: false, error: rpcMessage };
}
