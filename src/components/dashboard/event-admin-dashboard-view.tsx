import type { ReactNode } from 'react';
import { useState } from 'react';
import { Linking, Pressable, Text, TextInput, useWindowDimensions, View } from 'react-native';

import { DashboardSectionHeader } from '@/components/dashboard/dashboard-section-header';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { dashboardStyles as styles } from '@/components/dashboard/dashboard-styles';
import { dash } from '@/components/dashboard/dashboard-tokens';
import { EmptyState } from '@/components/dashboard/empty-state';
import { GhostButton } from '@/components/dashboard/ghost-button';
import { InfoField } from '@/components/dashboard/info-field';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { MetricChip } from '@/components/dashboard/metric-chip';
import { StatusBadge, type StatusBadgeTone } from '@/components/dashboard/status-badge';
import { TicketSalesChartCard } from '@/components/dashboard/ticket-sales-chart-card';

export type EventAdminOrderTicketView = {
  secureToken: string;
  sequence: number;
  statusLabel: string;
  statusTone: StatusBadgeTone;
  ticketTypeLabel: string;
};

export type EventAdminOrderView = {
  orderId: string;
  buyerName: string;
  buyerEmail: string;
  statusLabel: string;
  statusTone: StatusBadgeTone;
  paidAtLabel: string;
  ticketCount: number;
  ticketTypeSummary: string;
  ticketSubtotalLabel: string;
  platformFeeLabel: string;
  processingFeeLabel: string;
  organizerNetLabel: string;
  tickets: EventAdminOrderTicketView[];
};

export type EventAdminPayoutView = {
  payoutId: string;
  amountLabel: string;
  statusLabel: string;
  statusTone: StatusBadgeTone;
  statusValue: 'pending' | 'paid' | 'withheld' | string;
  paidAtLabel: string | null;
  notes: string;
};

export type EventAdminFeeSliceView = {
  platform_fee_bps: number;
  platform_fee_fixed_cents: number;
  processing_fee_bps: number;
  processing_fee_fixed_cents: number;
};

export type EventAdminDetailView = {
  eventId: string;
  eventName: string;
  organizerName: string;
  organizerEmail: string;
  venueName: string;
  venueAddress: string;
  whenLabel: string;
  statusLabel: string;
  statusTone: StatusBadgeTone;
  salesLabel: string;
  salesTone: StatusBadgeTone;
  buyabilityLabel: string;
  buyabilityTone: StatusBadgeTone;
  buyabilityStatus: string;
  isBuyable: boolean;
  activeTicketTypeCount: number;
  ticketQuantityAvailable: number | null;
  feeSourceLabel: string;
  payoutLabel: string;
  payoutTone: StatusBadgeTone;
  ticketingModeLabel: string;
  grossTicketSalesLabel: string;
  ticketsSold: number;
  orders: number;
  checkedIn: number;
  platformFeeLabel: string;
  processingFeeLabel: string;
  organizerNetLabel: string;
  pendingPayoutLabel: string;
};

type FeeDraft = {
  platform_fee_bps: string;
  platform_fee_fixed_cents: string;
  processing_fee_bps: string;
  processing_fee_fixed_cents: string;
};

export type EventAdminFeeSavePayload = {
  useEventOverride: boolean;
  fees: EventAdminFeeSliceView;
};

export type EventAdminPayoutActionPayload = {
  payoutId: string;
  status: 'pending' | 'paid' | 'withheld';
  notes: string;
};

export type EventAdminDashboardViewProps = {
  detail: EventAdminDetailView;
  orders: EventAdminOrderView[];
  payouts: EventAdminPayoutView[];
  globalFees: EventAdminFeeSliceView;
  organizerOverride: EventAdminFeeSliceView | null;
  eventOverrideDraft: EventAdminFeeSliceView;
  /** Initial/synced event override toggle (from live monetization.use_custom_fees). */
  initialUseEventOverride?: boolean;
  /** Buy page href only when the event is actually buyable. */
  buyHref?: string | null;
  /** Scanner href when platform admin / organizer can open scanner for this event. */
  scanHref?: string | null;
  scanAvailable?: boolean;
  scanUnavailableReason?: string | null;
  chartSeries?: readonly number[];
  chartLabels?: readonly string[];
  chartYAxisLabels?: readonly [string, string, string];
  topBanner?: ReactNode;
  overviewTools?: ReactNode;
  error?: string | null;
  onBackToAdmin: () => void;
  onOpenTicket?: (secureToken: string) => void;
  onSetPayoutStatus?: (payload: EventAdminPayoutActionPayload) => void;
  onSaveEventFees?: (payload: EventAdminFeeSavePayload) => void;
  savingFees?: boolean;
  readOnly?: boolean;
  footnote?: string;
};

