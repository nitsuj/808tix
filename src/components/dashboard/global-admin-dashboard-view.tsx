import type { ReactNode } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import { DashboardSectionHeader } from '@/components/dashboard/dashboard-section-header';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { dashboardStyles as styles } from '@/components/dashboard/dashboard-styles';
import { dash } from '@/components/dashboard/dashboard-tokens';
import { DashboardEventList, type DashboardEventRow } from '@/components/dashboard/event-list';
import { InfoField } from '@/components/dashboard/info-field';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { RevenueAllocationCard } from '@/components/dashboard/revenue-allocation-card';
import { TicketSalesChartCard } from '@/components/dashboard/ticket-sales-chart-card';
import { formatAdminCents } from '@/lib/admin-support';

export type GlobalAdminSummary = {
  ticket_subtotal_cents: number;
  paid_tickets_issued_count: number;
  checked_in_count: number;
  pending_payout_count: number;
  platform_fee_cents: number;
  organizer_net_cents: number;
  processing_fee_cents: number;
};

export type GlobalAdminMonetization = {
  precedence: readonly string[] | string[];
  platform_fee_bps: number;
  platform_fee_fixed_cents: number;
  processing_fee_bps: number;
  processing_fee_fixed_cents: number;
};

type FeeDraftKey =
  | 'platform_fee_bps'
  | 'platform_fee_fixed_cents'
  | 'processing_fee_bps'
  | 'processing_fee_fixed_cents';

const FEE_FIELDS: readonly { key: FeeDraftKey; label: string }[] = [
  { key: 'platform_fee_bps', label: '808Tickets service fee bps' },
  { key: 'platform_fee_fixed_cents', label: '808Tickets service fee fixed ¢ / ticket' },
  { key: 'processing_fee_bps', label: 'Payment processing fee bps' },
  { key: 'processing_fee_fixed_cents', label: 'Payment processing fee fixed ¢' },
];

export type GlobalAdminDashboardViewProps = {
  summary: GlobalAdminSummary;
  events: DashboardEventRow[];
  monetization: GlobalAdminMonetization;
  onOpenEvent: (eventId: string) => void;
  onExportCsv?: () => void;
  overviewTools?: ReactNode;
  topBanner?: ReactNode;
  error?: string | null;
  chartSeries?: readonly number[];
  chartLabels?: readonly string[];
  chartYAxisLabels?: readonly [string, string, string];
  monetizationEditable?: boolean;
  feeDraft?: Record<FeeDraftKey, string>;
  onFeeDraftChange?: (key: FeeDraftKey, value: string) => void;
  onSaveFees?: () => void;
  savingFees?: boolean;
  monetizationFootnote?: string;
};

export function GlobalAdminDashboardView({
  summary,
  events,
  monetization,
  onOpenEvent,
  onExportCsv,
  overviewTools,
  topBanner,
  error,
  chartSeries,
  chartLabels,
  chartYAxisLabels,
  monetizationEditable = false,
  feeDraft,
  onFeeDraftChange,
  onSaveFees,
  savingFees = false,
  monetizationFootnote,
}: GlobalAdminDashboardViewProps) {
  return (
    <DashboardShell>
      {topBanner}

      <DashboardHeader
        title="808Tickets Admin"
        subtitle="Platform operations, event performance, and payout visibility."
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <DashboardSectionHeader title="Overview" tools={overviewTools} />

      <View style={styles.kpiRow}>
        <KpiCard
          label="Gross ticket sales"
          value={formatAdminCents(summary.ticket_subtotal_cents)}
          hint="Ticket subtotal from paid orders"
        />
        <KpiCard label="Tickets sold" value={String(summary.paid_tickets_issued_count)} />
        <KpiCard label="Checked in" value={String(summary.checked_in_count)} />
        <KpiCard label="Pending payouts" value={String(summary.pending_payout_count)} />
        <KpiCard
          label="808Tickets service fee revenue"
          value={formatAdminCents(summary.platform_fee_cents)}
        />
        <KpiCard label="Organizer net owed" value={formatAdminCents(summary.organizer_net_cents)} />
      </View>

      <View style={styles.midRow}>
        <TicketSalesChartCard
          series={chartSeries}
          labels={chartLabels}
          yAxisLabels={chartYAxisLabels}
        />
        <RevenueAllocationCard
          organizerNetCents={summary.organizer_net_cents}
          platformFeeCents={summary.platform_fee_cents}
          processingFeeCents={summary.processing_fee_cents}
          formatCents={formatAdminCents}
        />
      </View>

      <DashboardEventList events={events} onOpenEvent={onOpenEvent} onExportCsv={onExportCsv} />

      <View style={styles.sectionCard}>
        <DashboardSectionHeader title="Global monetization" />
        <Text style={styles.muted}>
          Precedence: {monetization.precedence.join(' → ')}. Changing global fees does not
          recalculate existing orders. Event-level custom fees are edited on each event admin page.
        </Text>

        {monetizationEditable && feeDraft && onFeeDraftChange ? (
          <View style={styles.feeGrid}>
            {FEE_FIELDS.map(({ key, label }) => (
              <View key={key} style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>{label}</Text>
                <TextInput
                  value={feeDraft[key]}
                  onChangeText={(value) => onFeeDraftChange(key, value)}
                  keyboardType="number-pad"
                  placeholderTextColor={dash.textDim}
                  style={styles.input}
                />
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.feeGrid}>
            <InfoField label="808Tickets service fee bps" value={String(monetization.platform_fee_bps)} />
            <InfoField
              label="808Tickets service fee fixed ¢ / ticket"
              value={String(monetization.platform_fee_fixed_cents)}
            />
            <InfoField label="Payment processing fee bps" value={String(monetization.processing_fee_bps)} />
            <InfoField
              label="Payment processing fee fixed ¢"
              value={String(monetization.processing_fee_fixed_cents)}
            />
          </View>
        )}

        {monetizationEditable && onSaveFees ? (
          <Pressable
            style={[styles.primaryBtn, savingFees && styles.disabled, { marginTop: 12 }]}
            disabled={savingFees}
            onPress={onSaveFees}
          >
            <Text style={styles.primaryBtnText}>{savingFees ? 'Saving…' : 'Save global fees'}</Text>
          </Pressable>
        ) : null}

        {monetizationFootnote ? (
          <Text style={[styles.muted, { marginTop: 8, color: dash.textDim }]}>{monetizationFootnote}</Text>
        ) : null}
      </View>
    </DashboardShell>
  );
}
