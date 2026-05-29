import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  getScannerResultSubtitle,
  getScannerResultTitle,
  ScannerResultColors,
} from '@/constants/scanner-results';
import { Spacing } from '@/constants/theme';
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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
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
  title: {
    fontSize: 52,
    fontWeight: '800',
    letterSpacing: 1,
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
    borderRadius: Spacing.two,
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
