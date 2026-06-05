import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { useRef } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LegalFooterLinks } from '@/components/legal/legal-footer-links';
import {
  MarketingPhonePreview,
  type MarketingPhoneVariant,
} from '@/components/marketing/marketing-phone-preview';
import { fan, palette, spacing, text } from '@/theme';

const DOT_BACKGROUND = require('@/assets/backgrounds/organizer-background.png');
const APP_ICON = require('@/assets/images/icon.png');

const MARKETING_MAX_WIDTH = 1120;
const DESKTOP_BREAKPOINT = 960;

const HOW_IT_WORKS_STEPS: {
  step: string;
  title: string;
  body: string;
  variant: MarketingPhoneVariant;
}[] = [
  {
    step: '1',
    title: 'Create Event',
    body: 'Set up your event in minutes — name, venue, date, passes, and artwork.',
    variant: 'dashboard',
  },
  {
    step: '2',
    title: 'Sell / Send Passes',
    body: 'Issue passes and share links by text or email. No complicated setup.',
    variant: 'issue',
  },
  {
    step: '3',
    title: 'Scan Guests',
    body: 'Fast mobile check-in at the door with QR validation and duplicate protection.',
    variant: 'scan',
  },
];

const WHY_ITEMS = [
  {
    title: 'Mobile First',
    body: 'Run your event from your phone — create, issue, and scan without a laptop.',
  },
  {
    title: 'Fast Check-In',
    body: 'No clipboards. No spreadsheets. Instant valid / invalid states at the door.',
  },
  {
    title: 'Direct Distribution',
    body: 'Send pass links by SMS or email so guests open tickets on mobile.',
  },
  {
    title: 'Independent Friendly',
    body: 'Built for concerts, breweries, nightlife, festivals, and community events.',
  },
] as const;

