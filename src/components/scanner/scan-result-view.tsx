import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScannerArtworkBackground } from '@/components/scanner/scanner-artwork-background';
import {
  getScannerDisplayState,
  getScannerResultColors,
  getScannerResultSubtitle,
  getScannerResultTitle,
} from '@/constants/scanner-results';
import { Radii } from '@/constants/theme';
import { formatCheckedInAt } from '@/lib/check-in-display';
import { fan, organizer, palette, radius, scanner, scannerScreen, spacing, text } from '@/theme';
import type { ScanValidationDisplay } from '@/lib/validate-pass-scan';

const MOBILE_VIEWPORT_WIDTH = 390;

const webViewportMinHeight =
  Platform.OS === 'web' ? ({ minHeight: '100dvh' } as const) : null;

type ScanResultViewProps = {
  result: ScanValidationDisplay;
  eventName: string;
  eventDateLine?: string | null;
  venueLine?: string | null;
  imageUrl?: string | null;
  checkInFooterLabel: string;
  onScanAnother: () => void;
};

function getResultOverlayColor(result: ScanValidationDisplay): string {
  const state = getScannerDisplayState(result);

  if (state === 'confirmed') {
    return scannerScreen.resultOverlays.valid;
  }

  if (state === 'already_checked_in') {
    return scannerScreen.resultOverlays.already_used;
  }

  return scannerScreen.resultOverlays.invalid;
}

