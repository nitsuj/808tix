import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScannerArtworkBackground } from '@/components/scanner/scanner-artwork-background';
import {
  getScannerResultSubtitle,
  getScannerResultTitle,
  ScannerResultColors,
} from '@/constants/scanner-results';
import { organizer, palette, radius, scanner, scannerScreen, spacing, text } from '@/theme';
import type { CheckInResult } from '@/lib/database.types';
import type { ScanValidationDisplay } from '@/lib/validate-pass-scan';

type ScanResultViewProps = {
  result: ScanValidationDisplay;
  eventName: string;
  imageUrl?: string | null;
  footerLabel?: string;
  onScanAnother: () => void;
};

function getResultOverlayColor(result: CheckInResult): string {
  return scannerScreen.resultOverlays[result];
}

export function ScanResultView({
  result,
  eventName,
  imageUrl,
  footerLabel,
  onScanAnother,
}: ScanResultViewProps) {
  const colors = ScannerResultColors[result.result];
  const overlayColor = getResultOverlayColor(result.result);
  const title = getScannerResultTitle(result.result);
  const subtitle = getScannerResultSubtitle(result.result);
  const showGuest = Boolean(result.guest_name);
  const isValid = result.result === 'valid';
  const isDarkText = colors.text === text.primary || colors.text === '#000000';

  return (
    <View style={styles.container}>
      <ScannerArtworkBackground eventName={eventName} imageUrl={imageUrl} />
      <View style={[styles.resultOverlay, { backgroundColor: overlayColor }]} />

      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <View style={styles.content}>
          <View
            style={[
              styles.iconCircle,
              isValid ? styles.iconCircleValid : styles.iconCircleInvalid,
            ]}>
            <Text
              style={[
                styles.iconGlyph,
                isValid ? styles.iconGlyphOnValid : styles.iconGlyphOnDark,
              ]}>
              {isValid ? '✓' : '✕'}
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
        </View>

        <View style={styles.footerBlock}>
          {footerLabel && isValid ? (
            <View style={styles.footerPill}>
              <Text
                style={[
                  styles.footerText,
                  isDarkText ? styles.footerTextDark : styles.footerTextLight,
                ]}>
                {footerLabel}
              </Text>
            </View>
          ) : null}

          <Pressable
            onPress={onScanAnother}
            style={({ pressed }) => [
              styles.scanAnotherButton,
              pressed && styles.pressed,
              isValid ? styles.scanAnotherOnValid : styles.scanAnotherOnDark,
            ]}>
            <Text
              style={[
                styles.scanAnotherText,
                isValid ? styles.scanAnotherTextOnValid : styles.scanAnotherTextOnDark,
              ]}>
              Scan Another
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
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
    paddingVertical: spacing.four,
    zIndex: 2,
  },
  content: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.three,
    justifyContent: 'center',
    paddingHorizontal: spacing.two,
  },
  iconCircle: {
    alignItems: 'center',
    borderRadius: radius.badge,
    height: 132,
    justifyContent: 'center',
    marginBottom: spacing.two,
    width: 132,
  },
  iconCircleValid: {
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
  iconCircleInvalid: {
    backgroundColor: scanner.iconInvalidBackground,
    borderColor: scanner.iconInvalidBorder,
    borderWidth: 3,
  },
  iconGlyph: {
    fontSize: 64,
    fontWeight: '800',
    lineHeight: 68,
  },
  iconGlyphOnValid: {
    color: organizer.accent,
  },
  iconGlyphOnDark: {
    color: text.primary,
  },
  title: {
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: 0.6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 20,
    fontWeight: '600',
    opacity: 0.92,
    textAlign: 'center',
  },
  guestName: {
    fontSize: 30,
    fontWeight: '700',
    marginTop: spacing.two,
    textAlign: 'center',
  },
  passType: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.2,
    opacity: 0.9,
    textAlign: 'center',
  },
  footerBlock: {
    gap: spacing.three,
  },
  footerPill: {
    alignSelf: 'center',
    backgroundColor: scannerScreen.footer.pillBackground,
    borderColor: organizer.accent,
    borderRadius: radius.input,
    borderWidth: 1,
    paddingHorizontal: spacing.four,
    paddingVertical: spacing.two,
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
    borderRadius: radius.button,
    borderWidth: 2,
    marginBottom: spacing.two,
    paddingVertical: spacing.three,
  },
  scanAnotherOnValid: {
    backgroundColor: scanner.buttonOnValidBackground,
    borderColor: scanner.buttonOnValidBorder,
  },
  scanAnotherOnDark: {
    backgroundColor: 'rgba(0, 0, 0, 0.22)',
    borderColor: scanner.buttonOnDarkBorder,
  },
  scanAnotherText: {
    fontSize: 18,
    fontWeight: '700',
  },
  scanAnotherTextOnValid: {
    color: text.primary,
  },
  scanAnotherTextOnDark: {
    color: text.primary,
  },
  pressed: {
    opacity: 0.85,
  },
});
