export const EVENT_ARTWORK_MAX_BYTES = 5 * 1024 * 1024;

export const EVENT_ARTWORK_ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

export const EVENT_ARTWORK_REQUIREMENTS_LABEL =
  'JPEG, PNG, or WebP · 5 MB max · one poster image per event';

export function normalizeArtworkMimeType(mimeType: string): string {
  return mimeType.toLowerCase().split(';')[0]?.trim() ?? '';
}

export function formatArtworkFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function validateEventArtworkFile(
  mimeType: string,
  fileSizeBytes: number | null | undefined,
): string | null {
  const normalizedMime = normalizeArtworkMimeType(mimeType);

  if (!EVENT_ARTWORK_ALLOWED_MIME_TYPES.has(normalizedMime)) {
    return 'Choose a JPEG, PNG, or WebP image.';
  }

  if (fileSizeBytes == null) {
    return 'Could not read the file size. Try another image.';
  }

  if (fileSizeBytes <= 0) {
    return 'The selected file is empty. Choose another image.';
  }

  if (fileSizeBytes > EVENT_ARTWORK_MAX_BYTES) {
    return `Image must be 5 MB or smaller (selected file is ${formatArtworkFileSize(fileSizeBytes)}).`;
  }

  return null;
}

export async function measureLocalFileSize(localUri: string): Promise<number | null> {
  try {
    const response = await fetch(localUri);

    if (!response.ok) {
      return null;
    }

    const buffer = await response.arrayBuffer();
    return buffer.byteLength;
  } catch {
    return null;
  }
}
