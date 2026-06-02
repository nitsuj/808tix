import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { fan, spacing, text } from '@/theme';

type LegalFooterLinksProps = {
  /** Fan (guest) styling vs organizer chrome */
  variant?: 'fan' | 'organizer';
  centered?: boolean;
};

export function LegalFooterLinks({ variant = 'organizer', centered = false }: LegalFooterLinksProps) {
  const linkColor = variant === 'fan' ? fan.badgeText : text.secondary;

  return (
    <View style={[styles.row, centered && styles.rowCentered]}>
      <Link href="/privacy" asChild>
        <Pressable accessibilityRole="link">
          <ThemedText style={[styles.link, { color: linkColor }]}>Privacy Policy</ThemedText>
        </Pressable>
      </Link>
      <ThemedText style={[styles.separator, { color: linkColor }]}>·</ThemedText>
      <Link href="/terms" asChild>
        <Pressable accessibilityRole="link">
          <ThemedText style={[styles.link, { color: linkColor }]}>Terms of Service</ThemedText>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.two,
  },
  rowCentered: {
    justifyContent: 'center',
  },
  link: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    textDecorationLine: 'underline',
  },
  separator: {
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.7,
  },
});
