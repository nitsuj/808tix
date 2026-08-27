import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { AdminGate } from '@/components/admin/admin-gate';
import { adminStyles as styles } from '@/components/admin/admin-styles';
import {
  AdminBadge,
  AdminMetricCell,
  AdminSummaryCard,
  asAdminArray,
} from '@/components/admin/admin-ui';
import {
  buildAdminCockpitEventPath,
  downloadCsv,
  formatAdminCents,
  formatAdminEventWhen,
  formatAdminFeeSourceLabel,
  formatAdminPayoutStatusSummary,
  formatAdminSalesLabel,
  formatAdminStatusLabel,
} from '@/lib/admin-support';
import { supabase } from '@/lib/supabase';
import { organizer } from '@/theme/colors';

type DashboardSummary = {
  paid_orders_count: number;
  ticket_subtotal_cents: number;
  platform_fee_cents: number;
  processing_fee_cents: number;
  organizer_net_cents: number;
  pending_payout_count: number;
  paid_tickets_issued_count: number;
  checked_in_count: number;
};

type AdminEventRow = {
  event_id: string;
  event_name: string;
  status: string;
  sales_enabled: boolean;
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

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={organizer.accent} />
        <Text style={styles.muted}>Loading admin cockpit…</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.h1}>808Tickets Admin</Text>
      <Text style={styles.muted}>Hidden ops cockpit · direct URL only · platform admin</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.sectionHeaderRow}>
        <Text style={styles.h2}>Overview</Text>
        <Pressable onPress={() => void loadAll()} style={styles.linkBtn}>
          <Text style={styles.linkBtnText}>Refresh</Text>
        </Pressable>
      </View>
      <View style={styles.cardGrid}>
        <AdminSummaryCard
          label="Organizer net owed"
          value={formatAdminCents(summary?.organizer_net_cents)}
        />
        <AdminSummaryCard label="Pending payouts" value={String(summary?.pending_payout_count ?? 0)} />
        <AdminSummaryCard label="Paid orders" value={String(summary?.paid_orders_count ?? 0)} />
        <AdminSummaryCard
          label="Ticket subtotal"
          value={formatAdminCents(summary?.ticket_subtotal_cents)}
        />
        <AdminSummaryCard
          label="808Tickets service fee"
          value={formatAdminCents(summary?.platform_fee_cents)}
        />
        <AdminSummaryCard
          label="Payment processing fee"
          value={formatAdminCents(summary?.processing_fee_cents)}
        />
        <AdminSummaryCard
          label="Paid tickets issued"
          value={String(summary?.paid_tickets_issued_count ?? 0)}
        />
        <AdminSummaryCard label="Checked in" value={String(summary?.checked_in_count ?? 0)} />
      </View>

      <View style={styles.sectionHeaderRow}>
        <Text style={styles.h2}>Events</Text>
        {Platform.OS === 'web' ? (
          <Pressable onPress={exportEventsCsv} style={styles.linkBtn}>
            <Text style={styles.linkBtnText}>Export CSV</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.muted}>
        Open an event for orders, payouts, scanner/buy links, and event fee overrides.
      </Text>
      {events.length === 0 ? <Text style={styles.muted}>No events.</Text> : null}
      {events.map((event) => {
        const salesOn = Boolean(event.sales_enabled);
        const statusLabel = formatAdminStatusLabel(event.status);
        return (
          <Pressable
            key={event.event_id}
            accessibilityRole="link"
            onPress={() => router.push(buildAdminCockpitEventPath(event.event_id) as never)}
            style={styles.rowCard}
          >
            <Text style={styles.rowTitleLink}>{event.event_name}</Text>
            <Text style={styles.metaLine}>{formatAdminEventWhen(event.event_date, event.start_time)}</Text>
            {event.venue_name?.trim() ? (
              <Text style={styles.metaLine}>{event.venue_name.trim()}</Text>
            ) : null}
            <View style={styles.badgeRow}>
              <AdminBadge
                label={statusLabel}
                tone={event.status === 'published' ? 'positive' : 'neutral'}
              />
              <AdminBadge label={formatAdminSalesLabel(salesOn)} tone={salesOn ? 'positive' : 'warn'} />
              <AdminBadge label={`Fee: ${formatAdminFeeSourceLabel(event.fee_config_source)}`} />
              <AdminBadge
                label={`Payouts: ${formatAdminPayoutStatusSummary(event.payout_statuses)}`}
              />
            </View>
            <View style={styles.metricGrid}>
              <AdminMetricCell label="Orders" value={String(event.paid_order_count ?? 0)} />
              <AdminMetricCell label="Tickets" value={String(event.paid_ticket_count ?? 0)} />
              <AdminMetricCell label="Checked in" value={String(event.checked_in_count ?? 0)} />
              <AdminMetricCell
                label="Ticket subtotal"
                value={formatAdminCents(event.ticket_subtotal_cents)}
              />
              <AdminMetricCell
                label="808Tickets service fee"
                value={formatAdminCents(event.platform_fee_cents)}
              />
              <AdminMetricCell
                label="Payment processing fee"
                value={formatAdminCents(event.processing_fee_cents)}
              />
              <AdminMetricCell
                label="Organizer net"
                value={formatAdminCents(event.organizer_net_cents)}
              />
            </View>
          </Pressable>
        );
      })}

      <Text style={styles.h2}>Global monetization</Text>
      <Text style={styles.muted}>
        Precedence: {(monetization?.precedence ?? ['event', 'organizer', 'global']).join(' → ')}.
        Changing global fees does not recalculate existing orders. Event-level custom fees are edited
        on each event admin page.
      </Text>
      <View style={[styles.rowCard, { marginBottom: 40 }]}>
        <Text style={styles.rowTitle}>Global defaults</Text>
        {(
          [
            ['platform_fee_bps', '808Tickets service fee bps'],
            ['platform_fee_fixed_cents', '808Tickets service fee fixed ¢ / ticket'],
            ['processing_fee_bps', 'Payment processing fee bps'],
            ['processing_fee_fixed_cents', 'Payment processing fee fixed ¢'],
          ] as const
        ).map(([key, label]) => (
          <View key={key} style={styles.feeField}>
            <Text style={styles.muted}>{label}</Text>
            <TextInput
              value={feeDraft[key]}
              onChangeText={(value) => setFeeDraft((prev) => ({ ...prev, [key]: value }))}
              keyboardType="number-pad"
              style={styles.input}
            />
          </View>
        ))}
        <Pressable
          style={[styles.primaryBtn, savingFees && styles.disabled]}
          disabled={savingFees}
          onPress={() => void saveGlobalFees()}
        >
          <Text style={styles.primaryBtnText}>{savingFees ? 'Saving…' : 'Save global fees'}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

export default function AdminScreen() {
  return (
    <AdminGate>
      <AdminCockpit />
    </AdminGate>
  );
}
