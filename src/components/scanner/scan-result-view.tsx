import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  getScannerResultSubtitle,
  getScannerResultTitle,
  ScannerResultColors,
} from '@/constants/scanner-results';
import { organizer, palette, radius, scanner, spacing, text } from '@/theme';
import type { ScanValidationDisplay } from '@/lib/validate-pass-scan';

type ScanResultViewProps = {
  result: ScanValidationDisplay;
  onScanAnother: () => void;
};

export function ScanResultView({ result, onScanAnother }: ScanResultViewProps) {
  const colors = ScannerResultColors[result.result];
  const title = getScannerResultTitle(result.result);
  const subtitle = getScannerResultSubtitle(result.result);
  const showGuest = Boolean(result.guest_name);
  const isValid = result.result === 'valid';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <View style={[styles.iconCircle, isValid ? styles.iconCircleValid : styles.iconCircleInvalid]}>
            <Text style={[styles.iconGlyph, isValid ? styles.iconGlyphOnValid : styles.iconGlyphOnDark]}>
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

        <Pressable
          onPress={onScanAnother}
          style={({ pressed }) => [
            styles.scanAnotherButton,
            pressed && styles.pressed,
            result.result === 'valid' ? styles.scanAnotherOnValid : styles.scanAnotherOnDark,
          ]}>
          <Text
            style={[
              styles.scanAnotherText,
              result.result === 'valid' ? styles.scanAnotherTextOnValid : styles.scanAnotherTextOnDark,
            ]}>
            Scan Another
          </Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.four,
    paddingVertical: spacing.four,
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
    height: 120,
    justifyContent: 'center',
    marginBottom: spacing.two,
    width: 120,
  },
  iconCircleValid: {
    backgroundColor: palette.pureBlack,
    borderColor: organizer.accent,
    borderWidth: 4,
  },
  iconCircleInvalid: {
    backgroundColor: scanner.iconInvalidBackground,
    borderColor: scanner.iconInvalidBorder,
    borderWidth: 3,
  },
  iconGlyph: {
    fontSize: 56,
    fontWeight: '800',
    lineHeight: 60,
  },
  iconGlyphOnValid: {
    color: organizer.accent,
  },
  iconGlyphOnDark: {
    color: text.primary,
  },
  title: {
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 20,
    fontWeight: '600',
    opacity: 0.9,
    textAlign: 'center',
  },
  guestName: {
    fontSize: 28,
    fontWeight: '700',
    marginTop: spacing.two,
    textAlign: 'center',
  },
  passType: {
    fontSize: 18,
    fontWeight: '600',
    opacity: 0.85,
    textAlign: 'center',
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
    backgroundColor: 'transparent',
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
