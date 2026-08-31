import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrototypeChartCard } from '@/components/design-prototype/prototype-chart-card';
import {
  PROTOTYPE_DATE_RANGE,
  PROTOTYPE_KPIS,
  type PrototypeRange,
} from '@/components/design-prototype/prototype-data';
import { PrototypeEventsTable } from '@/components/design-prototype/prototype-events-table';
import { PrototypeMetricCard } from '@/components/design-prototype/prototype-metric-card';
import { PrototypeRevenueCard } from '@/components/design-prototype/prototype-revenue-card';
import { prototypeStyles as styles } from '@/components/design-prototype/prototype-styles';

const NAV = ['Overview', 'Events', 'Payouts', 'Monetization'] as const;

export function PrototypeDashboardShell() {
  const [range, setRange] = useState<PrototypeRange>('daily');
  const [activeNav, setActiveNav] = useState<(typeof NAV)[number]>('Overview');

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.page}>
          <View style={styles.topBar}>
            <View style={styles.brandRow}>
              <View style={styles.brandMark}>
                <Text style={styles.brandMarkText}>808</Text>
              </View>
              <Text style={styles.brandName}>808Tickets</Text>
            </View>

            <View style={styles.navRow}>
              {NAV.map((item) => {
                const active = item === activeNav;
                return (
                  <Pressable
                    key={item}
                    onPress={() => setActiveNav(item)}
                    style={[styles.navChip, active && styles.navChipActive]}
                  >
                    <Text style={[styles.navChipText, active && styles.navChipTextActive]}>
                      {item}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.topTools}>
              <View style={styles.searchBox}>
                <Text style={styles.searchText}>Search platform…</Text>
              </View>
              <View style={styles.datePill}>
                <Text style={styles.datePillText}>▣ {PROTOTYPE_DATE_RANGE}</Text>
              </View>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>JH</Text>
              </View>
            </View>
          </View>

          <View style={styles.titleBlock}>
            <Text style={styles.h1}>Global Admin Overview</Text>
            <Text style={styles.subtitle}>
              Real-time platform insights and event performance.
            </Text>
          </View>

          <View style={styles.kpiRow}>
            {PROTOTYPE_KPIS.map((kpi) => (
              <PrototypeMetricCard
                key={kpi.id}
                label={kpi.label}
                value={kpi.value}
                trend={kpi.trend}
                tone={kpi.tone}
                spark={kpi.spark}
              />
            ))}
          </View>

          <View style={styles.midRow}>
            <PrototypeChartCard range={range} onRangeChange={setRange} />
            <PrototypeRevenueCard />
          </View>

          <PrototypeEventsTable />

          <Text style={styles.protoNote}>
            Design prototype · static data · not connected to production admin RPCs
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
