import type { CheckInResult } from '@/lib/database.types';

export const ScannerResultColors = {
  valid: { background: '#39FF14', text: '#000000' },
  already_used: { background: '#FFB020', text: '#000000' },
  invalid: { background: '#FF3B3B', text: '#FFFFFF' },
  wrong_event: { background: '#FF3B3B', text: '#FFFFFF' },
  voided: { background: '#2E3135', text: '#B0B4BA' },
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
