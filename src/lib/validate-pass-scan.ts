import type { CheckInResult, ValidatePassResponse } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

export type ScanValidationDisplay = ValidatePassResponse & {
  pass_type?: string;
};

export async function validatePassScan(
  secureToken: string,
  eventId: string,
): Promise<{ ok: true; data: ScanValidationDisplay } | { ok: false; error: string }> {
  const { data, error } = await supabase.rpc('validate_pass', {
    p_secure_token: secureToken,
    p_event_id: eventId,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  if (!data || typeof data !== 'object' || !('result' in data)) {
    return { ok: false, error: 'Unexpected response from server.' };
  }

  const response = data as ValidatePassResponse;
  const enriched: ScanValidationDisplay = { ...response };

  if (response.pass_id && shouldLoadPassType(response.result)) {
    const { data: passRow } = await supabase
      .from('passes')
      .select('pass_type')
      .eq('id', response.pass_id)
      .maybeSingle();

    if (passRow?.pass_type) {
      enriched.pass_type = passRow.pass_type;
    }
  }

  return { ok: true, data: enriched };
}

function shouldLoadPassType(result: CheckInResult): boolean {
  return result === 'valid' || result === 'already_used' || result === 'voided';
}
