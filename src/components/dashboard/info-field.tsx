import { Text, View } from 'react-native';

import { dashboardStyles as styles } from '@/components/dashboard/dashboard-styles';

export function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}
