import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { dashboardStyles as styles } from '@/components/dashboard/dashboard-styles';

type DashboardShellProps = {
  children: ReactNode;
};

/** Scrollable dashboard page shell with shared dark background and max-width container. */
export function DashboardShell({ children }: DashboardShellProps) {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.page}>{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
}
