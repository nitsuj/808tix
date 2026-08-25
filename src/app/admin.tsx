import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useAuth } from '@/contexts/auth-context';
import {
  buildAdminEventBuyUrl,
  buildAdminEventDetailUrl,
  buildAdminEventScanUrl,
  buildAdminOrderSuccessUrl,
  buildAdminPassUrl,
  downloadCsv,
  formatAdminCents,
} from '@/lib/admin-support';
import { supabase } from '@/lib/supabase';
import { organizer, palette, surface, text } from '@/theme/colors';

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

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

async function copyText(value: string): Promise<void> {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
    await navigator.clipboard.writeText(value);
    return;
  }
  // Native clipboard not required for this desktop-first admin cockpit.
}

function LinkButton({ label, href }: { label: string; href: string }) {
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => {
        void Linking.openURL(href);
      }}
      style={styles.linkBtn}
    >
      <Text style={styles.linkBtnText}>{label}</Text>
    </Pressable>
  );
}

function CopyButton({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Pressable
      onPress={async () => {
        await copyText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      style={styles.linkBtn}
    >
      <Text style={styles.linkBtnText}>{copied ? 'Copied' : label}</Text>
    </Pressable>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>{label}</Text>
      <Text style={styles.cardValue}>{value}</Text>
    </View>
  );
}

export function AdminCockpit() {
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

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
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

      setSummary(summaryRes.data as DashboardSummary);
      setEvents(asArray<AdminEventRow>(eventsRes.data));
      setOrders(asArray<AdminOrderRow>(ordersRes.data));
      setPayouts(asArray<AdminPayoutRow>(payoutsRes.data));
      const money = monetizationRes.data as MonetizationSettings;
      setMonetization(money);
      if (money?.global) {
        setFeeDraft({
          platform_fee_bps: String(money.global.platform_fee_bps),
          platform_fee_fixed_cents: String(money.global.platform_fee_fixed_cents),
          processing_fee_bps: String(money.global.processing_fee_bps),
          processing_fee_fixed_cents: String(money.global.processing_fee_fixed_cents),
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      if (cancelled) return;
      await loadAll();
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, [loadAll]);

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
        <SummaryCard
          label="Ticket subtotal"
          value={formatAdminCents(summary?.ticket_subtotal_cents)}
        />
        <SummaryCard
          label="808Tickets service fee"
          value={formatAdminCents(summary?.platform_fee_cents)}
        />
        <SummaryCard
          label="Payment processing fee"
          value={formatAdminCents(summary?.processing_fee_cents)}
        />
        <SummaryCard
          label="Organizer net owed"
          value={formatAdminCents(summary?.organizer_net_cents)}
        />
        <SummaryCard label="Pending payouts" value={String(summary?.pending_payout_count ?? 0)} />
        <SummaryCard label="Paid orders" value={String(summary?.paid_orders_count ?? 0)} />
        <SummaryCard
          label="Paid tickets issued"
          value={String(summary?.paid_tickets_issued_count ?? 0)}
        />
        <SummaryCard label="Checked in" value={String(summary?.checked_in_count ?? 0)} />
      </View>

      <View style={styles.sectionHeaderRow}>
        <Text style={styles.h2}>Events</Text>
        {Platform.OS === 'web' ? (
          <Pressable onPress={exportEventsCsv} style={styles.linkBtn}>
            <Text style={styles.linkBtnText}>Export CSV</Text>
          </Pressable>
        ) : null}
      </View>
      {events.length === 0 ? <Text style={styles.muted}>No events.</Text> : null}
      {events.map((event) => (
        <View key={event.event_id} style={styles.rowCard}>
          <Text style={styles.rowTitle}>{event.event_name}</Text>
          <Text style={styles.muted}>
            {event.organizer_email ?? '—'} · {event.event_date ?? 'no date'}{' '}
            {event.start_time ?? ''} · {event.venue_name ?? 'no venue'}
          </Text>
          <Text style={styles.muted}>
            status={event.status} sales={String(event.sales_enabled)} mode={event.ticketing_mode} ·
            fee source={event.fee_config_source ?? '—'}
          </Text>
          <Text style={styles.body}>
            orders {event.paid_order_count} · tickets {event.paid_ticket_count} · checked-in{' '}
            {event.checked_in_count}
          </Text>
          <Text style={styles.body}>
            subtotal {formatAdminCents(event.ticket_subtotal_cents)} · service{' '}
            {formatAdminCents(event.platform_fee_cents)} · processing{' '}
            {formatAdminCents(event.processing_fee_cents)} · net{' '}
            {formatAdminCents(event.organizer_net_cents)}
          </Text>
          <View style={styles.btnRow}>
            <LinkButton label="Buy" href={buildAdminEventBuyUrl(event.event_id)} />
            <LinkButton label="Event" href={buildAdminEventDetailUrl(event.event_id)} />
            <LinkButton label="Scanner" href={buildAdminEventScanUrl(event.event_id)} />
            <CopyButton label="Copy event ID" value={event.event_id} />
            <CopyButton label="Copy organizer email" value={event.organizer_email ?? ''} />
          </View>
        </View>
      ))}

      <Text style={styles.h2}>Recent orders</Text>
      {orders.length === 0 ? <Text style={styles.muted}>No orders.</Text> : null}
      {orders.map((order) => (
        <View key={order.order_id} style={styles.rowCard}>
          <Text style={styles.rowTitle}>
            {order.event_name} · {order.status}
          </Text>
          <Text style={styles.muted}>
            {order.buyer_name ?? 'Buyer'} · {order.buyer_email}
          </Text>
          <Text style={styles.body}>
            total {formatAdminCents(order.total_cents, order.currency)} · subtotal{' '}
            {formatAdminCents(order.subtotal_cents, order.currency)} · service{' '}
            {formatAdminCents(order.platform_fee_cents, order.currency)} · processing{' '}
            {formatAdminCents(order.processing_fee_cents, order.currency)} · net{' '}
            {formatAdminCents(order.organizer_net_cents, order.currency)}
          </Text>
          <Text style={styles.muted}>
            fee source={order.fee_config_source ?? '—'} · tickets={order.ticket_count} · paid_at=
            {order.paid_at ?? '—'}
          </Text>
          <View style={styles.btnRow}>
            <LinkButton
              label="Order success"
              href={buildAdminOrderSuccessUrl(order.public_access_token)}
            />
            <CopyButton label="Copy order token" value={order.public_access_token} />
            {(order.tickets ?? []).slice(0, 4).map((ticket) => (
              <LinkButton
                key={ticket.secure_token}
                label={`Ticket ${ticket.sequence ?? '?'}`}
                href={buildAdminPassUrl(ticket.secure_token)}
              />
            ))}
          </View>
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
            subtotal {formatAdminCents(payout.subtotal_cents)} · service{' '}
            {formatAdminCents(payout.platform_fee_cents)} · processing{' '}
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
          </View>
        </View>
      ))}

      <Text style={styles.h2}>Monetization</Text>
      <Text style={styles.muted}>
        Precedence: {(monetization?.precedence ?? ['event', 'organizer', 'global']).join(' → ')}.
        Changing global fees does not recalculate existing orders.
      </Text>
      <View style={styles.rowCard}>
        <Text style={styles.rowTitle}>Global defaults</Text>
        {(
          [
            ['platform_fee_bps', 'Service fee bps'],
            ['platform_fee_fixed_cents', 'Service fee fixed ¢ / ticket'],
            ['processing_fee_bps', 'Processing bps'],
            ['processing_fee_fixed_cents', 'Processing fixed ¢'],
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
        <Text style={styles.muted}>No organizer overrides. Use admin RPC to upsert.</Text>
      ) : (
        (monetization?.organizer_overrides ?? []).map((override) => (
          <View key={override.organizer_id} style={styles.rowCard}>
            <Text style={styles.rowTitle}>{override.organizer_email ?? override.organizer_id}</Text>
            <Text style={styles.body}>
              service {override.platform_fee_bps}bps + {override.platform_fee_fixed_cents}¢ ·
              processing {override.processing_fee_bps}bps + {override.processing_fee_fixed_cents}¢
            </Text>
          </View>
        ))
      )}
      <Text style={[styles.muted, { marginBottom: 40 }]}>
        Event custom fees: set via admin_set_event_custom_fees (use_custom_fees on events). Events
        table shows effective fee_config_source.
      </Text>
    </ScrollView>
  );
}

export default function AdminScreen() {
  const router = useRouter();
  const { isLoading, isAuthenticated, profile, isProfileLoading } = useAuth();

  if (isLoading || (isAuthenticated && isProfileLoading)) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator color={organizer.accent} />
          <Text style={styles.muted}>Checking session…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <Text style={styles.h1}>Admin</Text>
          <Text style={styles.muted}>Sign in required to access the platform admin cockpit.</Text>
          <Pressable style={styles.primaryBtn} onPress={() => router.push('/login')}>
            <Text style={styles.primaryBtnText}>Go to login</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!profile?.is_platform_admin) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <Text style={styles.h1}>Not authorized</Text>
          <Text style={styles.muted}>
            This account is signed in but is not a platform admin. Contact an 808Tickets operator if
            you need access.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <AdminCockpit />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: surface.background },
  content: { padding: 20, paddingBottom: 60, maxWidth: 1100, width: '100%', alignSelf: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  h1: { color: palette.white, fontSize: 28, fontWeight: '800', marginBottom: 4 },
  h2: { color: palette.white, fontSize: 20, fontWeight: '700', marginTop: 28, marginBottom: 12 },
  h3: { color: text.secondary, fontSize: 16, fontWeight: '700', marginTop: 12, marginBottom: 8 },
  muted: { color: text.secondary, fontSize: 13, lineHeight: 18 },
  body: { color: text.primary, fontSize: 14, lineHeight: 20, marginTop: 4 },
  error: { color: '#FF6B6B', marginTop: 12, marginBottom: 8 },
  cardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    backgroundColor: surface.card,
    borderRadius: 12,
    padding: 14,
    minWidth: 160,
    flexGrow: 1,
    borderWidth: 1,
    borderColor: surface.divider,
  },
  cardLabel: { color: text.secondary, fontSize: 12, marginBottom: 6 },
  cardValue: { color: organizer.accent, fontSize: 18, fontWeight: '700' },
  rowCard: {
    backgroundColor: surface.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: surface.divider,
    gap: 4,
  },
  rowTitle: { color: palette.white, fontSize: 16, fontWeight: '700' },
  btnRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  linkBtn: {
    borderWidth: 1,
    borderColor: organizer.accent,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  linkBtnText: { color: organizer.accent, fontSize: 12, fontWeight: '600' },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  input: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: surface.divider,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: palette.white,
    backgroundColor: surface.input,
  },
  feeField: { marginBottom: 8 },
  primaryBtn: {
    marginTop: 12,
    backgroundColor: organizer.accent,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  primaryBtnText: { color: organizer.textOn, fontWeight: '800' },
  disabled: { opacity: 0.6 },
});
