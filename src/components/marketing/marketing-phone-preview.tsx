import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { fan, organizer, palette, spacing, text } from '@/theme';
import { platformViewShadow } from '@/theme/platform-styles';

export type MarketingPhoneVariant = 'dashboard' | 'issue' | 'scan';

type MarketingPhonePreviewProps = {
  variant: MarketingPhoneVariant;
  style?: ViewStyle;
};

const VARIANT_COPY: Record<
  MarketingPhoneVariant,
  { eyebrow: string; title: string; lines: string[]; accent?: string }
> = {
  dashboard: {
    eyebrow: 'COMMAND CENTER',
    title: 'Hey Alex 👋',
    lines: ['Neon Nights · LIVE', 'Island Vibes · DRAFT', '+ Create Event'],
    accent: organizer.accent,
  },
  issue: {
    eyebrow: 'ISSUE PASS',
    title: 'Summer Rooftop',
    lines: ['Alex Rivera · GA', 'Send pass by SMS', 'Share link by email'],
    accent: fan.primary,
  },
  scan: {
    eyebrow: 'SCAN PASS',
    title: 'Door check-in',
    lines: ['Point at QR code', 'VALID · Checked in', 'Scan another guest'],
    accent: organizer.accent,
  },
};

/** Styled phone card placeholder when marketing screenshots are unavailable. */
export function MarketingPhonePreview({ variant, style }: MarketingPhonePreviewProps) {
  const copy = VARIANT_COPY[variant];

  return (
    <View style={[styles.shell, style]}>
      <View style={styles.notch} />
      <View style={styles.screen}>
        <Text style={styles.eyebrow}>{copy.eyebrow}</Text>
        <Text style={styles.title}>{copy.title}</Text>
        <View style={styles.lines}>
          {copy.lines.map((line) => (
            <View key={line} style={styles.lineRow}>
              <View style={[styles.dot, { backgroundColor: copy.accent ?? fan.primary }]} />
              <Text style={styles.lineText}>{line}</Text>
            </View>
          ))}
        </View>
        <View style={[styles.cta, { backgroundColor: copy.accent ?? fan.primary }]}>
          <Text style={styles.ctaText}>
            {variant === 'dashboard' ? 'Create Event' : variant === 'issue' ? 'Issue Pass' : 'Scanning…'}
          </Text>
        </View>
      </View>
    </View>
  );
}

const PHONE_WIDTH = 240;

const styles = StyleSheet.create({
  shell: {
    alignSelf: 'center',
    backgroundColor: '#111111',
    borderColor: 'rgba(255, 45, 120, 0.35)',
    borderRadius: 32,
    borderWidth: 2,
    paddingHorizontal: 10,
    paddingTop: 12,
    paddingBottom: 14,
    width: PHONE_WIDTH,
    ...platformViewShadow({
      shadowColor: fan.bright,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.22,
      shadowRadius: 24,
    }),
  },
  notch: {
    alignSelf: 'center',
    backgroundColor: palette.pureBlack,
    borderRadius: 999,
    height: 6,
    marginBottom: 10,
    width: 72,
  },
  screen: {
    backgroundColor: '#0A0A0A',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 22,
    borderWidth: 1,
    gap: spacing.two,
    minHeight: 320,
    padding: spacing.three,
  },
  eyebrow: {
    color: fan.bright,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  title: {
    color: text.primary,
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 26,
  },
  lines: {
    gap: spacing.two,
    marginTop: spacing.one,
  },
  lineRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.two,
  },
  dot: {
    borderRadius: 999,
    height: 6,
    width: 6,
  },
  lineText: {
    color: text.secondary,
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  cta: {
    alignItems: 'center',
    borderRadius: 999,
    marginTop: 'auto',
    paddingHorizontal: spacing.three,
    paddingVertical: spacing.two,
  },
  ctaText: {
    color: palette.pureBlack,
    fontSize: 13,
    fontWeight: '800',
  },
});
