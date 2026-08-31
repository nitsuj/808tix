import { Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { dash } from '@/components/dashboard/dashboard-tokens';
import { dashboardStyles as styles } from '@/components/dashboard/dashboard-styles';
import { EmptyState } from '@/components/dashboard/empty-state';

type RevenueSlice = {
  id: string;
  label: string;
  value: string;
  cents: number;
  color: string;
};

function Donut({ slices }: { slices: RevenueSlice[] }) {
  const size = 120;
  const stroke = 16;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = slices.reduce((sum, slice) => sum + slice.cents, 0);

  const arcs = slices.reduce<
    { id: string; color: string; length: number; dashoffset: number }[]
  >((acc, slice) => {
    const length = total > 0 ? circumference * (slice.cents / total) : 0;
    const priorLength = acc.reduce((sum, item) => sum + item.length, 0);
    acc.push({ id: slice.id, color: slice.color, length, dashoffset: -priorLength });
    return acc;
  }, []);

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={stroke}
        fill="none"
      />
      {arcs.map((slice) =>
        slice.length > 0 ? (
          <Circle
            key={slice.id}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={slice.color}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={`${slice.length} ${circumference - slice.length}`}
            strokeDashoffset={slice.dashoffset}
            strokeLinecap="butt"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ) : null,
      )}
    </Svg>
  );
}

type RevenueAllocationCardProps = {
  organizerNetCents: number;
  platformFeeCents: number;
  processingFeeCents: number;
  formatCents: (cents: number | null | undefined) => string;
};

export function RevenueAllocationCard({
  organizerNetCents,
  platformFeeCents,
  processingFeeCents,
  formatCents,
}: RevenueAllocationCardProps) {
  const slices: RevenueSlice[] = [
    {
      id: 'organizer',
      label: 'Organizer net owed',
      value: formatCents(organizerNetCents),
      cents: organizerNetCents,
      color: dash.green,
    },
    {
      id: 'platform',
      label: '808Tickets service fee',
      value: formatCents(platformFeeCents),
      cents: platformFeeCents,
      color: dash.magenta,
    },
    {
      id: 'processing',
      label: 'Payment processing fee',
      value: formatCents(processingFeeCents),
      cents: processingFeeCents,
      color: dash.violet,
    },
  ];

  const total = organizerNetCents + platformFeeCents + processingFeeCents;

  return (
    <View style={styles.summaryCard}>
      <Text style={styles.sectionTitle}>Revenue allocation</Text>
      <Text style={[styles.muted, { marginTop: 4, marginBottom: 8 }]}>
        Paid-order snapshot split across organizer net, platform service fee, and processing fees.
      </Text>
      {total <= 0 ? (
        <EmptyState title="No paid orders yet" body="Allocation appears once ticket sales are recorded." />
      ) : (
        <View style={styles.splitRow}>
          <Donut slices={slices} />
          <View style={styles.splitLegend}>
            {slices.map((slice) => (
              <View key={slice.id} style={styles.legendItem}>
                <View style={styles.legendTop}>
                  <View style={[styles.legendDot, { backgroundColor: slice.color }]} />
                  <Text style={styles.legendLabel}>{slice.label}</Text>
                </View>
                <Text style={styles.legendValue}>{slice.value}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}
