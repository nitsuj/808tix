import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import {
  PrototypeBadge,
  statusLabel,
  statusTone,
} from '@/components/design-prototype/prototype-badge';
import {
  PROTOTYPE_EVENT_DETAIL,
  PROTOTYPE_EVENT_ORDERS,
  PROTOTYPE_EVENT_PAYOUTS,
} from '@/components/design-prototype/prototype-data';
import { PrototypeMetricCard } from '@/components/design-prototype/prototype-metric-card';
import { proto, prototypeStyles as styles } from '@/components/design-prototype/prototype-styles';

function formatMoney(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

function formatCount(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

function MiniMetric({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <View style={styles.metricMini}>
      <Text style={styles.metricMiniLabel}>{label}</Text>
      <Text style={[styles.metricMiniValue, emphasis ? { color: proto.green } : null]}>{value}</Text>
    </View>
  );
}

export function PrototypeEventDetailShell() {
  const router = useRouter();
  const event = PROTOTYPE_EVENT_DETAIL;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.page}>
          <View style={styles.breadcrumbRow}>
            <Pressable onPress={() => router.push('/design/admin-dashboard-prototype' as never)}>
              <Text style={styles.breadcrumbLink}>Admin</Text>
            </Pressable>
            <Text style={styles.breadcrumbSep}>/</Text>
            <Text style={styles.breadcrumbCurrent} numberOfLines={1}>
              {event.name}
            </Text>
          </View>

          <View style={styles.heroCard}>
            <View style={styles.heroTop}>
              <View style={[styles.heroThumb, { backgroundColor: event.thumbHue }]} />
              <View style={styles.heroBody}>
                <Text style={styles.heroTitle}>{event.name}</Text>
                <View style={styles.badgeRow}>
                  <PrototypeBadge label={statusLabel(event.status)} tone={statusTone(event.status)} />
                  <PrototypeBadge label={event.salesLabel} tone="neutral" />
                  <PrototypeBadge label={`Fee: ${event.feeSource}`} tone="fee" />
                </View>
              </View>
            </View>

            <View style={styles.fieldGrid}>
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>Organizer</Text>
                <Text style={styles.fieldValue}>
                  {event.organizer}
                  {'\n'}
                  {event.organizerEmail}
                </Text>
              </View>
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>Date & time</Text>
                <Text style={styles.fieldValue}>{event.dateLabel}</Text>
              </View>
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>Venue</Text>
                <Text style={styles.fieldValue}>{event.venue}</Text>
              </View>
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>Ticketing</Text>
                <Text style={styles.fieldValue}>{event.ticketingMode}</Text>
              </View>
            </View>

            <View style={styles.actionRow}>
              <View style={styles.primaryBtn}>
                <Text style={styles.primaryBtnText}>Buy page</Text>
              </View>
              <View style={styles.ghostBtn}>
                <Text style={styles.ghostBtnText}>Scanner</Text>
              </View>
              <View style={styles.ghostBtn}>
                <Text style={styles.ghostBtnText}>Copy event ID</Text>
              </View>
            </View>
            <Text style={[styles.axisLabel, { color: proto.textDim }]}>{event.supportNote}</Text>
          </View>

          <View style={styles.kpiRow}>
            <PrototypeMetricCard
              label="Orders"
              value={formatCount(event.orders)}
              trend="Paid orders"
              tone="magenta"
              spark={[8, 10, 12, 14, 16, 18, 20, 19, 22, 24]}
            />
            <PrototypeMetricCard
              label="Tickets"
              value={formatCount(event.tickets)}
              trend={`Scan rate ${event.scanRate}`}
              tone="purple"
              spark={[10, 12, 14, 15, 18, 20, 22, 24, 26, 28]}
            />
            <PrototypeMetricCard
              label="Checked in"
              value={formatCount(event.checkedIn)}
              trend="Door activity"
              tone="green"
              spark={[2, 4, 6, 8, 10, 12, 14, 16, 18, 20]}
            />
            <PrototypeMetricCard
              label="Gross sales"
              value={formatMoney(event.grossCents)}
              trend="Ticket subtotal"
              tone="violet"
              spark={[12, 14, 16, 18, 20, 22, 24, 26, 28, 30]}
            />
            <PrototypeMetricCard
              label="808Tickets service fee"
              value={formatMoney(event.serviceFeeCents)}
              trend="Platform take"
              tone="rose"
              spark={[4, 5, 5, 6, 7, 7, 8, 8, 9, 9]}
            />
            <PrototypeMetricCard
              label="Organizer net"
              value={formatMoney(event.organizerNetCents)}
              trend="Owed after fees"
              tone="green"
              spark={[10, 12, 14, 16, 18, 20, 22, 24, 26, 28]}
            />
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Monetization</Text>
            <Text style={styles.subtitle}>
              Existing orders are not recalculated. Changes affect new orders only.
            </Text>
            <View style={styles.fieldGrid}>
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>Effective source</Text>
                <Text style={styles.fieldValue}>{event.effectiveFeeSource}</Text>
              </View>
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>Effective rates</Text>
                <Text style={styles.fieldValue}>{event.monetization.effective}</Text>
              </View>
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>Global defaults</Text>
                <Text style={styles.fieldValue}>{event.monetization.global}</Text>
              </View>
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>Organizer override</Text>
                <Text style={styles.fieldValue}>{event.monetization.organizerOverride}</Text>
              </View>
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>Event override</Text>
                <Text style={styles.fieldValue}>{event.monetization.eventOverride}</Text>
              </View>
            </View>
            <View style={styles.actionRow}>
              <View style={[styles.rangeChip, styles.rangeChipActive]}>
                <Text style={[styles.rangeChipText, styles.rangeChipTextActive]}>
                  Use global/organizer effective
                </Text>
              </View>
              <View style={styles.rangeChip}>
                <Text style={styles.rangeChipText}>Use event-specific override</Text>
              </View>
            </View>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Orders / tickets</Text>
            {PROTOTYPE_EVENT_ORDERS.map((order) => (
              <View key={order.id} style={styles.orderCard}>
                <View style={styles.badgeRow}>
                  <PrototypeBadge
                    label={order.status === 'paid' ? 'Paid' : 'Pending'}
                    tone={order.status === 'paid' ? 'on_sale' : 'draft'}
                  />
                  <PrototypeBadge label={`Fee: ${order.feeSource}`} tone="fee" />
                </View>
                <Text style={styles.tdStrong}>{order.buyer}</Text>
                <Text style={styles.td}>Paid {order.paidAt}</Text>
                <View style={styles.metricMiniGrid}>
                  <MiniMetric label="Tickets" value={String(order.tickets)} />
                  <MiniMetric label="Subtotal" value={formatMoney(order.subtotalCents)} />
                  <MiniMetric label="808Tickets service fee" value={formatMoney(order.serviceFeeCents)} />
                  <MiniMetric
                    label="Payment processing fee"
                    value={formatMoney(order.processingFeeCents)}
                  />
                  <MiniMetric label="Organizer net" value={formatMoney(order.netCents)} emphasis />
                </View>
                <View style={styles.actionRow}>
                  <View style={styles.ghostBtn}>
                    <Text style={styles.ghostBtnText}>Ticket 1</Text>
                  </View>
                  <View style={styles.ghostBtn}>
                    <Text style={styles.ghostBtnText}>Ticket 2</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Payouts</Text>
            {PROTOTYPE_EVENT_PAYOUTS.map((payout) => (
              <View key={payout.id} style={styles.orderCard}>
                <View style={styles.badgeRow}>
                  <PrototypeBadge
                    label={payout.status === 'paid' ? 'Paid' : 'Pending'}
                    tone={payout.status === 'paid' ? 'on_sale' : 'sales_ended'}
                  />
                </View>
                <Text style={styles.tdStrong}>{formatMoney(payout.amountCents)}</Text>
                <Text style={styles.td}>
                  Net {formatMoney(payout.netCents)} · Paid at {payout.paidAt}
                </Text>
                <Text style={styles.td}>{payout.notes}</Text>
                <View style={styles.actionRow}>
                  <View style={styles.ghostBtn}>
                    <Text style={styles.ghostBtnText}>Mark paid</Text>
                  </View>
                  <View style={styles.ghostBtn}>
                    <Text style={styles.ghostBtnText}>Mark withheld</Text>
                  </View>
                  <View style={styles.ghostBtn}>
                    <Text style={styles.ghostBtnText}>Return pending</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>

          <Text style={styles.protoNote}>
            Design prototype · static event detail · not connected to production admin RPCs
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
