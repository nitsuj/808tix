import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { AdminGate } from '@/components/admin/admin-gate';
import { adminStyles as styles } from '@/components/admin/admin-styles';
import {
  AdminCopyButton,
  AdminLinkButton,
  AdminSummaryCard,
  asAdminArray,
} from '@/components/admin/admin-ui';
import {
  buildAdminEventBuyUrl,
  buildAdminEventDetailUrl,
  buildAdminEventScanUrl,
  buildAdminOrderSuccessUrl,
  buildAdminPassUrl,
  formatAdminCents,
} from '@/lib/admin-support';
import { supabase } from '@/lib/supabase';
import { organizer } from '@/theme/colors';

type EventDetail = {
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
  platform_fee_bps: number;
  platform_fee_fixed_cents: number;
  processing_fee_bps: number;
  processing_fee_fixed_cents: number;
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

type FeeSlice = {
  platform_fee_bps: number;
  platform_fee_fixed_cents: number;
  processing_fee_bps: number;
  processing_fee_fixed_cents: number;
};

type EventMonetization = {
  event_id: string;
  use_custom_fees: boolean;
  event_override: FeeSlice | null;
  event_stored_fees: FeeSlice;
  organizer_override: (FeeSlice & {
    organizer_id: string;
    organizer_email: string | null;
    organizer_name: string | null;
  }) | null;
  global: FeeSlice & { updated_at: string | null };
  effective: FeeSlice & { source: string };
  precedence: string[];
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
  total_cents: number;
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

function formatFeeSlice(slice: FeeSlice | null | undefined): string {
  if (!slice) return '—';
  return `808Tickets service fee ${slice.platform_fee_bps}bps + ${slice.platform_fee_fixed_cents}¢ · Payment processing fee ${slice.processing_fee_bps}bps + ${slice.processing_fee_fixed_cents}¢`;
}

function EventAdminCockpit({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [orders, setOrders] = useState<AdminOrderRow[]>([]);
  const [payouts, setPayouts] = useState<AdminPayoutRow[]>([]);
  const [monetization, setMonetization] = useState<EventMonetization | null>(null);
  const [payoutNotes, setPayoutNotes] = useState<Record<string, string>>({});
  const [savingFees, setSavingFees] = useState(false);
  const [useCustomFees, setUseCustomFees] = useState(false);
  const [feeDraft, setFeeDraft] = useState({
    platform_fee_bps: '250',
    platform_fee_fixed_cents: '99',
    processing_fee_bps: '290',
    processing_fee_fixed_cents: '30',
  });

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
      setUseCustomFees(Boolean(payload.monetization?.use_custom_fees));
      const draftSource =
        payload.monetization?.event_override ??
        payload.monetization?.effective ??
        payload.monetization?.event_stored_fees ??
        payload.monetization?.global;
      if (draftSource) {
        setFeeDraft({
          platform_fee_bps: String(draftSource.platform_fee_bps),
          platform_fee_fixed_cents: String(draftSource.platform_fee_fixed_cents),
          processing_fee_bps: String(draftSource.processing_fee_bps),
          processing_fee_fixed_cents: String(draftSource.processing_fee_fixed_cents),
        });
      }
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

  const saveEventFees = async () => {
    setSavingFees(true);
    setError(null);
    try {
      const { error: rpcError } = await supabase.rpc('admin_set_event_custom_fees', {
        p_event_id: eventId,
        p_use_custom_fees: useCustomFees,
        p_platform_fee_bps: useCustomFees ? Number(feeDraft.platform_fee_bps) : null,
        p_platform_fee_fixed_cents: useCustomFees
          ? Number(feeDraft.platform_fee_fixed_cents)
          : null,
        p_processing_fee_bps: useCustomFees ? Number(feeDraft.processing_fee_bps) : null,
        p_processing_fee_fixed_cents: useCustomFees
          ? Number(feeDraft.processing_fee_fixed_cents)
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

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={organizer.accent} />
        <Text style={styles.muted}>Loading event admin…</Text>
      </View>
    );
  }

  if (!detail) {
    return (
      <View style={styles.centered}>
        <Text style={styles.h1}>Event not found</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable style={styles.primaryBtn} onPress={() => router.push('/admin')}>
          <Text style={styles.primaryBtnText}>Back to global admin</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Pressable onPress={() => router.push('/admin')} style={styles.linkBtn}>
        <Text style={styles.linkBtnText}>← Back to global admin</Text>
      </Pressable>

      <Text style={styles.h1}>{detail.event_name}</Text>
      <Text style={styles.muted}>Event admin · platform ops only</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={styles.h2}>Overview</Text>
      <View style={styles.rowCard}>
        <Text style={styles.body}>
          Organizer: {detail.organizer_name ?? '—'} · {detail.organizer_email ?? '—'}
        </Text>
        <Text style={styles.muted}>
          {detail.event_date ?? 'no date'} {detail.start_time ?? ''} · {detail.venue_name ?? 'no venue'}
        </Text>
        <Text style={styles.muted}>
          status={detail.status} · sales={String(detail.sales_enabled)} · mode=
          {detail.ticketing_mode} · fee source={detail.fee_config_source ?? '—'}
        </Text>
        <Text style={styles.body}>
          orders {detail.paid_order_count} · tickets {detail.paid_ticket_count} · checked-in{' '}
          {detail.checked_in_count}
        </Text>
        <View style={styles.btnRow}>
          <AdminCopyButton label="Copy event ID" value={detail.event_id} />
          {detail.organizer_email ? (
            <AdminCopyButton label="Copy organizer email" value={detail.organizer_email} />
          ) : null}
        </View>
      </View>

      <View style={styles.cardGrid}>
        <AdminSummaryCard
          label="Ticket subtotal"
          value={formatAdminCents(detail.ticket_subtotal_cents)}
        />
        <AdminSummaryCard
          label="808Tickets service fee"
          value={formatAdminCents(detail.platform_fee_cents)}
        />
        <AdminSummaryCard
          label="Payment processing fee"
          value={formatAdminCents(detail.processing_fee_cents)}
        />
        <AdminSummaryCard
          label="Organizer net owed"
          value={formatAdminCents(detail.organizer_net_cents)}
        />
      </View>

      <Text style={styles.h2}>Support links</Text>
      <View style={styles.btnRow}>
        <AdminLinkButton label="Public buy page" href={buildAdminEventBuyUrl(detail.event_id)} />
        <AdminLinkButton label="Public event page" href={buildAdminEventDetailUrl(detail.event_id)} />
        <AdminLinkButton label="Scanner" href={buildAdminEventScanUrl(detail.event_id)} />
        <Pressable style={styles.linkBtn} onPress={() => router.push('/admin')}>
          <Text style={styles.linkBtnText}>Back to global admin</Text>
        </Pressable>
      </View>

      <View style={styles.sectionHeaderRow}>
        <Text style={styles.h2}>Orders / tickets</Text>
        <Pressable onPress={() => void loadAll()} style={styles.linkBtn}>
          <Text style={styles.linkBtnText}>Refresh</Text>
        </Pressable>
      </View>
      {orders.length === 0 ? <Text style={styles.muted}>No orders for this event.</Text> : null}
      {orders.map((order) => (
        <View key={order.order_id} style={styles.rowCard}>
          <Text style={styles.rowTitle}>{order.status}</Text>
          <Text style={styles.muted}>
            {order.buyer_name ?? 'Buyer'} · {order.buyer_email}
          </Text>
          <Text style={styles.body}>
            tickets {order.ticket_count} · subtotal{' '}
            {formatAdminCents(order.subtotal_cents, order.currency)} · 808Tickets service fee{' '}
            {formatAdminCents(order.platform_fee_cents, order.currency)} · Payment processing fee{' '}
            {formatAdminCents(order.processing_fee_cents, order.currency)} · net{' '}
            {formatAdminCents(order.organizer_net_cents, order.currency)}
          </Text>
          <Text style={styles.muted}>
            fee source={order.fee_config_source ?? '—'} · paid_at={order.paid_at ?? '—'}
          </Text>
          <View style={styles.btnRow}>
            <AdminLinkButton
              label="Order success"
              href={buildAdminOrderSuccessUrl(order.public_access_token)}
            />
            {(order.tickets ?? []).slice(0, 6).map((ticket) => (
              <AdminLinkButton
                key={ticket.secure_token}
                label={`Ticket ${ticket.sequence ?? '?'}`}
                href={buildAdminPassUrl(ticket.secure_token)}
              />
            ))}
          </View>
        </View>
      ))}

      <Text style={styles.h2}>Payouts</Text>
      {payouts.length === 0 ? <Text style={styles.muted}>No payouts for this event.</Text> : null}
      {payouts.map((payout) => (
        <View key={payout.payout_id} style={styles.rowCard}>
          <Text style={styles.rowTitle}>
            {formatAdminCents(payout.amount_cents, payout.currency)} · {payout.status}
          </Text>
          <Text style={styles.muted}>
            paid_at={payout.paid_at ?? '—'} · net owed{' '}
            {formatAdminCents(payout.organizer_net_cents, payout.currency)}
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

      <Text style={styles.h2}>Event monetization</Text>
      <Text style={styles.muted}>
        {(monetization?.notes ??
          'Existing orders are not recalculated. Changes affect new orders only.') +
          ' Old orders continue to report their stored snapshot values.'}
      </Text>
      <View style={styles.rowCard}>
        <Text style={styles.rowTitle}>
          Effective source: {monetization?.effective?.source ?? detail.fee_config_source ?? '—'}
        </Text>
        <Text style={styles.body}>{formatFeeSlice(monetization?.effective)}</Text>
        <Text style={styles.h3}>Global default</Text>
        <Text style={styles.muted}>{formatFeeSlice(monetization?.global)}</Text>
        <Text style={styles.h3}>Organizer override</Text>
        <Text style={styles.muted}>
          {monetization?.organizer_override
            ? formatFeeSlice(monetization.organizer_override)
            : 'None (falls through to global when event override is off)'}
        </Text>
        <Text style={styles.h3}>Event override</Text>
        <Text style={styles.muted}>
          {monetization?.use_custom_fees
            ? formatFeeSlice(monetization.event_override)
            : 'Inactive — using organizer/global effective config'}
        </Text>

        <Text style={styles.h3}>Edit event fees</Text>
        <View style={styles.toggleRow}>
          <Pressable
            style={useCustomFees ? styles.toggleIdle : styles.toggleActive}
            onPress={() => setUseCustomFees(false)}
          >
            <Text style={useCustomFees ? styles.toggleIdleText : styles.toggleActiveText}>
              Use global/organizer effective
            </Text>
          </Pressable>
          <Pressable
            style={useCustomFees ? styles.toggleActive : styles.toggleIdle}
            onPress={() => setUseCustomFees(true)}
          >
            <Text style={useCustomFees ? styles.toggleActiveText : styles.toggleIdleText}>
              Use event-specific override
            </Text>
          </Pressable>
        </View>

        {useCustomFees ? (
          (
            [
              ['platform_fee_bps', '808Tickets service fee bps'],
              ['platform_fee_fixed_cents', '808Tickets service fee ¢ / ticket'],
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
          ))
        ) : (
          <Text style={styles.muted}>
            Saving with “Use global/organizer effective” clears the event override flag
            (use_custom_fees=false). Stored event fee columns are kept but unused.
          </Text>
        )}

        <Pressable
          style={[styles.primaryBtn, savingFees && styles.disabled]}
          disabled={savingFees}
          onPress={() => void saveEventFees()}
        >
          <Text style={styles.primaryBtnText}>
            {savingFees ? 'Saving…' : 'Save event fee settings'}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
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