function DotMatrixBackdrop({ intensity = 'medium' }: { intensity?: 'light' | 'medium' | 'strong' }) {
  const veilOpacity = intensity === 'light' ? 0.55 : intensity === 'strong' ? 0.25 : 0.4;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Image contentFit="cover" source={DOT_BACKGROUND} style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(0, 0, 0, ${veilOpacity})` }]} />
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: 'rgba(255, 45, 120, 0.08)' },
        ]}
      />
    </View>
  );
}

function MarketingWordmark() {
  return (
    <View style={styles.wordmarkRow}>
      <Image contentFit="contain" source={APP_ICON} style={styles.wordmarkIcon} />
      <Text style={styles.wordmarkText}>
        808<Text style={styles.wordmarkAccent}>TIX</Text>
      </Text>
    </View>
  );
}

type MarketingHomepageProps = {
  onScrollToHowItWorks: () => void;
  onHowItWorksLayout: (event: LayoutChangeEvent) => void;
};

export function MarketingHomepage({
  onScrollToHowItWorks,
  onHowItWorksLayout,
}: MarketingHomepageProps) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= DESKTOP_BREAKPOINT;

  return (
    <View style={styles.page}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <Link href="/home" asChild>
            <Pressable accessibilityRole="link">
              <MarketingWordmark />
            </Pressable>
          </Link>

          {isDesktop ? (
            <View style={styles.headerNav}>
              <Pressable accessibilityRole="button" onPress={onScrollToHowItWorks}>
                <Text style={styles.headerLink}>How It Works</Text>
              </Pressable>
              <Pressable accessibilityRole="button">
                <Text style={styles.headerLink}>For Organizers</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.headerActions}>
            <Link href="/" asChild>
              <Pressable accessibilityRole="link" style={styles.headerGhostButton}>
                <Text style={styles.headerGhostText}>Log In</Text>
              </Pressable>
            </Link>
            <Link href="/" asChild>
              <Pressable accessibilityRole="link" style={styles.headerPrimaryButton}>
                <Text style={styles.headerPrimaryText}>Get Started</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </SafeAreaView>

      <View style={styles.heroSection}>
        <DotMatrixBackdrop intensity="medium" />
        <View style={[styles.sectionInner, isDesktop && styles.heroRow]}>
          <View style={[styles.heroCopy, isDesktop && styles.heroCopyDesktop]}>
            <Text style={styles.heroBrand}>808Tix</Text>
            <Text style={styles.heroHeadline}>Ticketing built for independent events.</Text>
            <Text style={styles.heroSubheadline}>
              Create events. Sell tickets. Issue passes. Scan guests.
            </Text>
            <Text style={styles.heroSupport}>
              Share links by text or email. No complicated setup. No bloated enterprise tools.
            </Text>

            <View style={[styles.heroActions, isDesktop && styles.heroActionsDesktop]}>
              <Link href="/" asChild>
                <Pressable accessibilityRole="link" style={styles.primaryButton}>
                  <Text style={styles.primaryButtonText}>Get Started</Text>
                </Pressable>
              </Link>
              <Pressable
                accessibilityRole="button"
                onPress={onScrollToHowItWorks}
                style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>See How It Works</Text>
              </Pressable>
            </View>
          </View>

          <View style={[styles.heroPhoneWrap, isDesktop && styles.heroPhoneWrapDesktop]}>
            <MarketingPhonePreview variant="dashboard" />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <View style={[styles.sectionInner, isDesktop && styles.organizersRow]}>
          <View style={styles.organizersIconShell}>
            <Text style={styles.organizersIcon}>🎟</Text>
          </View>
          <View style={styles.organizersCopy}>
            <Text style={styles.sectionEyebrow}>BUILT FOR ORGANIZERS</Text>
            <Text style={styles.sectionTitle}>
              Eventbrite is built for everyone.{' '}
              <Text style={styles.sectionTitleAccent}>808Tix</Text> is built for you.
            </Text>
            <Text style={styles.sectionBody}>
              Whether you are running concerts, breweries, festivals, nightlife, or community
              events — 808Tix helps you create events, sell tickets, issue passes, and scan guests
              from your phone.
            </Text>
          </View>
        </View>
      </View>

      <View onLayout={onHowItWorksLayout} style={styles.section}>
        <View style={styles.sectionInner}>
          <Text style={[styles.sectionEyebrow, styles.sectionEyebrowCentered]}>HOW IT WORKS</Text>
          <View style={[styles.stepsGrid, isDesktop && styles.stepsGridDesktop]}>
            {HOW_IT_WORKS_STEPS.map((step) => (
              <View key={step.step} style={[styles.stepCard, isDesktop && styles.stepCardDesktop]}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>{step.step}</Text>
                </View>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepBody}>{step.body}</Text>
                <MarketingPhonePreview variant={step.variant} style={styles.stepPhone} />
              </View>
            ))}
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionInner}>
          <Text style={[styles.sectionEyebrow, styles.sectionEyebrowCentered]}>WHY 808TIX</Text>
          <View style={[styles.whyGrid, isDesktop && styles.whyGridDesktop]}>
            {WHY_ITEMS.map((item) => (
              <View key={item.title} style={styles.whyCard}>
                <View style={styles.whyIcon}>
                  <Text style={styles.whyIconText}>◆</Text>
                </View>
                <Text style={styles.whyTitle}>{item.title}</Text>
                <Text style={styles.whyBody}>{item.body}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionInner}>
          <View style={styles.finalCtaCard}>
            <DotMatrixBackdrop intensity="strong" />
            <View style={[styles.finalCtaInner, isDesktop && styles.finalCtaInnerDesktop]}>
              <View style={styles.finalCtaCopy}>
                <Text style={styles.finalCtaTitle}>Ready to run your next event?</Text>
                <Text style={styles.finalCtaBody}>Get started in minutes. It&apos;s free.</Text>
                <Link href="/" asChild>
                  <Pressable accessibilityRole="link" style={styles.primaryButton}>
                    <Text style={styles.primaryButtonText}>Create Your First Event →</Text>
                  </Pressable>
                </Link>
              </View>
              <MarketingWordmark />
            </View>
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.sectionInner}>
          <MarketingWordmark />
          <Text style={styles.footerTagline}>Ticketing for independent events.</Text>
          <LegalFooterLinks centered variant="fan" />
        </View>
      </View>
    </View>
  );
}

export function MarketingHomepageScreen() {
  const scrollRef = useRef<ScrollView>(null);
  const howItWorksOffsetRef = useRef(0);

  function handleHowItWorksLayout(event: LayoutChangeEvent) {
    howItWorksOffsetRef.current = event.nativeEvent.layout.y;
  }

  function scrollToHowItWorks() {
    scrollRef.current?.scrollTo({
      animated: true,
      y: Math.max(howItWorksOffsetRef.current - 24, 0),
    });
  }

  return (
    <ScrollView
      ref={scrollRef}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      style={styles.scroll}>
      <MarketingHomepage
        onHowItWorksLayout={handleHowItWorksLayout}
        onScrollToHowItWorks={scrollToHowItWorks}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    backgroundColor: palette.pureBlack,
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  page: {
    backgroundColor: palette.pureBlack,
    flex: 1,
  },
  safeArea: {
    backgroundColor: palette.pureBlack,
    zIndex: 2,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.three,
    justifyContent: 'space-between',
    maxWidth: MARKETING_MAX_WIDTH,
    paddingHorizontal: spacing.four,
    paddingVertical: spacing.three,
    width: '100%',
    alignSelf: 'center',
  },
  headerNav: {
    alignItems: 'center',
    flexDirection: 'row',
    flex: 1,
    gap: spacing.four,
    justifyContent: 'center',
  },
  headerLink: {
    color: text.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  headerActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.two,
  },
  headerGhostButton: {
    paddingHorizontal: spacing.two,
    paddingVertical: spacing.one,
  },
  headerGhostText: {
    color: text.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  headerPrimaryButton: {
    backgroundColor: fan.bright,
    borderRadius: 999,
    paddingHorizontal: spacing.three,
    paddingVertical: spacing.two,
  },
  headerPrimaryText: {
    color: palette.pureBlack,
    fontSize: 14,
    fontWeight: '800',
  },
  wordmarkRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.two,
  },
  wordmarkIcon: {
    borderRadius: 8,
    height: 28,
    width: 28,
  },
  wordmarkText: {
    color: text.primary,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  wordmarkAccent: {
    color: fan.bright,
  },
  heroSection: {
    overflow: 'hidden',
    paddingBottom: spacing.six,
    paddingTop: spacing.four,
    position: 'relative',
  },
  section: {
    paddingVertical: spacing.six,
  },
  sectionInner: {
    alignSelf: 'center',
    gap: spacing.four,
    maxWidth: MARKETING_MAX_WIDTH,
    paddingHorizontal: spacing.four,
    width: '100%',
  },
  heroRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.six,
  },
  heroCopy: {
    gap: spacing.three,
  },
  heroCopyDesktop: {
    flex: 1,
  },
  heroBrand: {
    color: fan.bright,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  heroHeadline: {
    color: text.primary,
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -0.5,
    lineHeight: 42,
    maxWidth: 640,
  },
  heroSubheadline: {
    color: text.primary,
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 28,
    maxWidth: 620,
  },
  heroSupport: {
    color: text.secondary,
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 620,
  },
  heroActions: {
    flexDirection: 'column',
    gap: spacing.three,
    marginTop: spacing.two,
  },
  heroActionsDesktop: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  primaryButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: fan.bright,
    borderRadius: 999,
    minWidth: 180,
    paddingHorizontal: spacing.five,
    paddingVertical: spacing.three,
  },
  primaryButtonText: {
    color: palette.pureBlack,
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: 999,
    borderWidth: 1,
    minWidth: 180,
    paddingHorizontal: spacing.five,
    paddingVertical: spacing.three,
  },
  secondaryButtonText: {
    color: text.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  heroPhoneWrap: {
    marginTop: spacing.five,
  },
  heroPhoneWrapDesktop: {
    flex: 1,
    marginTop: 0,
  },
  organizersRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.five,
  },
  organizersIconShell: {
    alignItems: 'center',
    borderColor: fan.bright,
    borderRadius: 24,
    borderWidth: 2,
    height: 88,
    justifyContent: 'center',
    width: 88,
  },
  organizersIcon: {
    fontSize: 34,
  },
  organizersCopy: {
    flex: 1,
    gap: spacing.two,
  },
  sectionEyebrow: {
    color: fan.bright,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  sectionEyebrowCentered: {
    textAlign: 'center',
  },
  sectionTitle: {
    color: text.primary,
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 34,
  },
  sectionTitleAccent: {
    color: fan.bright,
  },
  sectionBody: {
    color: text.secondary,
    fontSize: 16,
    lineHeight: 24,
  },
  stepsGrid: {
    gap: spacing.four,
  },
  stepsGridDesktop: {
    flexDirection: 'row',
  },
  stepCard: {
    backgroundColor: '#0E0E0E',
    borderColor: 'rgba(255, 45, 120, 0.18)',
    borderRadius: 20,
    borderWidth: 1,
    flex: 1,
    gap: spacing.two,
    padding: spacing.four,
  },
  stepCardDesktop: {
    minWidth: 0,
  },
  stepBadge: {
    alignItems: 'center',
    backgroundColor: fan.bright,
    borderRadius: 999,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  stepBadgeText: {
    color: palette.pureBlack,
    fontSize: 14,
    fontWeight: '900',
  },
  stepTitle: {
    color: text.primary,
    fontSize: 20,
    fontWeight: '800',
  },
  stepBody: {
    color: text.secondary,
    fontSize: 14,
    lineHeight: 20,
  },
  stepPhone: {
    marginTop: spacing.two,
  },
  whyGrid: {
    gap: spacing.three,
  },
  whyGridDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  whyCard: {
    backgroundColor: '#0E0E0E',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 18,
    borderWidth: 1,
    flexBasis: '48%',
    flexGrow: 1,
    gap: spacing.two,
    minWidth: 240,
    padding: spacing.four,
  },
  whyIcon: {
    alignItems: 'center',
    borderColor: fan.bright,
    borderRadius: 999,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  whyIconText: {
    color: fan.bright,
    fontSize: 14,
    fontWeight: '900',
  },
  whyTitle: {
    color: text.primary,
    fontSize: 18,
    fontWeight: '800',
  },
  whyBody: {
    color: text.secondary,
    fontSize: 14,
    lineHeight: 20,
  },
  finalCtaCard: {
    borderColor: fan.bright,
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  finalCtaInner: {
    gap: spacing.four,
    padding: spacing.five,
  },
  finalCtaInnerDesktop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  finalCtaCopy: {
    flex: 1,
    gap: spacing.three,
  },
  finalCtaTitle: {
    color: fan.bright,
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 36,
  },
  finalCtaBody: {
    color: text.primary,
    fontSize: 16,
    lineHeight: 24,
  },
  footer: {
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    borderTopWidth: 1,
    gap: spacing.three,
    paddingBottom: spacing.six,
    paddingTop: spacing.five,
  },
  footerTagline: {
    color: text.secondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.two,
  },
});
