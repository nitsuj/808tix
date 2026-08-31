import { Pressable, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import {
  PROTOTYPE_CHART_LABELS,
  PROTOTYPE_CHART_SERIES,
  type PrototypeRange,
} from '@/components/design-prototype/prototype-data';
import { proto, prototypeStyles as styles } from '@/components/design-prototype/prototype-styles';

function buildAreaPath(values: number[], width: number, height: number): { line: string; area: string } {
  if (values.length === 0) {
    return { line: '', area: '' };
  }
  const step = width / Math.max(values.length - 1, 1);
  const points = values.map((value, index) => {
    const x = index * step;
    const y = height - value * (height - 8) - 4;
    return { x, y };
  });

  let line = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const curr = points[i];
    const cx = (prev.x + curr.x) / 2;
    line += ` C ${cx} ${prev.y}, ${cx} ${curr.y}, ${curr.x} ${curr.y}`;
  }

  const area = `${line} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;
  return { line, area };
}

export function PrototypeChartCard({
  range,
  onRangeChange,
}: {
  range: PrototypeRange;
  onRangeChange: (next: PrototypeRange) => void;
}) {
  const width = 640;
  const height = 200;
  const series = PROTOTYPE_CHART_SERIES[range];
  const labels = PROTOTYPE_CHART_LABELS[range];
  const { line, area } = buildAreaPath(series, width, height);
  const xLabels = labels.filter((_, index) => index % Math.ceil(labels.length / 8) === 0);

  return (
    <View style={styles.chartCard}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>GMV Over Time</Text>
        <View style={styles.rangeRow}>
          {(['daily', 'weekly', 'monthly'] as const).map((option) => {
            const active = option === range;
            return (
              <Pressable
                key={option}
                onPress={() => onRangeChange(option)}
                style={[styles.rangeChip, active && styles.rangeChipActive]}
              >
                <Text style={[styles.rangeChipText, active && styles.rangeChipTextActive]}>
                  {option.charAt(0).toUpperCase() + option.slice(1)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.chartWrap}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = height - ratio * (height - 8) - 4;
            return (
              <Path
                key={ratio}
                d={`M 0 ${y} L ${width} ${y}`}
                stroke="rgba(255,255,255,0.06)"
                strokeWidth={1}
              />
            );
          })}
          <Defs>
            <LinearGradient id="gmvFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={proto.magenta} stopOpacity={0.45} />
              <Stop offset="100%" stopColor={proto.magenta} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Path d={area} fill="url(#gmvFill)" />
          <Path
            d={line}
            fill="none"
            stroke={proto.magenta}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </View>

      <View style={styles.axisRow}>
        {xLabels.map((label) => (
          <Text key={label} style={styles.axisLabel}>
            {label}
          </Text>
        ))}
      </View>
      <View style={[styles.axisRow, { marginTop: 2 }]}>
        <Text style={styles.axisLabel}>$0</Text>
        <Text style={styles.axisLabel}>$20K</Text>
        <Text style={styles.axisLabel}>$40K</Text>
      </View>
    </View>
  );
}
