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

export async function fetchEventStats(
  eventId: string,
): Promise<{ ok: true; stats: EventStats } | { ok: false; error: string }> {
  const { data, error } = await supabase.rpc('get_event_stats', {
    p_event_id: eventId,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  if (!data || typeof data !== 'object') {
    return { ok: false, error: 'Could not load event stats.' };
  }

  const payload = data as EventStatsRpcResponse;

  return {
    ok: true,
    stats: {
      issuedCount: payload.issued_count ?? 0,
      checkedInCount: payload.checked_in_count ?? 0,
      capacity: payload.capacity ?? 0,
      remainingCount: payload.remaining_count ?? 0,
    },
  };
}
