import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  getScannerResultSubtitle,
  getScannerResultTitle,
  ScannerResultColors,
} from '@/constants/scanner-results';
import { OrganizerAccent, Radii, Spacing } from '@/constants/theme';
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
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.four,
  },
  content: {
    alignItems: 'center',
    flex: 1,
    gap: Spacing.three,
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
  iconCircle: {
    alignItems: 'center',
    borderRadius: 999,
    height: 120,
    justifyContent: 'center',
    marginBottom: Spacing.two,
    width: 120,
  },
  iconCircleValid: {
    backgroundColor: '#000000',
    borderColor: OrganizerAccent,
    borderWidth: 4,
  },
  iconCircleInvalid: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderColor: '#FFFFFF',
    borderWidth: 3,
  },
  iconGlyph: {
    fontSize: 56,
    fontWeight: '800',
    lineHeight: 60,
  },
  iconGlyphOnValid: {
    color: OrganizerAccent,
  },
  iconGlyphOnDark: {
    color: '#FFFFFF',
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
    marginTop: Spacing.two,
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
    borderRadius: Radii.button,
    borderWidth: 2,
    marginBottom: Spacing.two,
    paddingVertical: Spacing.three,
  },
  scanAnotherOnValid: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  scanAnotherOnDark: {
    backgroundColor: 'transparent',
    borderColor: '#FFFFFF',
  },
  scanAnotherText: {
    fontSize: 18,
    fontWeight: '700',
  },
  scanAnotherTextOnValid: {
    color: '#FFFFFF',
  },
  scanAnotherTextOnDark: {
    color: '#FFFFFF',
  },
  pressed: {
    opacity: 0.85,
  },
});
