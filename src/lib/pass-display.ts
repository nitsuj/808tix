import type { PassStatus } from '@/lib/database.types';

export function formatPassStatusLabel(status: PassStatus): string {
  switch (status) {
    case 'active':
      return 'Active';
    case 'checked_in':
      return 'Checked in';
    case 'voided':
      return 'Voided';
    default:
      return status;
  }
}

/** Guest-facing banner when pass cannot be used for first entry. */
export function getPassStatusBanner(status: PassStatus): string | null {
  switch (status) {
    case 'checked_in':
      return 'This pass has already been checked in.';
    case 'voided':
      return 'This pass is no longer valid.';
    default:
      return null;
  }
}
