/** Strip formatting and normalize to E.164 when possible (US-friendly default). */
export function normalizePhoneNumber(input: string): string {
  const trimmed = input.trim();

  if (!trimmed) {
    return '';
  }

  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');

  if (!digits) {
    return '';
  }

  if (hasPlus) {
    return `+${digits}`;
  }

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  return `+${digits}`;
}

/** Returns an error message or null when valid / blank. */
export function validateGuestPhone(input: string): string | null {
  const trimmed = input.trim();

  if (!trimmed) {
    return null;
  }

  const normalized = normalizePhoneNumber(trimmed);

  if (!/^\+[1-9]\d{9,14}$/.test(normalized)) {
    return 'Enter a valid phone number (10+ digits).';
  }

  return null;
}
