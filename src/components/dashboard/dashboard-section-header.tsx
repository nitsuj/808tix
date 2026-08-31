import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { dashboardStyles as styles } from '@/components/dashboard/dashboard-styles';

type DashboardSectionHeaderProps = {
  title: string;
  tools?: ReactNode;
};

export function DashboardSectionHeader({ title, tools }: DashboardSectionHeaderProps) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {tools ? <View style={styles.sectionTools}>{tools}</View> : null}
    </View>
  );
}
