import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { AdminGate } from '@/components/admin/admin-gate';
import { adminStyles as styles } from '@/components/admin/admin-styles';
import {
  AdminCopyButton,
  AdminSummaryCard,
  asAdminArray,
} from '@/components/admin/admin-ui';
import {
  buildAdminCockpitEventPath,
  downloadCsv,
  formatAdminCents,
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
  event_slug: string;
  status: string;
  sales_enabled: boolean;
  ticketing_mode: string;
  event_date: string | null;
  start_time: string | null;
  venue_name: string | null;
  organizer_id: string;
  organizer_email: string | null;
  organizer_name: string | null;
  use_custom_fees: boolean;
  fee_config_source: string | null;
  paid_order_count: number;
  paid_ticket_count: number;
  checked_in_count: number;
  ticket_subtotal_cents: number;
  platform_fee_cents: number;
  processing_fee_cents: number;
  organizer_net_cents: number;
  payout_statuses: string[] | null;
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
  event_id: string;
  event_name: string;
  subtotal_cents: number;
  platform_fee_cents: number;
  processing_fee_cents: number | null;
  total_cents: number;
  organizer_net_cents: number;
  fee_config_source: string | null;
  currency: string;
  created_at: string;
  paid_at: string | null;
  ticket_count: number;
  tickets: AdminOrderTicket[] | null;
};

type AdminPayoutRow = {
  payout_id: string;
  status: string;
  amount_cents: number;
  currency: string;
  organizer_email: string | null;
  event_name: string | null;
  event_id: string | null;
  order_id: string;
  paid_at: string | null;
  notes: string | null;
  subtotal_cents: number | null;
  platform_fee_cents: number | null;
  processing_fee_cents: number | null;
  organizer_net_cents: number | null;
};

type MonetizationSettings = {
  global: {
    platform_fee_bps: number;
    platform_fee_fixed_cents: number;
    processing_fee_bps: number;
    processing_fee_fixed_cents: number;
    updated_at: string | null;
  };
  organizer_overrides: {
    organizer_id: string;
    organizer_email: string | null;
    organizer_name: string | null;
    platform_fee_bps: number;
    platform_fee_fixed_cents: number;
    processing_fee_bps: number;
    processing_fee_fixed_cents: number;
  }[];
  precedence: string[];
};