function formatFeeSlice(slice: EventAdminFeeSliceView): string {
  return `808Tickets service fee ${slice.platform_fee_bps} bps + ${slice.platform_fee_fixed_cents}¢/ticket · Payment processing fee ${slice.processing_fee_bps} bps + ${slice.processing_fee_fixed_cents}¢`;
}

function draftFromSlice(slice: EventAdminFeeSliceView): FeeDraft {
  return {
    platform_fee_bps: String(slice.platform_fee_bps),
    platform_fee_fixed_cents: String(slice.platform_fee_fixed_cents),
    processing_fee_bps: String(slice.processing_fee_bps),
    processing_fee_fixed_cents: String(slice.processing_fee_fixed_cents),
  };
}

function OrderCard({
  order,
  onOpenTicket,
}: {
  order: EventAdminOrderView;
  onOpenTicket?: (secureToken: string) => void;
}) {
  return (
    <View style={styles.orderCard}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.tdStrong}>{order.buyerName}</Text>
          <Text style={styles.eventMeta}>{order.buyerEmail}</Text>
        </View>
        <StatusBadge label={order.statusLabel} tone={order.statusTone} />
      </View>
      <Text style={styles.eventMeta}>{order.paidAtLabel}</Text>
      <Text style={styles.tdStrong}>
        {order.ticketCount} tickets · {order.ticketTypeSummary}
      </Text>
      <View style={styles.metricGrid}>
        <MetricChip label="Ticket subtotal" value={order.ticketSubtotalLabel} />
        <MetricChip label="808Tickets service fee" value={order.platformFeeLabel} />
        <MetricChip label="Payment processing fee" value={order.processingFeeLabel} />
        <MetricChip label="Organizer net owed" value={order.organizerNetLabel} accent />
      </View>
      <View style={styles.badgeRow}>
        {order.tickets.map((ticket) => (
          <Pressable
            key={ticket.secureToken}
            onPress={() => onOpenTicket?.(ticket.secureToken)}
            style={styles.ghostBtn}
          >
            <Text style={styles.ghostBtnText}>
              #{ticket.sequence} {ticket.ticketTypeLabel} · {ticket.statusLabel}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function EventAdminDashboardView({
  detail,
  orders,
  payouts,
  globalFees,
  organizerOverride,
  eventOverrideDraft,
  initialUseEventOverride = false,
  buyHref,
  scanHref,
  scanAvailable = Boolean(scanHref),
  scanUnavailableReason = null,
  chartSeries,
  chartLabels,
  chartYAxisLabels,
  topBanner,
  overviewTools,
  error,
  onBackToAdmin,
  onOpenTicket,
  onSetPayoutStatus,
  onSaveEventFees,
  savingFees = false,
  readOnly = false,
  footnote,
}: EventAdminDashboardViewProps) {
  const { width } = useWindowDimensions();
  const isCompact = width < 860;
  const [useEventOverride, setUseEventOverride] = useState(initialUseEventOverride);
  const [feeDraft, setFeeDraft] = useState<FeeDraft>(() => draftFromSlice(eventOverrideDraft));
  const [payoutNotes, setPayoutNotes] = useState<Record<string, string>>(() =>
    Object.fromEntries(payouts.map((payout) => [payout.payoutId, payout.notes])),
  );

  const openHref = (href?: string | null) => {
    if (!href) return;
    void Linking.openURL(href);
  };

  const runPayoutAction = (
    payout: EventAdminPayoutView,
    status: 'pending' | 'paid' | 'withheld',
  ) => {
    if (readOnly) return;
    onSetPayoutStatus?.({
      payoutId: payout.payoutId,
      status,
      notes: (payoutNotes[payout.payoutId] ?? payout.notes).trim(),
    });
  };

  const saveFees = () => {
    if (readOnly || !onSaveEventFees) return;
    onSaveEventFees({
      useEventOverride,
      fees: {
        platform_fee_bps: Number(feeDraft.platform_fee_bps),
        platform_fee_fixed_cents: Number(feeDraft.platform_fee_fixed_cents),
        processing_fee_bps: Number(feeDraft.processing_fee_bps),
        processing_fee_fixed_cents: Number(feeDraft.processing_fee_fixed_cents),
      },
    });
  };

  return (
    <DashboardShell>
      {topBanner}

      <View style={styles.breadcrumbRow}>
        <Pressable accessibilityRole="link" onPress={onBackToAdmin}>
          <Text style={styles.breadcrumbLink}>Admin</Text>
        </Pressable>
        <Text style={styles.breadcrumbSep}>/</Text>
        <Text style={styles.breadcrumbCurrent} numberOfLines={1}>
          {detail.eventName}
        </Text>
      </View>

      <View style={styles.titleBlock}>
        <Text style={styles.h1}>{detail.eventName}</Text>
        <Text style={styles.subtitle}>
          {detail.organizerName} · {detail.organizerEmail}
        </Text>
        <Text style={[styles.muted, { marginTop: 6 }]}>{detail.whenLabel}</Text>
        <Text style={styles.muted}>
          {detail.venueName}
          {detail.venueAddress ? ` · ${detail.venueAddress}` : ''}
        </Text>
        <View style={[styles.badgeRow, { marginTop: 10 }]}>
          <StatusBadge label={detail.statusLabel} tone={detail.statusTone} />
          <StatusBadge label={detail.buyabilityLabel} tone={detail.buyabilityTone} />
          <StatusBadge label={detail.salesLabel} tone={detail.salesTone} />
          <StatusBadge label={`Fee: ${detail.feeSourceLabel}`} tone="magenta" />
          <StatusBadge label={`Payouts: ${detail.payoutLabel}`} tone={detail.payoutTone} />
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <DashboardSectionHeader title="Overview" tools={overviewTools} />
      <View style={styles.kpiRow}>
        <KpiCard label="Gross ticket sales" value={detail.grossTicketSalesLabel} hint="Ticket subtotal" />
        <KpiCard label="Tickets sold" value={String(detail.ticketsSold)} />
        <KpiCard label="Orders" value={String(detail.orders)} />
        <KpiCard label="Checked in" value={String(detail.checkedIn)} />
        <KpiCard label="808Tickets service fee" value={detail.platformFeeLabel} />
        <KpiCard label="Payment processing fee" value={detail.processingFeeLabel} />
        <KpiCard label="Organizer net owed" value={detail.organizerNetLabel} />
        <KpiCard label="Pending payout" value={detail.pendingPayoutLabel} />
      </View>

      <View style={styles.midRow}>
        <TicketSalesChartCard
          series={chartSeries}
          labels={chartLabels}
          yAxisLabels={chartYAxisLabels}
        />
        <View style={styles.summaryCard}>
          <DashboardSectionHeader title="Support tools" />
          <Text style={styles.muted}>
            Working ops actions only. Buy opens when the event is sellable; scanner is available to
            platform admins for any event.
          </Text>
          <View style={[styles.badgeRow, { marginTop: 8 }]}>
            <StatusBadge
              label={detail.isBuyable ? 'Buy page available' : detail.buyabilityLabel}
              tone={detail.buyabilityTone}
            />
            <StatusBadge
              label={scanAvailable ? 'Scanner available' : 'Scanner unavailable'}
              tone={scanAvailable ? 'positive' : 'warn'}
            />
          </View>
          <View style={styles.actionRow}>
            {detail.isBuyable && buyHref ? (
              <GhostButton label="Open buy page" onPress={() => openHref(buyHref)} />
            ) : (
              <GhostButton
                label={`Buy unavailable · ${detail.buyabilityLabel}`}
                onPress={() => undefined}
                disabled
              />
            )}
            {scanAvailable && scanHref ? (
              <GhostButton label="Open scanner" onPress={() => openHref(scanHref)} />
            ) : (
              <GhostButton
                label={`Scanner unavailable${scanUnavailableReason ? ` · ${scanUnavailableReason}` : ''}`}
                onPress={() => undefined}
                disabled
              />
            )}
          </View>
          <Text style={[styles.muted, { marginTop: 8, color: dash.textDim }]}>
            Active ticket types: {detail.activeTicketTypeCount}
            {detail.ticketQuantityAvailable === null
              ? ' · Remaining capacity: unlimited'
              : ` · Remaining capacity: ${detail.ticketQuantityAvailable}`}
            {' · '}
            Sales: {detail.salesLabel} · Mode: {detail.ticketingModeLabel} · Status:{' '}
            {detail.statusLabel}.
          </Text>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <DashboardSectionHeader title="Orders / tickets" />
        <Text style={styles.muted}>
          Stored order snapshots · 808Tickets service fee and Payment processing fee are not recalculated.
        </Text>
        {orders.length === 0 ? (
          <EmptyState title="No orders yet" body="Paid and issued tickets for this event appear here." />
        ) : isCompact ? (
          <View style={styles.mobileCards}>
            {orders.map((order) => (
              <OrderCard key={order.orderId} order={order} onOpenTicket={onOpenTicket} />
            ))}
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {orders.map((order) => (
              <OrderCard key={order.orderId} order={order} onOpenTicket={onOpenTicket} />
            ))}
          </View>
        )}
      </View>

      <View style={styles.midRow}>
        <View style={[styles.sectionCard, { flexGrow: 1, flexBasis: 320, minWidth: 280 }]}>
          <DashboardSectionHeader title="Payout" />
          {payouts.length === 0 ? (
            <EmptyState title="No payout row" body="Payout visibility appears once organizer net is tracked." />
          ) : (
            <View style={{ gap: 16 }}>
              {payouts.map((payout) => (
                <View key={payout.payoutId} style={{ gap: 10 }}>
                  <View style={styles.feeGrid}>
                    <InfoField label="Organizer net owed" value={payout.amountLabel} />
                    <InfoField label="Status" value={payout.statusLabel} />
                    <InfoField label="Paid at" value={payout.paidAtLabel ?? '—'} />
                  </View>
                  <Text style={styles.fieldLabel}>Notes</Text>
                  <TextInput
                    value={payoutNotes[payout.payoutId] ?? payout.notes}
                    onChangeText={(value) =>
                      setPayoutNotes((prev) => ({ ...prev, [payout.payoutId]: value }))
                    }
                    editable={!readOnly}
                    multiline
                    placeholderTextColor={dash.textDim}
                    style={[styles.input, { minHeight: 72 }]}
                  />
                  <View style={styles.actionRow}>
                    <Pressable
                      style={[styles.primaryBtn, readOnly && styles.disabled]}
                      disabled={readOnly}
                      onPress={() => runPayoutAction(payout, 'paid')}
                    >
                      <Text style={styles.primaryBtnText}>Mark paid</Text>
                    </Pressable>
                    <GhostButton
                      label="Mark withheld"
                      onPress={() => runPayoutAction(payout, 'withheld')}
                      disabled={readOnly}
                    />
                    <GhostButton
                      label="Return pending"
                      onPress={() => runPayoutAction(payout, 'pending')}
                      disabled={readOnly}
                    />
                    <GhostButton
                      label="Save notes"
                      onPress={() =>
                        runPayoutAction(
                          payout,
                          payout.statusValue === 'paid' ||
                            payout.statusValue === 'withheld' ||
                            payout.statusValue === 'pending'
                            ? payout.statusValue
                            : 'pending',
                        )
                      }
                      disabled={readOnly}
                    />
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={[styles.sectionCard, { flexGrow: 1, flexBasis: 320, minWidth: 280 }]}>
          <DashboardSectionHeader title="Monetization" />
          <Text style={styles.muted}>
            Effective fee source: {detail.feeSourceLabel}. Existing orders are not recalculated. Changes
            affect new orders only.
          </Text>
          <InfoField label="Global default" value={formatFeeSlice(globalFees)} />
          <InfoField
            label="Organizer override"
            value={organizerOverride ? formatFeeSlice(organizerOverride) : 'None'}
          />
          <View style={styles.toggleRow}>
            <Pressable
              style={!useEventOverride ? styles.toggleActive : styles.toggleIdle}
              onPress={() => setUseEventOverride(false)}
              disabled={readOnly}
            >
              <Text style={!useEventOverride ? styles.toggleActiveText : styles.toggleIdleText}>
                Use global/organizer effective
              </Text>
            </Pressable>
            <Pressable
              style={useEventOverride ? styles.toggleActive : styles.toggleIdle}
              onPress={() => setUseEventOverride(true)}
              disabled={readOnly}
            >
              <Text style={useEventOverride ? styles.toggleActiveText : styles.toggleIdleText}>
                Use event-specific override
              </Text>
            </Pressable>
          </View>
          <View style={styles.feeGrid}>
            {(
              [
                ['platform_fee_bps', '808Tickets service fee bps'],
                ['platform_fee_fixed_cents', '808Tickets service fee fixed ¢ / ticket'],
                ['processing_fee_bps', 'Payment processing fee bps'],
                ['processing_fee_fixed_cents', 'Payment processing fee fixed ¢'],
              ] as const
            ).map(([key, label]) => (
              <View key={key} style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>{label}</Text>
                <TextInput
                  value={feeDraft[key]}
                  editable={!readOnly && useEventOverride}
                  onChangeText={(value) => setFeeDraft((prev) => ({ ...prev, [key]: value }))}
                  keyboardType="number-pad"
                  placeholderTextColor={dash.textDim}
                  style={[styles.input, (!useEventOverride || readOnly) && styles.disabled]}
                />
              </View>
            ))}
          </View>
          {!useEventOverride && !readOnly ? (
            <Text style={[styles.muted, { color: dash.textDim }]}>
              Saving with “Use global/organizer effective” turns off the event override flag. Stored
              event fee columns are kept but unused.
            </Text>
          ) : null}
          <Pressable
            style={[
              styles.primaryBtn,
              (readOnly || savingFees) && styles.disabled,
              { marginTop: 4 },
            ]}
            disabled={readOnly || savingFees}
            onPress={saveFees}
          >
            <Text style={styles.primaryBtnText}>
              {savingFees ? 'Saving…' : 'Save event fee settings'}
            </Text>
          </Pressable>
        </View>
      </View>

      {footnote ? (
        <Text style={[styles.muted, { textAlign: 'center', color: dash.textDim, marginTop: 8 }]}>
          {footnote}
        </Text>
      ) : null}
    </DashboardShell>
  );
}
