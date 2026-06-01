export function formatPassTimestamp(iso: string | null | undefined): string | null {
  if (!iso) {
    return null;
  }

  const parsed = new Date(iso);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
