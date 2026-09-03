import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { AdminGate } from '@/components/admin/admin-gate';
import { asAdminArray } from '@/components/admin/admin-ui';
import {
  EventAdminDashboardView,
  type EventAdminDetailView,
  type EventAdminFeeSavePayload,
  type EventAdminFeeSliceView,
  type EventAdminOrderView,
  type EventAdminPayoutActionPayload,
  type EventAdminPayoutView,
} from '@/components/dashboard/event-admin-dashboard-view';
import { GhostButton } from '@/components/dashboard/ghost-button';
import { dashboardStyles as styles } from '@/components/dashboard/dashboard-styles';
import { dash } from '@/components/dashboard/dashboard-tokens';
import type { StatusBadgeTone } from '@/components/dashboard/status-badge';
import {
  adminBuyabilityTone,
  buildAdminEventBuyUrl,
  buildAdminEventScanUrl,
  buildAdminPassUrl,
  formatAdminBuyabilityLabel,
  formatAdminCents,
  formatAdminDateTime,
  formatAdminEventWhen,
  formatAdminFeeSourceLabel,
  formatAdminOrderStatus,
  formatAdminPayoutStatusSummary,
  formatAdminSalesLabel,
  formatAdminStatusLabel,
  isAdminEventBuyable,
} from '@/lib/admin-support';
import { supabase } from '@/lib/supabase';

type EventDetail = {
  event_id: string;
  event_name: string;
  status: string;
  sales_enabled: boolean;
  ticketing_mode: string;
  event_date: string | null;
  start_time: string | null;
  venue_name: string | null;
  organizer_email: string | null;
  organizer_name: string | null;
  fee_config_source: string | null;
  paid_order_count: number;
  paid_ticket_count: number;
  checked_in_count: number;
  ticket_subtotal_cents: number;
  platform_fee_cents: number;
  processing_fee_cents: number;
  organizer_net_cents: number;
  payout_statuses: string[] | null;
  buyability_status?: string | null;
  buyability_label?: string | null;
  is_buyable?: boolean | null;
  active_ticket_type_count?: number | null;
  ticket_quantity_available?: number | null;
};

type FeeSlice = {
  platform_fee_bps: number;
  platform_fee_fixed_cents: number;
  processing_fee_bps: number;
  processing_fee_fixed_cents: number;
};

type EventMonetization = {
  use_custom_fees: boolean;
  event_override: FeeSlice | null;
  event_stored_fees: FeeSlice;
  organizer_override: FeeSlice | null;
  global: FeeSlice & { updated_at: string | null };
  effective: FeeSlice & { source: string };
  notes: string;
};

type AdminOrderTicket = {
  secure_token: string;
  sequence: number | null;
  status: string;
};

type AdminOrderRow = {
  order_id: string;
  public_access_token: string;
  status: string;
  buyer_email: string;
  buyer_name: string | null;
  subtotal_cents: number;
  platform_fee_cents: number;
  processing_fee_cents: number | null;
  organizer_net_cents: number;
  fee_config_source: string | null;
  currency: string;
  paid_at: string | null;
  ticket_count: number;
  tickets: AdminOrderTicket[] | null;
};

type AdminPayoutRow = {
  payout_id: string;
  status: string;
  amount_cents: number;
  currency: string;
  paid_at: string | null;
  notes: string | null;
  organizer_net_cents: number | null;
};

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

function asFeeSlice(value: FeeSlice | null | undefined, fallback?: FeeSlice): EventAdminFeeSliceView {
  const source = value ?? fallback;
  return {
    platform_fee_bps: Number(source?.platform_fee_bps ?? 0),
    platform_fee_fixed_cents: Number(source?.platform_fee_fixed_cents ?? 0),
    processing_fee_bps: Number(source?.processing_fee_bps ?? 0),
    processing_fee_fixed_cents: Number(source?.processing_fee_fixed_cents ?? 0),
  };
}

