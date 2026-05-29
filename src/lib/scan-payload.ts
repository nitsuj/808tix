/**
 * Guest pass QR encodes secure_token only (hex).
 * Also accepts a full /pass/{token} URL if scanned from a link QR by mistake.
 */
export function parseScannedSecureToken(raw: string): string | null {
  const trimmed = raw.trim();

  if (!trimmed) {
    return null;
  }

  const pathMatch = /\/pass\/([a-f0-9]+)/i.exec(trimmed);

  if (pathMatch?.[1]) {
    return pathMatch[1];
  }

  if (/^[a-f0-9]+$/i.test(trimmed)) {
    return trimmed;
  }

  return null;
}
