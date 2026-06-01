import type { Pass, PassStatus } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

export type EventPassFilter = 'issued' | 'checked_in';

const ISSUED_STATUSES: PassStatus[] = ['active', 'checked_in'];

export function parseEventPassFilter(value: string | string[] | undefined): EventPassFilter {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === 'checked_in' ? 'checked_in' : 'issued';
}

export function getEventPassListTitle(filter: EventPassFilter): string {
  return filter === 'checked_in' ? 'Checked-In Passes' : 'Issued Passes';
}

export async function fetchEventPasses(
  eventId: string,
  filter: EventPassFilter,
): Promise<{ ok: true; passes: Pass[] } | { ok: false; error: string }> {
  let query = supabase
    .from('passes')
    .select(
      'id, event_id, guest_name, guest_email, guest_phone, pass_type, secure_token, status, checked_in_at, checked_in_by, created_at, updated_at',
    )
    .eq('event_id', eventId);

  if (filter === 'checked_in') {
    query = query.eq('status', 'checked_in').order('checked_in_at', { ascending: false });
  } else {
    query = query.in('status', ISSUED_STATUSES).order('created_at', { ascending: false });
  }

  const { data, error } = await query;

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, passes: (data ?? []) as Pass[] };
}
