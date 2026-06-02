import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LegalFooterLinks } from '@/components/legal/legal-footer-links';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { LEGAL_LAST_UPDATED } from '@/lib/legal-content';
import { chrome, fan, spacing, surface, text } from '@/theme';

type LegalDocumentScreenProps = {
  title: string;
  children: ReactNode;
};

export function LegalDocumentScreen({ title, children }: LegalDocumentScreenProps) {
  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <ThemedText style={styles.wordmark}>808Tix</ThemedText>
          <ThemedText style={styles.title}>{title}</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.updated}>
            Last updated: {LEGAL_LAST_UPDATED}
          </ThemedText>

          <View style={styles.body}>{children}</View>

          <View style={styles.footer}>
            <LegalFooterLinks centered variant="organizer" />
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

type LegalSectionProps = {
  heading: string;
  children: ReactNode;
};

export function LegalSection({ heading, children }: LegalSectionProps) {
  return (
    <View style={styles.section}>
      <ThemedText style={styles.sectionHeading}>{heading}</ThemedText>
      {children}
    </View>
  );
}

export function LegalParagraph({ children }: { children: ReactNode }) {
  return (
    <ThemedText themeColor="textSecondary" style={styles.paragraph}>
      {children}
    </ThemedText>
  );
}

export function LegalBulletList({ items }: { items: string[] }) {
  return (
    <View style={styles.list}>
      {items.map((item) => (
        <ThemedText key={item} themeColor="textSecondary" style={styles.listItem}>
          • {item}
        </ThemedText>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: surface.background,
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    alignSelf: 'center',
    gap: spacing.three,
    maxWidth: MaxContentWidth,
    paddingBottom: Spacing.six,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    width: '100%',
  },
  wordmark: {
    color: fan.primary,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: {
    color: text.primary,
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
  },
  updated: {
    fontSize: 13,
    lineHeight: 18,
  },
  body: {
    backgroundColor: chrome.glass.fill,
    borderColor: chrome.glass.border,
    borderRadius: 12,
    borderWidth: 1,
    gap: spacing.four,
    padding: spacing.four,
  },
  section: {
    gap: spacing.two,
  },
  sectionHeading: {
    color: text.primary,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 23,
  },
  list: {
    gap: spacing.one,
  },
  listItem: {
    fontSize: 15,
    lineHeight: 23,
    paddingLeft: spacing.one,
  },
  footer: {
    marginTop: spacing.two,
    paddingVertical: spacing.two,
  },
});