function statusTone(status: string | null | undefined): StatusBadgeTone {
  const value = (status ?? '').trim().toLowerCase();
  if (value === 'published' || value === 'paid' || value === 'checked_in' || value === 'valid') {
    return 'positive';
  }
  if (value === 'draft') return 'draft';
  if (value === 'canceled' || value === 'cancelled' || value === 'void' || value === 'revoked') {
    return 'cancelled';
  }
  if (value === 'pending' || value === 'withheld' || value === 'expired') return 'warn';
  return 'neutral';
}

function payoutTone(statuses: string[] | null | undefined): StatusBadgeTone {
  const values = (statuses ?? []).map((status) => String(status).trim().toLowerCase());
  if (values.includes('withheld')) return 'warn';
  if (values.includes('pending')) return 'warn';
  if (values.length > 0 && values.every((status) => status === 'paid')) return 'positive';
  return 'neutral';
}

function formatPassStatus(status: string | null | undefined): string {
  const value = (status ?? '').trim().toLowerCase();
  if (value === 'checked_in') return 'Checked in';
  if (value === 'issued') return 'Issued';
  if (value === 'void') return 'Void';
  if (value === 'revoked') return 'Revoked';
  if (!value) return 'Unknown';
  return value.charAt(0).toUpperCase() + value.slice(1).replaceAll('_', ' ');
}

