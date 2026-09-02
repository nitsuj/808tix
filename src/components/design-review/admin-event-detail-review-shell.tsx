import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { EventAdminDashboardView } from '@/components/dashboard/event-admin-dashboard-view';
import { dashboardStyles as styles } from '@/components/dashboard/dashboard-styles';
import { dash } from '@/components/dashboard/dashboard-tokens';
import {
  EVENT_REVIEW_BUY_PATH,
  EVENT_REVIEW_CHART_LABELS,
  EVENT_REVIEW_CHART_SERIES,
  EVENT_REVIEW_CHART_Y_AXIS,
  EVENT_REVIEW_DETAIL,
  EVENT_REVIEW_EVENT_OVERRIDE_DRAFT,
  EVENT_REVIEW_GLOBAL_FEES,
  EVENT_REVIEW_ORDERS,
  EVENT_REVIEW_ORGANIZER_OVERRIDE,
  EVENT_REVIEW_PAYOUT,
  EVENT_REVIEW_SCAN_PATH,
} from '@/components/design-review/admin-event-detail-review-data';

export function AdminEventDetailReviewShell() {
  const router = useRouter();

  return (
    <EventAdminDashboardView
      detail={EVENT_REVIEW_DETAIL}
      orders={EVENT_REVIEW_ORDERS}
      payout={EVENT_REVIEW_PAYOUT}
      globalFees={EVENT_REVIEW_GLOBAL_FEES}
      organizerOverride={EVENT_REVIEW_ORGANIZER_OVERRIDE}
      eventOverrideDraft={EVENT_REVIEW_EVENT_OVERRIDE_DRAFT}
      buyHref={EVENT_REVIEW_BUY_PATH}
      scanHref={EVENT_REVIEW_SCAN_PATH}
      chartSeries={EVENT_REVIEW_CHART_SERIES}
      chartLabels={EVENT_REVIEW_CHART_LABELS}
      chartYAxisLabels={EVENT_REVIEW_CHART_Y_AXIS}
      readOnly
      footnote="Design review mock · controls are inert · not connected to production RPCs"
      onBackToAdmin={() => router.push('/design/admin-dashboard-review' as never)}
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
            Hidden route for visual QA of the event admin detail page. Uses shared dashboard primitives
            with static fake data. Not connected to /admin/events/:eventId RPCs.
          </Text>
        </View>
      }
    />
  );
}
