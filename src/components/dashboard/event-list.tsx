import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, TextInput, useWindowDimensions, View } from 'react-native';

import { DashboardSectionHeader } from '@/components/dashboard/dashboard-section-header';
import { EmptyState } from '@/components/dashboard/empty-state';
import { GhostButton } from '@/components/dashboard/ghost-button';
import { MetricChip } from '@/components/dashboard/metric-chip';
import { StatusBadge, type StatusBadgeTone } from '@/components/dashboard/status-badge';
import { dash } from '@/components/dashboard/dashboard-tokens';
import { dashboardStyles as styles } from '@/components/dashboard/dashboard-styles';

export type DashboardEventRow = {
  eventId: string;
  eventName: string;
  whenLabel: string;
  venueName: string | null;
  organizerEmail: string | null;
  statusLabel: string;
  statusTone: StatusBadgeTone;
  salesLabel: string;
  salesTone: StatusBadgeTone;
  feeSourceLabel: string;
  payoutLabel: string;
  paidOrderCount: number;
  paidTicketCount: number;
  checkedInCount: number;
  ticketSubtotalLabel: string;
  platformFeeLabel: string;
  processingFeeLabel: string;
  organizerNetLabel: string;
};

type DashboardEventListProps = {
  events: DashboardEventRow[];
  onOpenEvent: (eventId: string) => void;
  onExportCsv?: () => void;
};

const COL = {
  event: { flex: 1.6, minWidth: 220 },
  date: { width: 150 },
  venue: { width: 130 },
  orders: { width: 70 },
  tickets: { width: 70 },
  checkedIn: { width: 80 },
  gross: { width: 100 },
  service: { width: 110 },
  processing: { width: 110 },
  net: { width: 100 },
} as const;

export function DashboardEventList({ events, onOpenEvent, onExportCsv }: DashboardEventListProps) {
  const { width } = useWindowDimensions();
  const isCompact = width < 860;
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return events;
    return events.filter(
      (event) =>
        event.eventName.toLowerCase().includes(q) ||
        (event.venueName?.toLowerCase().includes(q) ?? false) ||
        (event.organizerEmail?.toLowerCase().includes(q) ?? false),
    );
  }, [events, query]);

  const tools = (
    <>
      <View style={styles.searchBox}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search events…"
          placeholderTextColor={dash.textDim}
          style={styles.searchInput}
        />
      </View>
      {onExportCsv ? <GhostButton label="Export CSV" onPress={onExportCsv} /> : null}
    </>
  );

  return (
    <View style={styles.sectionCard}>
      <DashboardSectionHeader title="Events" tools={tools} />
      <Text style={styles.muted}>
        Open an event for orders, payouts, scanner/buy links, and fee overrides.
      </Text>

      {rows.length === 0 ? (
        <EmptyState title="No events match" body="Try a different search or create an event as an organizer." />
      ) : isCompact ? (
        <View style={styles.mobileCards}>
          {rows.map((event) => (
            <Pressable
              key={event.eventId}
              accessibilityRole="link"
              onPress={() => onOpenEvent(event.eventId)}
              style={styles.mobileEventCard}
            >
              <Text style={styles.eventNameLink}>{event.eventName}</Text>
              <Text style={styles.eventMeta}>{event.whenLabel}</Text>
              {event.venueName?.trim() ? (
                <Text style={styles.eventMeta}>{event.venueName.trim()}</Text>
              ) : null}
              {event.organizerEmail?.trim() ? (
                <Text style={styles.eventMeta}>Organizer · {event.organizerEmail.trim()}</Text>
              ) : null}
              <View style={styles.badgeRow}>
                <StatusBadge label={event.statusLabel} tone={event.statusTone} />
                <StatusBadge label={event.salesLabel} tone={event.salesTone} />
                <StatusBadge label={`Fee: ${event.feeSourceLabel}`} tone="magenta" />
                <StatusBadge label={`Payouts: ${event.payoutLabel}`} tone="neutral" />
              </View>
              <View style={styles.metricGrid}>
                <MetricChip label="Orders" value={String(event.paidOrderCount)} />
                <MetricChip label="Tickets sold" value={String(event.paidTicketCount)} />
                <MetricChip label="Checked in" value={String(event.checkedInCount)} />
                <MetricChip label="Gross ticket sales" value={event.ticketSubtotalLabel} />
                <MetricChip label="808Tickets service fee" value={event.platformFeeLabel} />
                <MetricChip label="Payment processing fee" value={event.processingFeeLabel} />
                <MetricChip label="Organizer net owed" value={event.organizerNetLabel} accent />
              </View>
            </Pressable>
          ))}
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={Platform.OS === 'web'}>
          <View style={styles.tableMin}>
            <View style={styles.tableHead}>
              <Text style={[styles.th, COL.event]}>Event</Text>
              <Text style={[styles.th, COL.date]}>Date</Text>
              <Text style={[styles.th, COL.venue]}>Venue</Text>
              <Text style={[styles.th, COL.orders]}>Orders</Text>
              <Text style={[styles.th, COL.tickets]}>Tickets</Text>
              <Text style={[styles.th, COL.checkedIn]}>Checked in</Text>
              <Text style={[styles.th, COL.gross]}>Gross sales</Text>
              <Text style={[styles.th, COL.service]}>Service fee</Text>
              <Text style={[styles.th, COL.processing]}>Processing</Text>
              <Text style={[styles.th, COL.net]}>Organizer net</Text>
            </View>
            {rows.map((event) => (
              <Pressable
                key={event.eventId}
                accessibilityRole="link"
                onPress={() => onOpenEvent(event.eventId)}
                style={styles.tr}
              >
                <View style={[COL.event, { gap: 4 }]}>
                  <Text style={styles.tdStrong} numberOfLines={1}>{event.eventName}</Text>
                  <View style={styles.badgeRow}>
                    <StatusBadge label={event.statusLabel} tone={event.statusTone} />
                    <StatusBadge label={event.salesLabel} tone={event.salesTone} />
                    <StatusBadge label={event.feeSourceLabel} tone="magenta" />
                  </View>
                </View>
                <Text style={[styles.td, COL.date]}>{event.whenLabel}</Text>
                <Text style={[styles.td, COL.venue]} numberOfLines={1}>
                  {event.venueName?.trim() ?? '—'}
                </Text>
                <Text style={[styles.tdStrong, COL.orders]}>{event.paidOrderCount}</Text>
                <Text style={[styles.tdStrong, COL.tickets]}>{event.paidTicketCount}</Text>
                <Text style={[styles.tdStrong, COL.checkedIn]}>{event.checkedInCount}</Text>
                <Text style={[styles.tdStrong, COL.gross]}>{event.ticketSubtotalLabel}</Text>
                <Text style={[styles.td, COL.service]}>{event.platformFeeLabel}</Text>
                <Text style={[styles.td, COL.processing]}>{event.processingFeeLabel}</Text>
                <Text style={[styles.metricValueAccent, COL.net]}>{event.organizerNetLabel}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}
