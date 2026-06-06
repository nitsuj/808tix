/** Strip to digits; US numbers drop a leading country code 1 when present. */
export function extractUsPhoneDigits(input: string): string {
  let digits = input.replace(/\D/g, '');

  if (digits.length > 10 && digits.startsWith('1')) {
    digits = digits.slice(1);
  }

  return digits.slice(0, 10);
}

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

/** Format partial or complete US phone input while typing: (808) 555-1234 */
export function formatPhoneNumberInput(input: string): string {
  const digits = extractUsPhoneDigits(input);

  if (digits.length === 0) {
    return '';
  }

  if (digits.length <= 3) {
    return `(${digits}`;
  }

  if (digits.length <= 6) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  }

  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/** Display stored or raw phone values in US-friendly format when possible. */
export function formatPhoneNumberForDisplay(input: string): string {
  const trimmed = input.trim();

  if (!trimmed) {
    return '';
  }

  const usDigits = extractUsPhoneDigits(trimmed);

  if (usDigits.length === 10) {
    return `(${usDigits.slice(0, 3)}) ${usDigits.slice(3, 6)}-${usDigits.slice(6)}`;
  }

  if (trimmed.startsWith('+')) {
    return trimmed;
  }

  return trimmed;
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