function formatTicketingMode(mode: string | null | undefined): string {
  const value = (mode ?? '').trim();
  if (!value) return '—';
  return value
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function toDetailView(detail: EventDetail, pendingPayoutCents: number): EventAdminDetailView {
  const salesOn = Boolean(detail.sales_enabled);
  const buyabilityStatus = detail.buyability_status ?? null;
  const isBuyable = isAdminEventBuyable(buyabilityStatus, detail.is_buyable);
  const qtyRaw = detail.ticket_quantity_available;
  const ticketQuantityAvailable =
    qtyRaw === null || qtyRaw === undefined ? null : Number(qtyRaw);

  return {
    eventId: detail.event_id,
    eventName: detail.event_name,
    organizerName: detail.organizer_name?.trim() || 'Organizer',
    organizerEmail: detail.organizer_email?.trim() || '',
    venueName: detail.venue_name?.trim() || 'Venue TBD',
    venueAddress: '',
    whenLabel: formatAdminEventWhen(detail.event_date, detail.start_time),
    statusLabel: formatAdminStatusLabel(detail.status),
    statusTone: statusTone(detail.status),
    salesLabel: formatAdminSalesLabel(salesOn),
    salesTone: salesOn ? 'positive' : 'warn',
    buyabilityLabel: formatAdminBuyabilityLabel(buyabilityStatus, detail.buyability_label),
    buyabilityTone: adminBuyabilityTone(buyabilityStatus),
    buyabilityStatus: (buyabilityStatus ?? 'not_buyable').trim().toLowerCase() || 'not_buyable',
    isBuyable,
    activeTicketTypeCount: Number(detail.active_ticket_type_count ?? 0),
    ticketQuantityAvailable,
    feeSourceLabel: formatAdminFeeSourceLabel(detail.fee_config_source),
    payoutLabel: formatAdminPayoutStatusSummary(detail.payout_statuses),
    payoutTone: payoutTone(detail.payout_statuses),
    ticketingModeLabel: formatTicketingMode(detail.ticketing_mode),
    grossTicketSalesLabel: formatAdminCents(detail.ticket_subtotal_cents),
    ticketsSold: Number(detail.paid_ticket_count ?? 0),
    orders: Number(detail.paid_order_count ?? 0),
    checkedIn: Number(detail.checked_in_count ?? 0),
    platformFeeLabel: formatAdminCents(detail.platform_fee_cents),
    processingFeeLabel: formatAdminCents(detail.processing_fee_cents),
    organizerNetLabel: formatAdminCents(detail.organizer_net_cents),
    pendingPayoutLabel: formatAdminCents(pendingPayoutCents),
  };
}

function toOrderViews(orders: AdminOrderRow[]): EventAdminOrderView[] {
  return orders.map((order) => {
    const tickets = (order.tickets ?? []).map((ticket) => ({
      secureToken: ticket.secure_token,
      sequence: ticket.sequence ?? 0,
      statusLabel: formatPassStatus(ticket.status),
      statusTone: statusTone(ticket.status),
      ticketTypeLabel: 'Ticket',
    }));
    return {
      orderId: order.order_id,
      buyerName: order.buyer_name?.trim() || 'Buyer',
      buyerEmail: order.buyer_email,
      statusLabel: formatAdminOrderStatus(order.status),
      statusTone: statusTone(order.status),
      paidAtLabel: order.paid_at ? `Paid ${formatAdminDateTime(order.paid_at)}` : 'Not paid',
      ticketCount: Number(order.ticket_count ?? tickets.length),
      ticketTypeSummary: tickets.length > 0 ? 'Ticket' : '—',
      ticketSubtotalLabel: formatAdminCents(order.subtotal_cents, order.currency),
      platformFeeLabel: formatAdminCents(order.platform_fee_cents, order.currency),
      processingFeeLabel: formatAdminCents(order.processing_fee_cents, order.currency),
      organizerNetLabel: formatAdminCents(order.organizer_net_cents, order.currency),
      tickets,
    };
  });
}

function toPayoutViews(payouts: AdminPayoutRow[]): EventAdminPayoutView[] {
  return payouts.map((payout) => {
    const statusValue = String(payout.status ?? '').trim().toLowerCase();
    return {
      payoutId: payout.payout_id,
      amountLabel: formatAdminCents(
        payout.organizer_net_cents ?? payout.amount_cents,
        payout.currency,
      ),
      statusLabel: formatAdminOrderStatus(payout.status),
      statusTone: statusTone(payout.status),
      statusValue,
      paidAtLabel: payout.paid_at ? formatAdminDateTime(payout.paid_at) : null,
      notes: payout.notes ?? '',
    };
  });
}

function EventAdminCockpit({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [orders, setOrders] = useState<AdminOrderRow[]>([]);
  const [payouts, setPayouts] = useState<AdminPayoutRow[]>([]);
  const [monetization, setMonetization] = useState<EventMonetization | null>(null);
  const [savingFees, setSavingFees] = useState(false);
  const [viewEpoch, setViewEpoch] = useState(0);

  const applyLoadedData = useCallback(
    (payload: {
      detail: EventDetail;
      orders: AdminOrderRow[];
      payouts: AdminPayoutRow[];
      monetization: EventMonetization;
    }) => {
      setDetail(payload.detail);
      setOrders(payload.orders);
      setPayouts(payload.payouts);
      setMonetization(payload.monetization);
      setViewEpoch((value) => value + 1);
    },
    [],
  );

  const fetchEventAdmin = useCallback(async () => {
    const [detailRes, ordersRes, payoutsRes, moneyRes] = await Promise.all([
      supabase.rpc('admin_get_event_detail', { p_event_id: eventId }),
      supabase.rpc('admin_list_event_orders', { p_event_id: eventId, p_limit: 100 }),
      supabase.rpc('admin_list_payouts', { p_event_id: eventId }),
      supabase.rpc('admin_get_event_monetization', { p_event_id: eventId }),
    ]);

    if (detailRes.error) throw detailRes.error;
    if (ordersRes.error) throw ordersRes.error;
    if (payoutsRes.error) throw payoutsRes.error;
    if (moneyRes.error) throw moneyRes.error;

    return {
      detail: detailRes.data as EventDetail,
      orders: asAdminArray<AdminOrderRow>(ordersRes.data),
      payouts: asAdminArray<AdminPayoutRow>(payoutsRes.data),
      monetization: moneyRes.data as EventMonetization,
    };
  }, [eventId]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      applyLoadedData(await fetchEventAdmin());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [applyLoadedData, fetchEventAdmin]);

  useEffect(() => {
    let isMounted = true;

    async function boot() {
      try {
        const payload = await fetchEventAdmin();
        if (!isMounted) return;
        applyLoadedData(payload);
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    void boot();
    return () => {
      isMounted = false;
    };
  }, [applyLoadedData, fetchEventAdmin]);

  const setPayoutStatus = async (payload: EventAdminPayoutActionPayload) => {
    setError(null);
    const { error: rpcError } = await supabase.rpc('admin_set_payout_status', {
      p_payout_id: payload.payoutId,
      p_status: payload.status,
      p_notes: payload.notes.trim() || null,
    });
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    await loadAll();
  };

  const saveEventFees = async (payload: EventAdminFeeSavePayload) => {
    setSavingFees(true);
    setError(null);
    try {
      const { error: rpcError } = await supabase.rpc('admin_set_event_custom_fees', {
        p_event_id: eventId,
        p_use_custom_fees: payload.useEventOverride,
        p_platform_fee_bps: payload.useEventOverride ? payload.fees.platform_fee_bps : null,
        p_platform_fee_fixed_cents: payload.useEventOverride
          ? payload.fees.platform_fee_fixed_cents
          : null,
        p_processing_fee_bps: payload.useEventOverride ? payload.fees.processing_fee_bps : null,
        p_processing_fee_fixed_cents: payload.useEventOverride
          ? payload.fees.processing_fee_fixed_cents
          : null,
      });
      if (rpcError) throw rpcError;
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingFees(false);
    }
  };

  const pendingPayoutCents = useMemo(
    () =>
      payouts
        .filter((payout) => String(payout.status).toLowerCase() === 'pending')
        .reduce(
          (sum, payout) => sum + Number(payout.organizer_net_cents ?? payout.amount_cents ?? 0),
          0,
        ),
    [payouts],
  );

  const eventOverrideDraft = useMemo(() => {
    if (!monetization) {
      return asFeeSlice(null);
    }
    return asFeeSlice(
      monetization.event_override ?? monetization.effective ?? monetization.event_stored_fees,
      monetization.global,
    );
  }, [monetization]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={dash.magenta} />
        <Text style={styles.muted}>Loading event admin…</Text>
      </View>
    );
  }

  if (!detail || !monetization) {
    return (
      <View style={styles.centered}>
        <Text style={styles.h1}>Event not found</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <GhostButton label="Admin" onPress={() => router.push('/admin')} />
      </View>
    );
  }

  return (
    <EventAdminDashboardView
      key={`${eventId}:${viewEpoch}`}
      detail={toDetailView(detail, pendingPayoutCents)}
      orders={toOrderViews(orders)}
      payouts={toPayoutViews(payouts)}
      globalFees={asFeeSlice(monetization.global)}
      organizerOverride={
        monetization.organizer_override ? asFeeSlice(monetization.organizer_override) : null
      }
      eventOverrideDraft={eventOverrideDraft}
      initialUseEventOverride={Boolean(monetization.use_custom_fees)}
      buyHref={
        isAdminEventBuyable(detail.buyability_status, detail.is_buyable)
          ? buildAdminEventBuyUrl(detail.event_id)
          : null
      }
      scanHref={buildAdminEventScanUrl(detail.event_id)}
      scanAvailable
      scanUnavailableReason={null}
      error={error}
      overviewTools={<GhostButton label="Refresh" onPress={() => void loadAll()} />}
      onBackToAdmin={() => router.push('/admin')}
      onOpenTicket={(secureToken) => {
        void Linking.openURL(buildAdminPassUrl(secureToken));
      }}
      onSetPayoutStatus={(payload) => void setPayoutStatus(payload)}
      onSaveEventFees={(payload) => void saveEventFees(payload)}
      savingFees={savingFees}
    />
  );
}

export default function AdminEventScreen() {
  const params = useLocalSearchParams<{ eventId?: string | string[] }>();
  const eventId = firstParam(params.eventId).trim();

  return (
    <AdminGate>
      {!eventId ? (
        <View style={styles.centered}>
          <Text style={styles.error}>Missing event id</Text>
        </View>
      ) : (
        <EventAdminCockpit eventId={eventId} />
      )}
    </AdminGate>
  );
}
