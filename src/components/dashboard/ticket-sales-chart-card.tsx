import { View } from 'react-native';

import { EmptyState } from '@/components/dashboard/empty-state';
import { dashboardStyles as styles } from '@/components/dashboard/dashboard-styles';
import { DashboardSectionHeader } from '@/components/dashboard/dashboard-section-header';
import { TicketSalesAreaChart } from '@/components/dashboard/ticket-sales-area-chart';

type TicketSalesChartCardProps = {
  /** When provided (design-review only), renders the pink/magenta chart instead of the empty state. */
  series?: readonly number[];
  labels?: readonly string[];
  yAxisLabels?: readonly [string, string, string];
};

export function TicketSalesChartCard({ series, labels, yAxisLabels }: TicketSalesChartCardProps) {
  const hasChart = series && labels && series.length > 0;

  return (
    <View style={styles.chartCard}>
      <DashboardSectionHeader title="Ticket sales over time" />
      {hasChart ? (
        <View style={styles.chartWrap}>
          <TicketSalesAreaChart
            series={series}
            labels={labels}
            yAxisLabels={yAxisLabels}
          />
        </View>
      ) : (
        <View style={styles.chartEmpty}>
          <EmptyState
            title="Time-series analytics coming soon"
            body="Daily ticket sales charts need a platform time-series RPC. Overview KPIs below use live paid-order snapshots."
          />
        </View>
      )}
    </View>
  );
}
