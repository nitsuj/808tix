import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { AdminGate } from '@/components/admin/admin-gate';
import { dashboardStyles as styles } from '@/components/dashboard/dashboard-styles';
import { dash } from '@/components/dashboard/dashboard-tokens';
import { type DashboardEventRow } from '@/components/dashboard/event-list';
import { GhostButton } from '@/components/dashboard/ghost-button';
import {
  GlobalAdminDashboardView,
  type GlobalAdminMonetization,
  type GlobalAdminSummary,
} from '@/components/dashboard/global-admin-dashboard-view';
import type { StatusBadgeTone } from '@/components/dashboard/status-badge';
import {
  adminBuyabilityTone,
  buildAdminCockpitEventPath,
  downloadCsv,
  formatAdminBuyabilityLabel,
  formatAdminCents,
  formatAdminEventWhen,
  formatAdminFeeSourceLabel,
  formatAdminPayoutStatusSummary,
  formatAdminStatusLabel,
} from '@/lib/admin-support';
import { supabase } from '@/lib/supabase';

type DashboardSummary = GlobalAdminSummary & { paid_orders_count: number };

type AdminEventRow = {
  event_id: string;
  event_name: string;
  status: string;
  sales_enabled: boolean;
  buyability_status?: string | null;
  buyability_label?: string | null;
  is_buyable?: boolean | null;
  event_date: string | null;
  start_time: string | null;
  venue_name: string | null;
  fee_config_source: string | null;
  paid_order_count: number;
  paid_ticket_count: number;
  checked_in_count: number;
  ticket_subtotal_cents: number;
  platform_fee_cents: number;
  processing_fee_cents: number;
  organizer_net_cents: number;
  payout_statuses: string[] | null;
  organizer_email: string | null;
};

type MonetizationSettings = {
  global: {
    platform_fee_bps: number;
    platform_fee_fixed_cents: number;
    processing_fee_bps: number;
    processing_fee_fixed_cents: number;
    updated_at: string | null;
  };
  precedence: string[];
};

function asAdminArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function statusTone(status: string): StatusBadgeTone {
  if (status === 'published') return 'positive';
  if (status === 'draft') return 'draft';
  if (status === 'cancelled') return 'cancelled';
  return 'neutral';
}

function mapEventRow(event: AdminEventRow): DashboardEventRow {
  const buyabilityStatus = event.buyability_status ?? null;
  return {
    eventId: event.event_id,
    eventName: event.event_name,
    whenLabel: formatAdminEventWhen(event.event_date, event.start_time),
    venueName: event.venue_name,
    organizerEmail: event.organizer_email,
    statusLabel: formatAdminStatusLabel(event.status),
    statusTone: statusTone(event.status),
    buyabilityLabel: formatAdminBuyabilityLabel(buyabilityStatus, event.buyability_label),
    buyabilityTone: adminBuyabilityTone(buyabilityStatus),
    feeSourceLabel: formatAdminFeeSourceLabel(event.fee_config_source),
    payoutLabel: formatAdminPayoutStatusSummary(event.payout_statuses),
    paidOrderCount: event.paid_order_count ?? 0,
    paidTicketCount: event.paid_ticket_count ?? 0,
    checkedInCount: event.checked_in_count ?? 0,
    ticketSubtotalLabel: formatAdminCents(event.ticket_subtotal_cents),
    platformFeeLabel: formatAdminCents(event.platform_fee_cents),
    processingFeeLabel: formatAdminCents(event.processing_fee_cents),
    organizerNetLabel: formatAdminCents(event.organizer_net_cents),
  };
}

function toMonetizationView(monetization: MonetizationSettings | null): GlobalAdminMonetization {
  return {
    precedence: monetization?.precedence ?? ['event', 'organizer', 'global'],
    platform_fee_bps: monetization?.global.platform_fee_bps ?? 250,
    platform_fee_fixed_cents: monetization?.global.platform_fee_fixed_cents ?? 99,
    processing_fee_bps: monetization?.global.processing_fee_bps ?? 290,
    processing_fee_fixed_cents: monetization?.global.processing_fee_fixed_cents ?? 30,
  };
}

