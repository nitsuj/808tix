import { Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { PROTOTYPE_REVENUE_SPLIT } from '@/components/design-prototype/prototype-data';
import { proto, prototypeStyles as styles } from '@/components/design-prototype/prototype-styles';

function Donut() {
  const size = 120;
  const stroke = 16;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const slices = PROTOTYPE_REVENUE_SPLIT.reduce<
    { id: string; color: string; length: number; dashoffset: number }[]
  >((acc, slice) => {
    const length = circumference * slice.share;
    const priorLength = acc.reduce((sum, item) => sum + item.length, 0);
    acc.push({
      id: slice.id,
      color: slice.color,
      length,
      dashoffset: -priorLength,
    });
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
      {slices.map((slice) => (
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
      ))}
    </Svg>
  );
}

export function PrototypeRevenueCard() {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.sectionTitle}>Revenue allocation</Text>
      <Text style={[styles.subtitle, { marginTop: 4, marginBottom: 10 }]}>
        Snapshot of fees vs organizer net for the selected range.
      </Text>
      <View style={styles.splitRow}>
        <Donut />
        <View style={styles.splitLegend}>
          {PROTOTYPE_REVENUE_SPLIT.map((slice) => (
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
      <Text style={[styles.axisLabel, { marginTop: 12, color: proto.textDim }]}>
        Prototype only · labels use exact fee names
      </Text>
    </View>
  );
}
