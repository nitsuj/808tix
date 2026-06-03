/**
 * Resolves which artwork URI to show when an event has no uploaded image yet.
 * Guest pass uses temporary poster URLs; organizer EventArtwork uses gradient fallback.
 */

const PASS_FALLBACK_ARTWORK = [
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1459749434690-5ed0fbc73629?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1429962710451-bb934ee8452c?auto=format&fit=crop&w=1400&q=80',
] as const;

function hashName(name: string): number {
  let hash = 0;

  for (let index = 0; index < name.length; index += 1) {
    hash = (hash << 5) - hash + name.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash);
}

export function getTemporaryPassArtworkFallback(eventName: string): string {
  return PASS_FALLBACK_ARTWORK[hashName(eventName) % PASS_FALLBACK_ARTWORK.length];
}

/** Prefer uploaded event artwork; otherwise temporary guest-pass poster fallback. */
export function resolvePassArtworkUri(
  imageUrl: string | null | undefined,
  eventName: string,
): string {
  const trimmed = imageUrl?.trim();

  if (trimmed) {
    return trimmed;
  }

  return getTemporaryPassArtworkFallback(eventName);
}

/** Returns uploaded artwork URL or null when organizer screens should use gradient fallback. */
export function resolveOrganizerArtworkUrl(imageUrl: string | null | undefined): string | null {
  const trimmed = imageUrl?.trim();
  return trimmed || null;
}

export type EventScreenBackgroundArtwork = {
  uri: string;
  /** True when showing organizer-uploaded artwork (not temporary poster fallback). */
  isUploaded: boolean;
};

/**
 * Shared hero background resolver for Event Detail, Edit Event, and related organizer screens.
 * Pending local picks take precedence; uploaded storage URLs next; otherwise poster fallback.
 */
export function resolveEventScreenBackgroundArtwork(
  imageUrl: string | null | undefined,
  eventName: string,
  pendingLocalUri?: string | null,
): EventScreenBackgroundArtwork {
  const localUri = pendingLocalUri?.trim();

  if (localUri) {
    return { uri: localUri, isUploaded: true };
  }

  const uploaded = resolveOrganizerArtworkUrl(imageUrl);

  if (uploaded) {
    return { uri: uploaded, isUploaded: true };
  }

  return {
    uri: resolvePassArtworkUri(imageUrl, eventName),
    isUploaded: false,
  };
}
