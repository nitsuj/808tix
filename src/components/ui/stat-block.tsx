import { StyleSheet, View, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';

import { ThemedText } from '@/components/themed-text';
import { OrganizerAccent, Radii, Spacing, Surface } from '@/constants/theme';

type StatBlockProps = {
  label: string;
  value: string;
  accent?: boolean;
  compact?: boolean;
  style?: ViewStyle;
};

export function StatBlock({ label, value, accent = true, compact = false, style }: StatBlockProps) {
  return (
    <View style={[styles.block, compact && styles.blockCompact, style]}>
      <ThemedText style={[styles.value, accent && styles.valueAccent]}>{value}</ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.label}>
        {label}
      </ThemedText>
    </View>
  );
}

type StatRowProps = {
  children: ReactNode;
  style?: ViewStyle;
};

export function StatRow({ children, style }: StatRowProps) {
  return <View style={[styles.row, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  block: {
    backgroundColor: Surface.card,
    borderColor: Surface.divider,
    borderRadius: Radii.card,
    borderWidth: 1,
    flex: 1,
    gap: Spacing.one,
    minWidth: 140,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  blockCompact: {
    minWidth: 88,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
  },
  value: {
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 32,
  },
  valueAccent: {
    color: OrganizerAccent,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
});