function AdminCockpit() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [events, setEvents] = useState<AdminEventRow[]>([]);
  const [orders, setOrders] = useState<AdminOrderRow[]>([]);
  const [payouts, setPayouts] = useState<AdminPayoutRow[]>([]);
  const [monetization, setMonetization] = useState<MonetizationSettings | null>(null);
  const [savingFees, setSavingFees] = useState(false);
  const [feeDraft, setFeeDraft] = useState({
    platform_fee_bps: '250',
    platform_fee_fixed_cents: '99',
    processing_fee_bps: '290',
    processing_fee_fixed_cents: '30',
  });
  const [payoutNotes, setPayoutNotes] = useState<Record<string, string>>({});

  const applyLoadedData = useCallback(
    (payload: {
      summary: DashboardSummary;
      events: AdminEventRow[];
      orders: AdminOrderRow[];
      payouts: AdminPayoutRow[];
      monetization: MonetizationSettings;
    }) => {
      setSummary(payload.summary);
      setEvents(payload.events);
      setOrders(payload.orders);
      setPayouts(payload.payouts);
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
    const [summaryRes, eventsRes, ordersRes, payoutsRes, monetizationRes] = await Promise.all([
      supabase.rpc('admin_dashboard_summary'),
      supabase.rpc('admin_list_events', { p_limit: 80 }),
      supabase.rpc('admin_list_recent_orders', { p_limit: 50 }),
      supabase.rpc('admin_list_payouts'),
      supabase.rpc('admin_get_monetization_settings'),
    ]);

    if (summaryRes.error) throw summaryRes.error;
    if (eventsRes.error) throw eventsRes.error;
    if (ordersRes.error) throw ordersRes.error;
    if (payoutsRes.error) throw payoutsRes.error;
    if (monetizationRes.error) throw monetizationRes.error;

    return {
      summary: summaryRes.data as DashboardSummary,
      events: asAdminArray<AdminEventRow>(eventsRes.data),
      orders: asAdminArray<AdminOrderRow>(ordersRes.data),
      payouts: asAdminArray<AdminPayoutRow>(payoutsRes.data),
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

  const setPayoutStatus = async (payoutId: string, status: 'pending' | 'paid' | 'withheld') => {
    const notes = payoutNotes[payoutId]?.trim() || null;
    const { error: rpcError } = await supabase.rpc('admin_set_payout_status', {
      p_payout_id: payoutId,
      p_status: status,
      p_notes: notes,
    });
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    await loadAll();
  };

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
        <Text style={styles.h2}>Dashboard</Text>
        <Pressable onPress={() => void loadAll()} style={styles.linkBtn}>
          <Text style={styles.linkBtnText}>Refresh</Text>
        </Pressable>
      </View>
      <View style={styles.cardGrid}>
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
          label="Organizer net owed"
          value={formatAdminCents(summary?.organizer_net_cents)}
        />
        <AdminSummaryCard label="Pending payouts" value={String(summary?.pending_payout_count ?? 0)} />
        <AdminSummaryCard label="Paid orders" value={String(summary?.paid_orders_count ?? 0)} />
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
        Open an event for buy/scanner links, orders, payouts, and event fee overrides.
      </Text>
      {events.length === 0 ? <Text style={styles.muted}>No events.</Text> : null}
      {events.map((event) => (
        <View key={event.event_id} style={styles.rowCard}>
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push(buildAdminCockpitEventPath(event.event_id) as never)}
          >
            <Text style={styles.rowTitleLink}>{event.event_name}</Text>
          </Pressable>
          <Text style={styles.muted}>
            {event.organizer_email ?? '—'} · {event.event_date ?? 'no date'}{' '}
            {event.start_time ?? ''} · {event.venue_name ?? 'no venue'}
          </Text>
          <Text style={styles.muted}>
            status={event.status} · sales={String(event.sales_enabled)} · fee source=
            {event.fee_config_source ?? '—'} · payouts=
            {Array.isArray(event.payout_statuses) && event.payout_statuses.length > 0
              ? event.payout_statuses.join(', ')
              : 'none'}
          </Text>
          <Text style={styles.body}>
            orders {event.paid_order_count} · tickets {event.paid_ticket_count} · checked-in{' '}
            {event.checked_in_count}
          </Text>
          <Text style={styles.body}>
            subtotal {formatAdminCents(event.ticket_subtotal_cents)} · 808Tickets service fee{' '}
            {formatAdminCents(event.platform_fee_cents)} · Payment processing fee{' '}
            {formatAdminCents(event.processing_fee_cents)} · net{' '}
            {formatAdminCents(event.organizer_net_cents)}
          </Text>
          <View style={styles.btnRow}>
            <AdminCopyButton label="Copy event ID" value={event.event_id} />
            {event.organizer_email ? (
              <AdminCopyButton label="Copy organizer email" value={event.organizer_email} />
            ) : null}
          </View>
        </View>
      ))}

      <Text style={styles.h2}>Recent orders</Text>
      {orders.length === 0 ? <Text style={styles.muted}>No orders.</Text> : null}
      {orders.map((order) => (
        <View key={order.order_id} style={styles.rowCard}>
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push(buildAdminCockpitEventPath(order.event_id) as never)}
          >
            <Text style={styles.rowTitleLink}>
              {order.event_name} · {order.status}
            </Text>
          </Pressable>
          <Text style={styles.muted}>
            {order.buyer_name ?? 'Buyer'} · {order.buyer_email}
          </Text>
          <Text style={styles.body}>
            total {formatAdminCents(order.total_cents, order.currency)} · subtotal{' '}
            {formatAdminCents(order.subtotal_cents, order.currency)} · 808Tickets service fee{' '}
            {formatAdminCents(order.platform_fee_cents, order.currency)} · Payment processing fee{' '}
            {formatAdminCents(order.processing_fee_cents, order.currency)} · net{' '}
            {formatAdminCents(order.organizer_net_cents, order.currency)}
          </Text>
          <Text style={styles.muted}>
            fee source={order.fee_config_source ?? '—'} · tickets={order.ticket_count} · paid_at=
            {order.paid_at ?? '—'}
          </Text>
        </View>
      ))}

      <Text style={styles.h2}>Payout queue</Text>
      {payouts.length === 0 ? <Text style={styles.muted}>No payouts.</Text> : null}
      {payouts.map((payout) => (
        <View key={payout.payout_id} style={styles.rowCard}>
          <Text style={styles.rowTitle}>
            {payout.event_name ?? 'Event'} · {formatAdminCents(payout.amount_cents, payout.currency)} ·{' '}
            {payout.status}
          </Text>
          <Text style={styles.muted}>{payout.organizer_email ?? '—'}</Text>
          <Text style={styles.body}>
            subtotal {formatAdminCents(payout.subtotal_cents)} · 808Tickets service fee{' '}
            {formatAdminCents(payout.platform_fee_cents)} · Payment processing fee{' '}
            {formatAdminCents(payout.processing_fee_cents)} · net{' '}
            {formatAdminCents(payout.organizer_net_cents)}
          </Text>
          <TextInput
            value={payoutNotes[payout.payout_id] ?? payout.notes ?? ''}
            onChangeText={(value) =>
              setPayoutNotes((prev) => ({ ...prev, [payout.payout_id]: value }))
            }
            placeholder="Notes"
            placeholderTextColor="#666"
            style={styles.input}
          />
          <View style={styles.btnRow}>
            <Pressable
              style={styles.linkBtn}
              onPress={() => void setPayoutStatus(payout.payout_id, 'paid')}
            >
              <Text style={styles.linkBtnText}>Mark paid</Text>
            </Pressable>
            <Pressable
              style={styles.linkBtn}
              onPress={() => void setPayoutStatus(payout.payout_id, 'withheld')}
            >
              <Text style={styles.linkBtnText}>Mark withheld</Text>
            </Pressable>
            <Pressable
              style={styles.linkBtn}
              onPress={() => void setPayoutStatus(payout.payout_id, 'pending')}
            >
              <Text style={styles.linkBtnText}>Return pending</Text>
            </Pressable>
            {payout.event_id ? (
              <Pressable
                style={styles.linkBtn}
                onPress={() => router.push(buildAdminCockpitEventPath(payout.event_id!) as never)}
              >
                <Text style={styles.linkBtnText}>Open event</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ))}

      <Text style={styles.h2}>Monetization</Text>
      <Text style={styles.muted}>
        Precedence: {(monetization?.precedence ?? ['event', 'organizer', 'global']).join(' → ')}.
        Changing global fees does not recalculate existing orders. Event-level overrides live on each
        event admin page.
      </Text>
      <View style={styles.rowCard}>
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

      <Text style={styles.h3}>Organizer overrides</Text>
      {(monetization?.organizer_overrides ?? []).length === 0 ? (
        <Text style={[styles.muted, { marginBottom: 40 }]}>
          No organizer overrides. Event custom fees are edited on /admin/events/:eventId.
        </Text>
      ) : (
        (monetization?.organizer_overrides ?? []).map((override) => (
          <View key={override.organizer_id} style={styles.rowCard}>
            <Text style={styles.rowTitle}>{override.organizer_email ?? override.organizer_id}</Text>
            <Text style={styles.body}>
              808Tickets service fee {override.platform_fee_bps}bps +{' '}
              {override.platform_fee_fixed_cents}¢ · Payment processing fee{' '}
              {override.processing_fee_bps}bps + {override.processing_fee_fixed_cents}¢
            </Text>
          </View>
        ))
      )}
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
