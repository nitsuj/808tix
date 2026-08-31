import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { dashboardStyles as styles } from '@/components/dashboard/dashboard-styles';
import { dash } from '@/components/dashboard/dashboard-tokens';
import { GlobalAdminDashboardView } from '@/components/dashboard/global-admin-dashboard-view';
import {
  REVIEW_CHART_LABELS,
  REVIEW_CHART_SERIES,
  REVIEW_CHART_Y_AXIS,
  REVIEW_EVENTS,
  REVIEW_MONETIZATION,
  REVIEW_SUMMARY,
} from '@/components/design-review/dashboard-review-data';

export function AdminDashboardReviewShell() {
  const router = useRouter();

  return (
    <GlobalAdminDashboardView
      summary={REVIEW_SUMMARY}
      events={REVIEW_EVENTS}
      monetization={REVIEW_MONETIZATION}
      onOpenEvent={() => router.push('/design/admin-event-detail-prototype' as never)}
      chartSeries={REVIEW_CHART_SERIES}
      chartLabels={REVIEW_CHART_LABELS}
      chartYAxisLabels={REVIEW_CHART_Y_AXIS}
      monetizationFootnote="Read-only mock — fee editing is available on the authenticated /admin route."
      topBanner={
        <View
          style={{
            marginBottom: 14,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: dash.magentaSoft,
            backgroundColor: dash.magentaSoft,
            paddingHorizontal: 14,
            paddingVertical: 10,
          }}
        >
          <Text style={{ color: dash.magenta, fontSize: 13, fontWeight: '800' }}>
            Design Review — Mock Data
          </Text>
          <Text style={[styles.muted, { marginTop: 4 }]}>
            Hidden route for visual QA only. Uses the same dashboard components as /admin with static
            fake data. Not connected to production RPCs.
          </Text>
        </View>
      }
    />
  );
}
