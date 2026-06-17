import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LegalFooterLinks } from '@/components/legal/legal-footer-links';
import { palette } from '@/theme';

const MOBILE_VIEWPORT_WIDTH = 390;

type PurchaseScreenShellProps = {
  children: ReactNode;
};

export function PurchaseScreenShell({ children }: PurchaseScreenShellProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.viewport}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {children}
          <LegalFooterLinks />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.black,
    alignItems: 'center',
  },
  viewport: {
    flex: 1,
    width: '100%',
    maxWidth: MOBILE_VIEWPORT_WIDTH,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
    gap: 20,
  },
});
