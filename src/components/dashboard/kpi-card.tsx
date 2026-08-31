import { Text, View } from 'react-native';

import { dashboardStyles as styles } from '@/components/dashboard/dashboard-styles';

type KpiCardProps = {
  label: string;
  value: string;
  hint?: string;
};

export function KpiCard({ label, value, hint }: KpiCardProps) {
  return (
    <View style={styles.kpiCard}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiValue}>{value}</Text>
      {hint ? <Text style={styles.kpiHint}>{hint}</Text> : null}
    </View>
  );
}
