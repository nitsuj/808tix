import type { CheckInResult } from '@/lib/database.types';
import { scanner } from '@/theme/colors';
import type { ScanValidationDisplay } from '@/lib/validate-pass-scan';

export type ScannerDisplayState = 'confirmed' | 'already_checked_in' | 'unconfirmed';

/** Scanner result screen colors — sourced from theme. */
export const ScannerResultColors = {
  valid: scanner.valid,
  already_used: scanner.alreadyUsed,
  invalid: scanner.invalid,
  wrong_event: scanner.wrongEvent,
  voided: scanner.voided,
} as const;

export function getScannerDisplayState(result: ScanValidationDisplay): ScannerDisplayState {
  if (result.result === 'valid') {
    return 'confirmed';
  }

  if (result.result === 'already_used') {
    return 'already_checked_in';
  }

  return 'unconfirmed';
}

export function getScannerResultTitle(result: ScanValidationDisplay): string {
  const state = getScannerDisplayState(result);

  if (state === 'confirmed') {
    return 'CONFIRMED';
  }

  if (state === 'already_checked_in') {
    return 'ALREADY CHECKED IN';
  }

  return 'UNCONFIRMED';
}

export function getScannerResultSubtitle(result: ScanValidationDisplay): string | null {
  const state = getScannerDisplayState(result);

  if (state === 'confirmed') {
    return 'Checked in — admit guest';
  }

  if (state === 'already_checked_in') {
    if (result.checked_in_at) {
      return 'Previously checked in — do not admit again';
    }

    return 'This pass was already scanned — investigate';
  }

  if (result.clientReason === 'not_808tix_pass') {
    return 'Not an 808Tix pass';
  }

  if (result.clientReason === 'event_not_live') {
    return 'Event not live — publish before scanning';
  }

  switch (result.result as CheckInResult) {
    case 'wrong_event':
      return 'Wrong event';
    case 'voided':
      return 'Voided pass';
    case 'invalid':
      return 'Invalid pass';
    default:
      return 'Do not admit';
  }
}

export function getScannerResultColors(result: ScanValidationDisplay) {
  const state = getScannerDisplayState(result);

  if (state === 'confirmed') {
    return ScannerResultColors.valid;
  }

  if (state === 'already_checked_in') {
    return ScannerResultColors.already_used;
  }

  return ScannerResultColors.invalid;
}
