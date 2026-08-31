import { Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { dash } from '@/components/dashboard/dashboard-tokens';

export function buildTicketSalesAreaPath(
  values: number[],
  width: number,
  height: number,
): { line: string; area: string } {
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

type TicketSalesAreaChartProps = {
  series: readonly number[];
  labels: readonly string[];
  width?: number;
  height?: number;
  yAxisLabels?: readonly [string, string, string];
};

export function TicketSalesAreaChart({
  series,
  labels,
  width = 640,
  height = 200,
  yAxisLabels = ['$0', '$10K', '$20K'],
}: TicketSalesAreaChartProps) {
  const { line, area } = buildTicketSalesAreaPath([...series], width, height);
  const xLabels = labels.filter((_, index) => index % Math.ceil(labels.length / 8) === 0);

  return (
    <View>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
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
          <LinearGradient id="ticketSalesFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={dash.magenta} stopOpacity={0.45} />
            <Stop offset="100%" stopColor={dash.magenta} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Path d={area} fill="url(#ticketSalesFill)" />
        <Path
          d={line}
          fill="none"
          stroke={dash.magenta}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
        {xLabels.map((label) => (
          <Text key={label} style={{ color: dash.textDim, fontSize: 11 }}>{label}</Text>
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
        {yAxisLabels.map((label) => (
          <Text key={label} style={{ color: dash.textDim, fontSize: 11 }}>{label}</Text>
        ))}
      </View>
    </View>
  );
}
