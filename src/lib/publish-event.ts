import { supabase } from '@/lib/supabase';

export async function publishEvent(
  eventId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from('events')
    .update({ status: 'published' })
    .eq('id', eventId)
    .select('id, status')
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message };
  }

  if (!data || data.status !== 'published') {
    return { ok: false, error: 'Could not publish this event.' };
  }

  return { ok: true };
}
