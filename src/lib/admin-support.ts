import { buildAbsoluteAppUrl } from '@/lib/app-base-url';

/** In-app platform admin event cockpit path (Expo Router). */
export function buildAdminCockpitEventPath(eventId: string): string {
  return `/admin/events/${encodeURIComponent(eventId.trim())}`;
}

/** Support deep-links for platform admin cockpit (real app routes only). */
export function buildAdminEventDetailUrl(eventId: string): string {
  return buildAbsoluteAppUrl(`/events/${encodeURIComponent(eventId.trim())}`);
}

export function buildAdminEventBuyUrl(eventId: string): string {
  return buildAbsoluteAppUrl(`/events/${encodeURIComponent(eventId.trim())}/buy`);
}

export function buildAdminEventScanUrl(eventId: string): string {
  return buildAbsoluteAppUrl(`/events/${encodeURIComponent(eventId.trim())}/scan`);
}

export function buildAdminPassUrl(secureToken: string): string {
  return buildAbsoluteAppUrl(`/pass/${encodeURIComponent(secureToken.trim())}`);
}

export function buildAdminOrderSuccessUrl(orderToken: string): string {
  const params = new URLSearchParams({ order_token: orderToken.trim() });
  return buildAbsoluteAppUrl(`/purchase/success?${params.toString()}`);
}

export function formatAdminCents(cents: number | null | undefined, currency = 'usd'): string {
  const amount = (Number(cents) || 0) / 100;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

export function downloadCsv(filename: string, rows: string[][]): void {
  const escape = (cell: string) => {
    const value = cell ?? '';
    if (/[",\n]/.test(value)) {
      return `"${value.replaceAll('"', '""')}"`;
    }
    return value;
  };
  const body = rows.map((row) => row.map(escape).join(',')).join('\n');
  const blob = new Blob([body], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
