import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { chrome, radius, shadows, spacing } from '@/theme';

type GlassCardProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function GlassCard({ children, style }: GlassCardProps) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: chrome.glass.fill,
    borderColor: chrome.glass.border,
    borderRadius: radius.card,
    borderWidth: 1,
    gap: spacing.three,
    overflow: 'hidden',
    padding: spacing.four,
    shadowColor: shadows.walletCard.shadowColor,
    shadowOffset: shadows.walletCard.shadowOffset,
    shadowOpacity: 0.35,
    shadowRadius: 24,
  },
});
