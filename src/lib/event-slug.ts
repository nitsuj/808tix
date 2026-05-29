import { supabase } from '@/lib/supabase';

/** Matches DB check: ^[a-z0-9]+(?:-[a-z0-9]+)*$ */
export function slugifyEventName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return slug || 'event';
}

export async function generateUniqueEventSlug(eventName: string): Promise<string> {
  const baseSlug = slugifyEventName(eventName);
  let candidate = baseSlug;
  let suffix = 2;

  while (true) {
    const { data, error } = await supabase
      .from('events')
      .select('id')
      .eq('slug', candidate)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return candidate;
    }

    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}
