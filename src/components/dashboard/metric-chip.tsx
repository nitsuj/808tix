import { Text, View } from 'react-native';

import { dashboardStyles as styles } from '@/components/dashboard/dashboard-styles';

type MetricChipProps = {
  label: string;
  value: string;
  accent?: boolean;
};

export function MetricChip({ label, value, accent }: MetricChipProps) {
  return (
    <View style={styles.metricChip}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={accent ? styles.metricValueAccent : styles.metricValue}>{value}</Text>
    </View>
  );
}
