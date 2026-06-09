import {
  measureLocalFileSize,
  validateEventArtworkFile,
} from '@/lib/event-artwork-validation';
import { supabase } from '@/lib/supabase';

export const EVENT_ARTWORK_BUCKET = 'event-artwork';

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const ARTWORK_EXTENSIONS = ['jpg', 'png', 'webp'] as const;

export function extensionForMimeType(mimeType: string): string {
  const normalized = mimeType.toLowerCase().split(';')[0]?.trim() ?? 'image/jpeg';
  return MIME_TO_EXT[normalized] ?? 'jpg';
}

export function getEventArtworkStoragePath(eventId: string, mimeType: string): string {
  const ext = extensionForMimeType(mimeType);
  return `${eventId}/artwork.${ext}`;
}

export function getEventArtworkPublicUrl(storagePath: string, version: number = Date.now()): string {
  const { data } = supabase.storage.from(EVENT_ARTWORK_BUCKET).getPublicUrl(storagePath);
  const separator = data.publicUrl.includes('?') ? '&' : '?';
  return `${data.publicUrl}${separator}v=${version}`;
}

const STORAGE_PUBLIC_SEGMENT = `/storage/v1/object/public/${EVENT_ARTWORK_BUCKET}/`;
const EPHEMERAL_ARTWORK_PREFIXES = ['blob:', 'data:'] as const;

/** Extract bucket object path from a public URL or raw storage path. */
export function extractEventArtworkStoragePath(storedUrl: string): string | null {
  const trimmed = storedUrl.trim();

  if (!trimmed) {
    return null;
  }

  if (!/^https?:\/\//i.test(trimmed)) {
    const pathOnly = trimmed.split('?')[0]?.trim();

    if (pathOnly && pathOnly.includes('/') && !pathOnly.startsWith('/')) {
      return pathOnly;
    }

    return null;
  }

  try {
    const pathname = new URL(trimmed).pathname;
    const segmentIndex = pathname.indexOf(STORAGE_PUBLIC_SEGMENT);

    if (segmentIndex === -1) {
      return null;
    }

    const storagePath = pathname.slice(segmentIndex + STORAGE_PUBLIC_SEGMENT.length);
    return storagePath ? decodeURIComponent(storagePath) : null;
  } catch {
    return null;
  }
}

/**
 * Normalize persisted event artwork for rendering.
 * Rebuilds Supabase storage public URLs against the current project origin.
 */
export function resolveEventArtworkPublicUrl(storedUrl: string | null | undefined): string | null {
  const trimmed = storedUrl?.trim();

  if (!trimmed) {
    return null;
  }

  const lowered = trimmed.toLowerCase();

  if (EPHEMERAL_ARTWORK_PREFIXES.some((prefix) => lowered.startsWith(prefix))) {
    return null;
  }

  const storagePath = extractEventArtworkStoragePath(trimmed);

  if (storagePath) {
    const versionMatch = trimmed.match(/[?&]v=(\d+)/);
    const version = versionMatch?.[1] ? Number(versionMatch[1]) : Date.now();
    return getEventArtworkPublicUrl(storagePath, version);
  }

  return trimmed;
}

function getReplaceableArtworkPaths(eventId: string): string[] {
  return ARTWORK_EXTENSIONS.map((ext) => `${eventId}/artwork.${ext}`);
}

async function removeExistingEventArtwork(eventId: string): Promise<void> {
  const paths = new Set(getReplaceableArtworkPaths(eventId));

  const { data: listing, error: listError } = await supabase.storage
    .from(EVENT_ARTWORK_BUCKET)
    .list(eventId, { limit: 100 });

  if (listError) {
    throw new Error(`Could not list existing artwork: ${listError.message}`);
  }

  for (const file of listing ?? []) {
    if (file.name) {
      paths.add(`${eventId}/${file.name}`);
    }
  }

  if (paths.size === 0) {
    return;
  }

  const { error: removeError } = await supabase.storage
    .from(EVENT_ARTWORK_BUCKET)
    .remove([...paths]);

  if (removeError) {
    throw new Error(`Could not remove existing artwork: ${removeError.message}`);
  }
}

export async function uploadEventArtwork(
  eventId: string,
  localUri: string,
  mimeType: string,
  fileSizeBytes?: number | null,
): Promise<string> {
  const measuredSize = fileSizeBytes ?? (await measureLocalFileSize(localUri));
  const validationError = validateEventArtworkFile(mimeType, measuredSize);

  if (validationError) {
    throw new Error(validationError);
  }

  const storagePath = getEventArtworkStoragePath(eventId, mimeType);
  const response = await fetch(localUri);

  if (!response.ok) {
    throw new Error('Could not read the selected image.');
  }

  const fileBody = await response.arrayBuffer();
  const contentType = mimeType.toLowerCase().split(';')[0]?.trim() || 'image/jpeg';
  const sizeError = validateEventArtworkFile(mimeType, fileBody.byteLength);

  if (sizeError) {
    throw new Error(sizeError);
  }

  await removeExistingEventArtwork(eventId);

  const version = Date.now();

  const { error } = await supabase.storage.from(EVENT_ARTWORK_BUCKET).upload(storagePath, fileBody, {
    upsert: true,
    contentType,
    cacheControl: '60',
  });

  if (error) {
    throw new Error(error.message);
  }

  return getEventArtworkPublicUrl(storagePath, version);
}

export async function persistEventArtworkUrl(eventId: string, imageUrl: string): Promise<void> {
  const { error } = await supabase.from('events').update({ image_url: imageUrl }).eq('id', eventId);

  if (error) {
    throw new Error(error.message);
  }
}
