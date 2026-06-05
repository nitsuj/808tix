import {
  measureLocalFileSize,
  validateEventArtworkFile,
} from '@/lib/event-artwork-validation';
import { supabase } from '@/lib/supabase';

export const ORGANIZER_LOGO_BUCKET = 'organizer-logos';

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const LOGO_EXTENSIONS = ['jpg', 'png', 'webp'] as const;

export function extensionForLogoMimeType(mimeType: string): string {
  const normalized = mimeType.toLowerCase().split(';')[0]?.trim() ?? 'image/jpeg';
  return MIME_TO_EXT[normalized] ?? 'jpg';
}

export function getOrganizerLogoStoragePath(organizerId: string, mimeType: string): string {
  const ext = extensionForLogoMimeType(mimeType);
  return `${organizerId}/logo.${ext}`;
}

export function getOrganizerLogoPublicUrl(storagePath: string, version: number = Date.now()): string {
  const { data } = supabase.storage.from(ORGANIZER_LOGO_BUCKET).getPublicUrl(storagePath);
  const separator = data.publicUrl.includes('?') ? '&' : '?';
  return `${data.publicUrl}${separator}v=${version}`;
}

function getReplaceableLogoPaths(organizerId: string): string[] {
  return LOGO_EXTENSIONS.map((ext) => `${organizerId}/logo.${ext}`);
}

async function removeExistingOrganizerLogo(organizerId: string): Promise<void> {
  const paths = new Set(getReplaceableLogoPaths(organizerId));

  const { data: listing, error: listError } = await supabase.storage
    .from(ORGANIZER_LOGO_BUCKET)
    .list(organizerId, { limit: 100 });

  if (listError) {
    throw new Error(`Could not list existing logo: ${listError.message}`);
  }

  for (const file of listing ?? []) {
    if (file.name) {
      paths.add(`${organizerId}/${file.name}`);
    }
  }

  if (paths.size === 0) {
    return;
  }

  const { error: removeError } = await supabase.storage
    .from(ORGANIZER_LOGO_BUCKET)
    .remove([...paths]);

  if (removeError) {
    throw new Error(`Could not remove existing logo: ${removeError.message}`);
  }
}

export async function uploadOrganizerLogo(
  organizerId: string,
  localUri: string,
  mimeType: string,
  fileSizeBytes?: number | null,
): Promise<string> {
  const measuredSize = fileSizeBytes ?? (await measureLocalFileSize(localUri));
  const validationError = validateEventArtworkFile(mimeType, measuredSize);

  if (validationError) {
    throw new Error(validationError);
  }

  const storagePath = getOrganizerLogoStoragePath(organizerId, mimeType);
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

  await removeExistingOrganizerLogo(organizerId);

  const version = Date.now();

  const { error } = await supabase.storage.from(ORGANIZER_LOGO_BUCKET).upload(storagePath, fileBody, {
    upsert: true,
    contentType,
    cacheControl: '60',
  });

  if (error) {
    throw new Error(error.message);
  }

  return getOrganizerLogoPublicUrl(storagePath, version);
}