export function ScanResultView({
  result,
  eventName,
  eventDateLine,
  venueLine,
  imageUrl,
  checkInFooterLabel,
  onScanAnother,
}: ScanResultViewProps) {
  const displayState = getScannerDisplayState(result);
  const colors = getScannerResultColors(result);
  const overlayColor = getResultOverlayColor(result);
  const title = getScannerResultTitle(result);
  const subtitle = getScannerResultSubtitle(result);
  const showGuest = Boolean(result.guest_name);
  const isConfirmed = displayState === 'confirmed';
  const isAlreadyCheckedIn = displayState === 'already_checked_in';
  const isUnconfirmed = displayState === 'unconfirmed';
  const checkedInAtLabel = formatCheckedInAt(result.checked_in_at);
  const isDarkText = colors.text === text.primary || colors.text === '#000000';

  return (
    <View style={styles.viewportOuter}>
      <View style={styles.viewportInner}>
        <View style={styles.container}>
          <ScannerArtworkBackground eventName={eventName} imageUrl={imageUrl} />
          <View style={[styles.resultOverlay, { backgroundColor: overlayColor }]} />

          <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
            <View style={styles.eventContext}>
              <Text numberOfLines={2} style={styles.eventContextName}>
                {eventName}
              </Text>
              {eventDateLine ? (
                <Text numberOfLines={1} style={styles.eventContextDate}>
                  {eventDateLine}
                </Text>
              ) : null}
              {venueLine ? (
                <Text numberOfLines={1} style={styles.eventContextVenue}>
                  {venueLine}
                </Text>
              ) : null}
            </View>

            <View style={styles.content}>
              <View
                style={[
                  styles.iconCircle,
                  isConfirmed && styles.iconCircleConfirmed,
                  isAlreadyCheckedIn && styles.iconCircleWarning,
                  isUnconfirmed && styles.iconCircleUnconfirmed,
                ]}>
                <Text
                  style={[
                    styles.iconGlyph,
                    isConfirmed && styles.iconGlyphOnConfirmed,
                    !isConfirmed && styles.iconGlyphOnDark,
                  ]}>
                  {isConfirmed ? '✓' : isAlreadyCheckedIn ? '!' : '✕'}
                </Text>
              </View>

              <Text style={[styles.title, { color: colors.text }]}>{title}</Text>

              {subtitle ? (
                <Text style={[styles.subtitle, { color: colors.text }]}>{subtitle}</Text>
              ) : null}

              {showGuest ? (
                <Text style={[styles.guestName, { color: colors.text }]}>{result.guest_name}</Text>
              ) : null}

              {result.pass_type ? (
                <Text style={[styles.passType, { color: colors.text }]}>{result.pass_type}</Text>
              ) : null}

              {isAlreadyCheckedIn && checkedInAtLabel ? (
                <Text style={[styles.checkedInAt, { color: colors.text }]}>
                  Checked in at {checkedInAtLabel}
                </Text>
              ) : null}

              {isConfirmed ? (
                <View style={styles.footerPill}>
                  <Text
                    style={[
                      styles.footerText,
                      isDarkText ? styles.footerTextDark : styles.footerTextLight,
                    ]}>
                    {checkInFooterLabel}
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={styles.footerBlock}>
              {!isConfirmed ? (
                <View
                  style={[
                    styles.footerPill,
                    isAlreadyCheckedIn && styles.footerPillWarning,
                    isUnconfirmed && styles.footerPillMuted,
                  ]}>
                  <Text
                    style={[
                      styles.footerText,
                      isDarkText ? styles.footerTextDark : styles.footerTextLight,
                    ]}>
                    {checkInFooterLabel}
                  </Text>
                </View>
              ) : null}

              <Pressable
                onPress={onScanAnother}
                style={({ pressed }) => [
                  styles.scanAnotherButton,
                  pressed && styles.pressed,
                  isConfirmed ? styles.scanAnotherOnConfirmed : styles.scanAnotherOnDark,
                ]}>
                <Text
                  style={[
                    styles.scanAnotherText,
                    isConfirmed ? styles.scanAnotherTextOnConfirmed : styles.scanAnotherTextOnDark,
                  ]}>
                  Scan Another
                </Text>
              </Pressable>
            </View>
          </SafeAreaView>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  viewportOuter: {
    alignItems: 'center',
    backgroundColor: palette.pureBlack,
    flex: 1,
  },
  viewportInner: {
    backgroundColor: palette.pureBlack,
    flex: 1,
    maxWidth: MOBILE_VIEWPORT_WIDTH,
    width: '100%',
    ...webViewportMinHeight,
  },
  container: {
    flex: 1,
    position: 'relative',
  },
  resultOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 1,
  },
  safeArea: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.four,
    paddingVertical: spacing.three,
    zIndex: 2,
  },
  eventContext: {
    alignItems: 'center',
    gap: 4,
    paddingTop: spacing.one,
  },
  eventContextName: {
    color: text.primary,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  eventContextDate: {
    color: fan.badgeText,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  eventContextVenue: {
    color: scannerScreen.overlay.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  content: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.two,
    justifyContent: 'center',
    paddingHorizontal: spacing.two,
  },
  iconCircle: {
    alignItems: 'center',
    borderRadius: radius.badge,
    height: 120,
    justifyContent: 'center',
    marginBottom: spacing.two,
    width: 120,
  },
  iconCircleConfirmed: {
    backgroundColor: palette.pureBlack,
    borderColor: organizer.accent,
    borderWidth: 4,
    ...(Platform.OS === 'ios'
      ? {
          shadowColor: organizer.accent,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.5,
          shadowRadius: 20,
        }
      : null),
    ...(Platform.OS === 'android' ? { elevation: 8 } : null),
  },
  iconCircleWarning: {
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderColor: scanner.alreadyUsed.text,
    borderWidth: 4,
  },
  iconCircleUnconfirmed: {
    backgroundColor: scanner.iconInvalidBackground,
    borderColor: scanner.iconInvalidBorder,
    borderWidth: 3,
  },
  iconGlyph: {
    fontSize: 56,
    fontWeight: '800',
    lineHeight: 60,
  },
  iconGlyphOnConfirmed: {
    color: organizer.accent,
  },
  iconGlyphOnDark: {
    color: text.primary,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: 0.6,
    lineHeight: 38,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
    opacity: 0.95,
    paddingHorizontal: spacing.two,
    textAlign: 'center',
  },
  guestName: {
    fontSize: 26,
    fontWeight: '700',
    lineHeight: 32,
    marginTop: spacing.one,
    textAlign: 'center',
  },
  passType: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
    opacity: 0.9,
    textAlign: 'center',
  },
  checkedInAt: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
    opacity: 0.9,
    textAlign: 'center',
  },
  footerBlock: {
    gap: spacing.two,
    paddingBottom: spacing.one,
  },
  footerPill: {
    alignSelf: 'center',
    backgroundColor: scannerScreen.footer.pillBackground,
    borderColor: organizer.accent,
    borderRadius: radius.input,
    borderWidth: 1,
    maxWidth: '100%',
    paddingHorizontal: spacing.four,
    paddingVertical: spacing.two,
  },
  footerPillWarning: {
    borderColor: scanner.alreadyUsed.background,
  },
  footerPillMuted: {
    borderColor: scanner.buttonOnDarkBorder,
  },
  footerText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  footerTextDark: {
    color: palette.pureBlack,
  },
  footerTextLight: {
    color: text.primary,
  },
  scanAnotherButton: {
    alignItems: 'center',
    borderRadius: Radii.button,
    borderWidth: 2,
    minHeight: 48,
    paddingVertical: spacing.three,
  },
  scanAnotherOnConfirmed: {
    backgroundColor: scanner.buttonOnValidBackground,
    borderColor: scanner.buttonOnValidBorder,
  },
  scanAnotherOnDark: {
    backgroundColor: 'rgba(0, 0, 0, 0.22)',
    borderColor: scanner.buttonOnDarkBorder,
  },
  scanAnotherText: {
    fontSize: 17,
    fontWeight: '800',
  },
  scanAnotherTextOnConfirmed: {
    color: text.primary,
  },
  scanAnotherTextOnDark: {
    color: text.primary,
  },
  pressed: {
    opacity: 0.85,
  },
});
