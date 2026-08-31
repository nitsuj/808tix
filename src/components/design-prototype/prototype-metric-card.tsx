import { Text, View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';

import { proto, prototypeStyles as styles } from '@/components/design-prototype/prototype-styles';

const TONE_BG: Record<string, string> = {
  magenta: proto.magentaSoft,
  purple: 'rgba(162,91,255,0.16)',
  rose: 'rgba(255,92,138,0.16)',
  green: proto.greenSoft,
  violet: proto.blueSoft,
};

const TONE_FG: Record<string, string> = {
  magenta: proto.magenta,
  purple: proto.purple,
  rose: proto.rose,
  green: proto.green,
  violet: proto.violet,
};

function Sparkline({ values, color }: { values: readonly number[]; color: string }) {
  const width = 72;
  const height = 24;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 1);
  const points = values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width;
      const y = height - ((value - min) / span) * (height - 2) - 1;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <Svg width={width} height={height}>
      <Polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function PrototypeMetricCard({
  label,
  value,
  trend,
  tone,
  spark,
}: {
  label: string;
  value: string;
  trend: string;
  tone: keyof typeof TONE_BG;
  spark: readonly number[];
}) {
  const fg = TONE_FG[tone] ?? proto.magenta;
  return (
    <View style={styles.kpiCard}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={[styles.kpiIcon, { backgroundColor: TONE_BG[tone] ?? proto.magentaSoft }]}>
          <Text style={[styles.kpiIconText, { color: fg }]}>●</Text>
        </View>
        <Sparkline values={spark} color={fg} />
      </View>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiTrend}>{trend}</Text>
    </View>
  );
}
