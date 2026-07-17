import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { chrome, radius, shadows, spacing } from '@/theme';
import { platformViewShadow } from '@/theme/platform-styles';

type GlassCardProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function GlassCard({ children, style, testID }: GlassCardProps) {
  return (
    <View style={[styles.card, style]} testID={testID}>
      {children}
    </View>
  );
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
    ...platformViewShadow({
      ...shadows.walletCard,
      shadowOpacity: 0.35,
      shadowRadius: 24,
    }),
  },
});
