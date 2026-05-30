import type { CheckInResult } from '@/lib/database.types';
import { scanner } from '@/theme/colors';

/** Scanner result screen colors — sourced from theme; do not hardcode here. */
export const ScannerResultColors = {
  valid: scanner.valid,
  already_used: scanner.alreadyUsed,
  invalid: scanner.invalid,
  wrong_event: scanner.wrongEvent,
  voided: scanner.voided,
} as const;

export function getScannerResultTitle(result: CheckInResult): string {
  switch (result) {
    case 'valid':
      return 'VALID';
    case 'already_used':
      return 'ALREADY USED';
    case 'invalid':
      return 'INVALID';
    case 'wrong_event':
      return 'WRONG EVENT';
    case 'voided':
      return 'VOIDED';
    default:
      return 'INVALID';
  }
}

export function getScannerResultSubtitle(result: CheckInResult): string | null {
  switch (result) {
    case 'valid':
      return 'Checked in successfully';
    case 'already_used':
      return 'This pass was already scanned';
    case 'invalid':
      return 'Pass not recognized';
    case 'wrong_event':
      return 'Pass is for a different event';
    case 'voided':
      return 'This pass is no longer valid';
    default:
      return null;
  }
}