function AdminCockpit() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [events, setEvents] = useState<AdminEventRow[]>([]);
  const [monetization, setMonetization] = useState<MonetizationSettings | null>(null);
  const [savingFees, setSavingFees] = useState(false);
  const [feeDraft, setFeeDraft] = useState({
    platform_fee_bps: '250',
    platform_fee_fixed_cents: '99',
    processing_fee_bps: '290',
    processing_fee_fixed_cents: '30',
  });

  const applyLoadedData = useCallback(
    (payload: {
      summary: DashboardSummary;
      events: AdminEventRow[];
      monetization: MonetizationSettings;
    }) => {
      setSummary(payload.summary);
      setEvents(payload.events);
      setMonetization(payload.monetization);
      if (payload.monetization?.global) {
        setFeeDraft({
          platform_fee_bps: String(payload.monetization.global.platform_fee_bps),
          platform_fee_fixed_cents: String(payload.monetization.global.platform_fee_fixed_cents),
          processing_fee_bps: String(payload.monetization.global.processing_fee_bps),
          processing_fee_fixed_cents: String(payload.monetization.global.processing_fee_fixed_cents),
        });
      }
    },
    [],
  );

  const fetchCockpit = useCallback(async () => {
    const [summaryRes, eventsRes, monetizationRes] = await Promise.all([
      supabase.rpc('admin_dashboard_summary'),
      supabase.rpc('admin_list_events', { p_limit: 80 }),
      supabase.rpc('admin_get_monetization_settings'),
    ]);

    if (summaryRes.error) throw summaryRes.error;
    if (eventsRes.error) throw eventsRes.error;
    if (monetizationRes.error) throw monetizationRes.error;

    return {
      summary: summaryRes.data as DashboardSummary,
      events: asAdminArray<AdminEventRow>(eventsRes.data),
      monetization: monetizationRes.data as MonetizationSettings,
    };
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      applyLoadedData(await fetchCockpit());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [applyLoadedData, fetchCockpit]);

  useEffect(() => {
    let isMounted = true;

    async function boot() {
      try {
        const payload = await fetchCockpit();
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
  }, [applyLoadedData, fetchCockpit]);

  const dashboardEvents = useMemo(() => events.map(mapEventRow), [events]);

  const exportEventsCsv = useMemo(
    () => () => {
      const rows: string[][] = [
        [
          'event_name',
          'organizer_email',
          'status',
          'sales_enabled',
          'ticket_subtotal_cents',
          'platform_fee_cents',
          'processing_fee_cents',
          'organizer_net_cents',
          'fee_config_source',
          'payout_statuses',
        ],
        ...events.map((event) => [
          event.event_name,
          event.organizer_email ?? '',
          event.status,
          String(event.sales_enabled),
          String(event.ticket_subtotal_cents ?? 0),
          String(event.platform_fee_cents ?? 0),
          String(event.processing_fee_cents ?? 0),
          String(event.organizer_net_cents ?? 0),
          event.fee_config_source ?? '',
          Array.isArray(event.payout_statuses) ? event.payout_statuses.join('|') : '',
        ]),
      ];
      if (Platform.OS === 'web') {
        downloadCsv(`808tickets-admin-events-${Date.now()}.csv`, rows);
      }
    },
    [events],
  );

  const saveGlobalFees = async () => {
    setSavingFees(true);
    setError(null);
    try {
      const { error: rpcError } = await supabase.rpc('admin_update_global_fee_config', {
        p_platform_fee_bps: Number(feeDraft.platform_fee_bps),
        p_platform_fee_fixed_cents: Number(feeDraft.platform_fee_fixed_cents),
        p_processing_fee_bps: Number(feeDraft.processing_fee_bps),
        p_processing_fee_fixed_cents: Number(feeDraft.processing_fee_fixed_cents),
      });
      if (rpcError) throw rpcError;
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingFees(false);
    }
  };

  if (loading || !summary) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={dash.magenta} />
        <Text style={styles.muted}>Loading admin cockpit…</Text>
      </View>
    );
  }

  return (
    <GlobalAdminDashboardView
      summary={summary}
      events={dashboardEvents}
      monetization={toMonetizationView(monetization)}
      onOpenEvent={(eventId) => router.push(buildAdminCockpitEventPath(eventId) as never)}
      onExportCsv={Platform.OS === 'web' ? exportEventsCsv : undefined}
      overviewTools={<GhostButton label="Refresh" onPress={() => void loadAll()} />}
      error={error}
      monetizationEditable
      feeDraft={feeDraft}
      onFeeDraftChange={(key, value) => setFeeDraft((prev) => ({ ...prev, [key]: value }))}
      onSaveFees={() => void saveGlobalFees()}
      savingFees={savingFees}
    />
  );
}

export default function AdminScreen() {
  return (
    <AdminGate>
      <AdminCockpit />
    </AdminGate>
  );
}
