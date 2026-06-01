import { Platform, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { chrome, fan } from '@/theme';

type StatBlockProps = {
  label: string;
  value: string;
  accent?: boolean;
  compact?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
};

export function StatBlock({
  label,
  value,
  accent = true,
  compact = false,
  onPress,
  style,
}: StatBlockProps) {
  const content = (
    <>
      <ThemedText style={[styles.value, accent && styles.valueAccent]}>{value}</ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.label}>
        {label}
      </ThemedText>
      {onPress ? <ThemedText style={styles.tapHint}>View list ›</ThemedText> : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [
          styles.block,
          styles.blockPressable,
          compact && styles.blockCompact,
          pressed && styles.pressed,
          Platform.OS === 'web' ? styles.blockWeb : null,
          style,
        ]}>
        {content}
      </Pressable>
    );
  }

  return (
    <View style={[styles.block, compact && styles.blockCompact, style]}>
      {content}
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
    backgroundColor: chrome.glass.fill,
    borderColor: chrome.glass.border,
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
    color: fan.primary,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  blockPressable: {
    borderColor: fan.muted,
  },
  blockWeb: {
    cursor: 'pointer',
  },
  tapHint: {
    color: fan.badgeText,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginTop: Spacing.half,
    textTransform: 'uppercase',
  },
  pressed: {
    opacity: 0.88,
  },
});
