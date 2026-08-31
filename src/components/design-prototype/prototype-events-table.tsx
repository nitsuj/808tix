import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';

import {
  PrototypeBadge,
  statusLabel,
  statusTone,
} from '@/components/design-prototype/prototype-badge';
import { PROTOTYPE_EVENTS } from '@/components/design-prototype/prototype-data';
import { proto, prototypeStyles as styles } from '@/components/design-prototype/prototype-styles';

function formatMoney(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatCount(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

const COL = {
  event: { flex: 1.6, minWidth: 220 },
  date: { width: 150 },
  venue: { width: 130 },
  organizer: { width: 120 },
  orders: { width: 70 },
  tickets: { width: 70 },
  checkedIn: { width: 80 },
  gross: { width: 100 },
  service: { width: 110 },
  processing: { width: 110 },
  net: { width: 100 },
} as const;

export function PrototypeEventsTable() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isCompact = width < 860;
  const [query, setQuery] = useState('');

  const openEventDetail = () => {
    router.push('/design/admin-event-detail-prototype' as never);
  };

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return PROTOTYPE_EVENTS;
    return PROTOTYPE_EVENTS.filter(
      (event) =>
        event.name.toLowerCase().includes(q) ||
        event.venue.toLowerCase().includes(q) ||
        event.organizer.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <View style={styles.eventsCard}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Events</Text>
        <View style={styles.eventsTools}>
          <View style={[styles.searchBox, { maxWidth: 220 }]}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search events…"
              placeholderTextColor={proto.textDim}
              style={{ color: proto.text, fontSize: 13, padding: 0 }}
            />
          </View>
          <View style={styles.filterPill}>
            <Text style={styles.filterText}>All Statuses ▾</Text>
          </View>
          <View style={styles.filterPill}>
            <Text style={styles.filterText}>Date ▾</Text>
          </View>
          <View style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>+ New Event</Text>
          </View>
        </View>
      </View>

      {isCompact ? (
        <View style={styles.mobileCards}>
          {rows.map((event) => (
            <Pressable key={event.id} onPress={openEventDetail} style={styles.mobileEventCard}>
              <View style={styles.eventCell}>
                <View style={[styles.thumb, { backgroundColor: event.thumbHue }]} />
                <View style={styles.eventMeta}>
                  <Text style={styles.eventName}>{event.name}</Text>
                  <View style={styles.badgeRow}>
                    <PrototypeBadge label={statusLabel(event.status)} tone={statusTone(event.status)} />
                    <PrototypeBadge label={event.salesLabel} tone="neutral" />
                    <PrototypeBadge label={`Fee: ${event.feeSource}`} tone="fee" />
                  </View>
                </View>
              </View>
              <Text style={styles.td}>{event.dateLabel}</Text>
              <Text style={styles.td}>
                {event.venue} · {event.organizer}
              </Text>
              <Text style={styles.tdStrong}>
                {formatCount(event.orders)} orders · {formatCount(event.tickets)} tickets ·{' '}
                {formatCount(event.checkedIn)} checked in
              </Text>
              <Text style={styles.td}>
                Gross {formatMoney(event.grossCents)} · 808Tickets service fee{' '}
                {formatMoney(event.serviceFeeCents)} · Payment processing fee{' '}
                {formatMoney(event.processingFeeCents)}
              </Text>
              <Text style={styles.tdNet}>Organizer net {formatMoney(event.organizerNetCents)}</Text>
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
              <Text style={[styles.th, COL.organizer]}>Organizer</Text>
              <Text style={[styles.th, COL.orders]}>Orders</Text>
              <Text style={[styles.th, COL.tickets]}>Tickets</Text>
              <Text style={[styles.th, COL.checkedIn]}>Checked in</Text>
              <Text style={[styles.th, COL.gross]}>Gross</Text>
              <Text style={[styles.th, COL.service]}>Service fee</Text>
              <Text style={[styles.th, COL.processing]}>Processing</Text>
              <Text style={[styles.th, COL.net]}>Organizer net</Text>
            </View>
            {rows.map((event) => (
              <Pressable key={event.id} onPress={openEventDetail} style={styles.tr}>
                <View style={[styles.eventCell, COL.event]}>
                  <View style={[styles.thumb, { backgroundColor: event.thumbHue }]} />
                  <View style={styles.eventMeta}>
                    <Text style={styles.eventName} numberOfLines={1}>
                      {event.name}
                    </Text>
                    <View style={styles.badgeRow}>
                      <PrototypeBadge
                        label={statusLabel(event.status)}
                        tone={statusTone(event.status)}
                      />
                      <PrototypeBadge label={event.salesLabel} tone="neutral" />
                      <PrototypeBadge label={event.feeSource} tone="fee" />
                    </View>
                  </View>
                </View>
                <Text style={[styles.td, COL.date]}>{event.dateLabel}</Text>
                <Text style={[styles.td, COL.venue]} numberOfLines={1}>
                  {event.venue}
                </Text>
                <Text style={[styles.td, COL.organizer]} numberOfLines={1}>
                  {event.organizer}
                </Text>
                <Text style={[styles.tdStrong, COL.orders]}>{formatCount(event.orders)}</Text>
                <Text style={[styles.tdStrong, COL.tickets]}>{formatCount(event.tickets)}</Text>
                <Text style={[styles.tdStrong, COL.checkedIn]}>{formatCount(event.checkedIn)}</Text>
                <Text style={[styles.tdStrong, COL.gross]}>{formatMoney(event.grossCents)}</Text>
                <Text style={[styles.td, COL.service]}>{formatMoney(event.serviceFeeCents)}</Text>
                <Text style={[styles.td, COL.processing]}>
                  {formatMoney(event.processingFeeCents)}
                </Text>
                <Text style={[styles.tdNet, COL.net]}>{formatMoney(event.organizerNetCents)}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      )}

      <View style={styles.footerRow}>
        <Text style={styles.footerText}>Showing 1 to {rows.length} of 42 events</Text>
        <View style={styles.pageRow}>
          {[1, 2, 3, 9].map((page, index) => (
            <View key={page} style={[styles.pageBtn, index === 0 && styles.pageBtnActive]}>
              <Text style={[styles.pageBtnText, index === 0 && styles.pageBtnTextActive]}>
                {page === 9 && index === 3 ? '…9' : String(page)}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}
