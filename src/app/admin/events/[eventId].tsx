import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { AdminGate } from '@/components/admin/admin-gate';
import { adminStyles as styles } from '@/components/admin/admin-styles';
import {
  AdminBadge,
  AdminCopyButton,
  AdminField,
  AdminLinkButton,
  AdminMetricCell,
  AdminSummaryCard,
  asAdminArray,
} from '@/components/admin/admin-ui';
import {
  buildAdminEventBuyUrl,
  buildAdminEventScanUrl,
  buildAdminPassUrl,
  formatAdminCents,
  formatAdminDateTime,
  formatAdminEventWhen,
  formatAdminFeeSourceLabel,
  formatAdminOrderStatus,
  formatAdminPayoutStatusSummary,
  formatAdminSalesLabel,
  formatAdminStatusLabel,
} from '@/lib/admin-support';
import { supabase } from '@/lib/supabase';
import { organizer } from '@/theme/colors';

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

function formatFeeSlice(slice: FeeSlice | null | undefined): string {
  if (!slice) return '—';
  return `808Tickets service fee ${slice.platform_fee_bps} bps + ${slice.platform_fee_fixed_cents}¢/ticket · Payment processing fee ${slice.processing_fee_bps} bps + ${slice.processing_fee_fixed_cents}¢`;
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
          <Text style={styles.primaryBtnText}>Admin</Text>
        </Pressable>
      </View>
    );
  }

  const salesOn = Boolean(detail.sales_enabled);
  const organizerLabel = [detail.organizer_name, detail.organizer_email]
    .filter((part) => Boolean(part?.trim()))
    .join(' · ');

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.breadcrumbRow}>
        <Pressable accessibilityRole="link" onPress={() => router.push('/admin')}>
          <Text style={styles.breadcrumbLink}>Admin</Text>
        </Pressable>
        <Text style={styles.breadcrumbSep}>/</Text>
        <Text style={styles.breadcrumbCurrent} numberOfLines={1}>
          {detail.event_name}
        </Text>
      </View>

      <Text style={styles.h1}>{detail.event_name}</Text>
      <View style={styles.badgeRow}>
        <AdminBadge
          label={formatAdminStatusLabel(detail.status)}
          tone={detail.status === 'published' ? 'positive' : 'neutral'}
        />
        <AdminBadge label={formatAdminSalesLabel(salesOn)} tone={salesOn ? 'positive' : 'warn'} />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.rowCard}>
        <AdminField
          label="Organizer"
          value={organizerLabel || '—'}
        />
        <AdminField
          label="Date & time"
          value={formatAdminEventWhen(detail.event_date, detail.start_time)}
        />
        <AdminField label="Venue" value={detail.venue_name?.trim() || '—'} />
        <AdminField
          label="Ticketing mode"
          value={detail.ticketing_mode?.replaceAll('_', ' ') || '—'}
        />
        <View style={styles.btnRow}>
          <AdminCopyButton label="Copy event ID" value={detail.event_id} />
          {detail.organizer_email ? (
            <AdminCopyButton label="Copy organizer email" value={detail.organizer_email} />
          ) : null}
          <AdminLinkButton label="Buy page" href={buildAdminEventBuyUrl(detail.event_id)} />
          <AdminLinkButton label="Scanner" href={buildAdminEventScanUrl(detail.event_id)} />
        </View>
        <Text style={styles.muted}>Scanner requires an authenticated organizer/admin session.</Text>
      </View>

      <View style={styles.sectionHeaderRow}>
        <Text style={styles.h2}>Metrics</Text>
        <Pressable onPress={() => void loadAll()} style={styles.linkBtn}>
          <Text style={styles.linkBtnText}>Refresh</Text>
        </Pressable>
      </View>
      <View style={styles.cardGrid}>
        <AdminSummaryCard label="Orders" value={String(detail.paid_order_count ?? 0)} />
        <AdminSummaryCard label="Tickets" value={String(detail.paid_ticket_count ?? 0)} />
        <AdminSummaryCard label="Checked in" value={String(detail.checked_in_count ?? 0)} />
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
          label="Organizer net"
          value={formatAdminCents(detail.organizer_net_cents)}
        />
        <AdminSummaryCard
          label="Payout status"
          value={formatAdminPayoutStatusSummary(detail.payout_statuses)}
        />
      </View>

      <Text style={styles.h2}>Monetization</Text>
      <Text style={styles.muted}>
        {(monetization?.notes ??
          'Existing orders are not recalculated. Changes affect new orders only.') +
          ' Old orders continue to report their stored snapshot values.'}
      </Text>
      <View style={styles.rowCard}>
        <AdminField
          label="Effective fee source"
          value={formatAdminFeeSourceLabel(
            monetization?.effective?.source ?? detail.fee_config_source,
          )}
        />
        <AdminField label="Effective rates" value={formatFeeSlice(monetization?.effective)} />
        <AdminField label="Global defaults" value={formatFeeSlice(monetization?.global)} />
        <AdminField
          label="Organizer override"
          value={
            monetization?.organizer_override
              ? formatFeeSlice(monetization.organizer_override)
              : 'None'
          }
        />
        <AdminField
          label="Event override"
          value={
            monetization?.use_custom_fees
              ? formatFeeSlice(monetization.event_override)
              : 'Inactive — using organizer/global effective config'
          }
        />

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
            Saving with “Use global/organizer effective” turns off the event override flag. Stored
            event fee columns are kept but unused.
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

      <Text style={styles.h2}>Orders / tickets</Text>
      {orders.length === 0 ? <Text style={styles.muted}>No orders for this event.</Text> : null}
      {orders.map((order) => (
        <View key={order.order_id} style={styles.rowCard}>
          <View style={styles.badgeRow}>
            <AdminBadge
              label={formatAdminOrderStatus(order.status)}
              tone={order.status === 'paid' ? 'positive' : 'neutral'}
            />
            <AdminBadge
              label={`Fee: ${formatAdminFeeSourceLabel(order.fee_config_source)}`}
            />
          </View>
          <AdminField
            label="Buyer"
            value={`${order.buyer_name?.trim() || 'Buyer'} · ${order.buyer_email}`}
          />
          <AdminField label="Paid" value={formatAdminDateTime(order.paid_at)} />
          <View style={styles.metricGrid}>
            <AdminMetricCell label="Tickets" value={String(order.ticket_count ?? 0)} />
            <AdminMetricCell
              label="Ticket subtotal"
              value={formatAdminCents(order.subtotal_cents, order.currency)}
            />
            <AdminMetricCell
              label="808Tickets service fee"
              value={formatAdminCents(order.platform_fee_cents, order.currency)}
            />
            <AdminMetricCell
              label="Payment processing fee"
              value={formatAdminCents(order.processing_fee_cents, order.currency)}
            />
            <AdminMetricCell
              label="Organizer net"
              value={formatAdminCents(order.organizer_net_cents, order.currency)}
            />
          </View>
          {(order.tickets ?? []).length > 0 ? (
            <View style={styles.btnRow}>
              {(order.tickets ?? []).slice(0, 8).map((ticket) => (
                <AdminLinkButton
                  key={ticket.secure_token}
                  label={`Ticket ${ticket.sequence ?? '?'}`}
                  href={buildAdminPassUrl(ticket.secure_token)}
                />
              ))}
            </View>
          ) : null}
        </View>
      ))}

      <Text style={styles.h2}>Payouts</Text>
      {payouts.length === 0 ? <Text style={styles.muted}>No payouts for this event.</Text> : null}
      {payouts.map((payout) => (
        <View key={payout.payout_id} style={[styles.rowCard, { marginBottom: 16 }]}>
          <View style={styles.badgeRow}>
            <AdminBadge
              label={formatAdminOrderStatus(payout.status)}
              tone={
                payout.status === 'paid'
                  ? 'positive'
                  : payout.status === 'withheld'
                    ? 'warn'
                    : 'neutral'
              }
            />
          </View>
          <AdminField
            label="Amount"
            value={formatAdminCents(payout.amount_cents, payout.currency)}
          />
          <AdminField
            label="Organizer net"
            value={formatAdminCents(payout.organizer_net_cents, payout.currency)}
          />
          <AdminField label="Paid at" value={formatAdminDateTime(payout.paid_at)} />
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
