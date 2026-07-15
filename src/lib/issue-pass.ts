import type { Pass } from '@/lib/database.types';
import { getIssuePassBlockedMessage } from '@/lib/event-status';
import { supabase } from '@/lib/supabase';

export type IssuePassInput = {
  eventId: string;
  guestName: string;
  passType: string;
  guestEmail?: string;
  guestPhone?: string;
  issuedCount: number;
  capacity: number;
};

export type IssuePassResult =
  | { ok: true; pass: Pass }
  | { ok: false; error: string; fieldError?: 'capacity' };

function mapInsertError(message: string): IssuePassResult {
  if (message.includes('at capacity') || message.includes('Capacity')) {
    return {
      ok: false,
      error: 'This event is at capacity. Increase max tickets or void a ticket before issuing more.',
      fieldError: 'capacity',
    };
  }

  return { ok: false, error: message };
}

export async function issuePass(input: IssuePassInput): Promise<IssuePassResult> {
  if (input.issuedCount >= input.capacity) {
    return {
      ok: false,
      error: `This event is at capacity (${input.issuedCount} of ${input.capacity} issued).`,
      fieldError: 'capacity',
    };
  }

  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('id, capacity, status')
    .eq('id', input.eventId)
    .maybeSingle();

  if (eventError) {
    return { ok: false, error: eventError.message };
  }

  if (!event) {
    return { ok: false, error: 'Event not found or you do not have access.' };
  }

  const issueBlockedMessage = getIssuePassBlockedMessage(event.status);

  if (issueBlockedMessage) {
    return { ok: false, error: issueBlockedMessage };
  }

  if (input.issuedCount >= event.capacity) {
    return {
      ok: false,
      error: `This event is at capacity (${input.issuedCount} of ${event.capacity} issued).`,
      fieldError: 'capacity',
    };
  }

  const guestEmail = input.guestEmail?.trim() || null;
  const guestPhone = input.guestPhone?.trim() || null;

  const { data: pass, error: insertError } = await supabase
    .from('passes')
    .insert({
      event_id: input.eventId,
      guest_name: input.guestName.trim(),
      pass_type: input.passType.trim(),
      guest_email: guestEmail,
      guest_phone: guestPhone,
      secure_token: '',
    })
    .select('*')
    .single();

  if (insertError) {
    return mapInsertError(insertError.message);
  }

  if (!pass) {
    return { ok: false, error: 'Pass was not created.' };
  }

  return { ok: true, pass };
}
