import type { StatusBadgeTone } from '@/components/dashboard/status-badge';
import { buildAbsoluteAppUrl } from '@/lib/app-base-url';
import { formatEventDateTimeLong } from '@/lib/event-datetime-display';

/** In-app platform admin event cockpit path (Expo Router). */
export function buildAdminCockpitEventPath(eventId: string): string {
  return `/admin/events/${encodeURIComponent(eventId.trim())}`;
}

/** Operational buyability from admin RPCs (compute_event_buyability). */
export type AdminBuyabilityStatus =
  | 'selling'
  | 'sales_off'
  | 'sold_out'
  | 'no_tickets'
  | 'draft'
  | 'canceled'
  | 'not_buyable';

export function formatAdminBuyabilityLabel(
  status: string | null | undefined,
  fallbackLabel?: string | null,
): string {
  if (fallbackLabel?.trim()) return fallbackLabel.trim();
  const value = (status ?? '').trim().toLowerCase();
  if (value === 'selling') return 'Selling';
  if (value === 'sales_off') return 'Sales off';
  if (value === 'sold_out') return 'Sold out';
  if (value === 'no_tickets') return 'No tickets';
  if (value === 'draft') return 'Draft';
  if (value === 'canceled' || value === 'cancelled') return 'Canceled';
  if (value === 'not_buyable') return 'Not buyable';
  return 'Not buyable';
}

export function adminBuyabilityTone(status: string | null | undefined): StatusBadgeTone {
  const value = (status ?? '').trim().toLowerCase();
  if (value === 'selling') return 'positive';
  if (value === 'draft') return 'draft';
  if (value === 'canceled' || value === 'cancelled') return 'cancelled';
  if (value === 'sales_off' || value === 'sold_out' || value === 'no_tickets') return 'warn';
  return 'neutral';
}

export function isAdminEventBuyable(status: string | null | undefined, isBuyable?: boolean | null): boolean {
  if (typeof isBuyable === 'boolean') return isBuyable;
  return (status ?? '').trim().toLowerCase() === 'selling';
}

/**
 * Support deep-links for platform admin cockpit (real app routes only).
 * /events/:id is organizer-gated — do not expose as a “public event” support link.
 */
export function buildAdminEventBuyUrl(eventId: string): string {
  return buildAbsoluteAppUrl(`/events/${encodeURIComponent(eventId.trim())}/buy`);
}

/** Organizer/admin scanner route (auth required). */
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

/** Human-readable event date/time for admin surfaces. */
export function formatAdminEventWhen(
  eventDate: string | null | undefined,
  startTime: string | null | undefined,
): string {
  return formatEventDateTimeLong(eventDate, startTime) ?? 'Date TBD';
}

export function formatAdminStatusLabel(status: string | null | undefined): string {
  const value = (status ?? '').trim().toLowerCase();
  if (value === 'published') return 'Published';
  if (value === 'draft') return 'Draft';
  if (value === 'canceled' || value === 'cancelled') return 'Canceled';
  if (!value) return 'Unknown';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function formatAdminSalesLabel(salesEnabled: boolean | null | undefined): string {
  return salesEnabled ? 'Sales on' : 'Sales off';
}

export function formatAdminFeeSourceLabel(source: string | null | undefined): string {
  const value = (source ?? '').trim().toLowerCase();
  if (value === 'global') return 'Global';
  if (value === 'organizer') return 'Organizer';
  if (value === 'event') return 'Event';
  return '—';
}

export function formatAdminPayoutStatusSummary(
  statuses: string[] | null | undefined,
): string {
  if (!Array.isArray(statuses) || statuses.length === 0) return 'None';
  const labels = statuses
    .map((status) => {
      const value = String(status).trim().toLowerCase();
      if (value === 'pending') return 'Pending';
      if (value === 'paid') return 'Paid';
      if (value === 'withheld') return 'Withheld';
      return status;
    })
    .filter(Boolean);
  return labels.length > 0 ? labels.join(', ') : 'None';
}

export function formatAdminDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatAdminOrderStatus(status: string | null | undefined): string {
  const value = (status ?? '').trim().toLowerCase();
  if (value === 'paid') return 'Paid';
  if (value === 'pending') return 'Pending';
  if (value === 'canceled' || value === 'cancelled') return 'Canceled';
  if (value === 'expired') return 'Expired';
  if (!value) return 'Unknown';
  return value.charAt(0).toUpperCase() + value.slice(1);
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
