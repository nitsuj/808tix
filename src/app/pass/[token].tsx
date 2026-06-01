import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PassQrCode } from '@/components/pass/pass-qr-code';
import { ThemedText } from '@/components/themed-text';
import { getPassStatusBanner } from '@/lib/pass-display';
import { resolvePassArtworkUri } from '@/lib/event-artwork-display';
import type { PublicPassView } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';
import { fan, organizer, palette, text } from '@/theme';

/** UI Source of Truth — Ticket Detail frame (mobile mock). */
const MOBILE_VIEWPORT_WIDTH = 390;
const REFERENCE_VIEWPORT_HEIGHT = 844;
const HERO_HEIGHT_RATIO = 0.4;

/** Measured from Ticket Detail mock at 390×844. */
const LAYOUT = {
  horizontalPadding: 24,
  headerIconSize: 22,
  headerHorizontalInset: 20,
  headerTopInset: 8,
  contentTopPadding: 20,
  dateToTitle: 8,
  titleToVenue: 6,
  venueToQr: 36,
  qrSize: 220,
  qrBorderRadius: 12,
  qrPad: 14,
  qrToBadge: 16,
  qrCenterMarkSize: 36,
  date: { fontSize: 11, lineHeight: 14, letterSpacing: 1.2 },
  title: { fontSize: 28, lineHeight: 32, letterSpacing: 0.6 },
  venue: { fontSize: 14, lineHeight: 18, letterSpacing: 0.8 },
  badge: { fontSize: 11, lineHeight: 14, letterSpacing: 1.1, paddingH: 16, paddingV: 6 },
  status: { fontSize: 11, lineHeight: 14, letterSpacing: 0.8, marginTop: 12 },
  actions: {
    paddingBottom: 28,
    paddingTop: 20,
    iconSize: 22,
    labelSize: 11,
    labelMarginTop: 6,
    labelLetterSpacing: 0.3,
  },
} as const;

const heroFadeWeb = {
  experimental_backgroundImage:
    'linear-gradient(180deg, rgba(0,0,0,0) 38%, rgba(0,0,0,0.55) 72%, #000000 100%)',
} as ViewStyle;

function formatTicketDateTimeLine(
  eventDate: string | null,
  startTime: string | null,
): string | null {
  if (!eventDate) {
    return null;
  }

  const parsed = new Date(`${eventDate}T${startTime ?? '12:00:00'}`);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const weekday = parsed.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  const monthDay = parsed
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    .toUpperCase()
    .replace('.', '');

  if (!startTime) {
    return `${weekday}, ${monthDay}`;
  }

  const time = parsed
    .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    .toUpperCase()
    .replace(/\s/g, '');

  return `${weekday}, ${monthDay} • ${time}`;
}

function formatPassTypeLabel(value: string): string {
  const trimmed = value.trim();
  return (trimmed || 'GENERAL ADMISSION').toUpperCase();
}

export default function GuestPassScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const secureToken = typeof token === 'string' ? token.trim() : '';

  if (!secureToken) {
    return <PassUnavailable message="Pass link is invalid." />;
  }

  return <GuestPassContent secureToken={secureToken} />;
}

function GuestPassContent({ secureToken }: { secureToken: string }) {
  const [pass, setPass] = useState<PublicPassView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadPass() {
      const { data, error: rpcError } = await supabase.rpc('get_pass_by_token', {
        p_secure_token: secureToken,
      });

      if (!isMounted) {
        return;
      }

      if (rpcError) {
        setError(rpcError.message);
        setPass(null);
        setIsLoading(false);
        return;
      }

      if (!data) {
        setError('Pass not found.');
        setPass(null);
        setIsLoading(false);
        return;
      }

      setPass(data as PublicPassView);
      setIsLoading(false);
    }

    void loadPass();

    return () => {
      isMounted = false;
    };
  }, [secureToken]);

  if (isLoading) {
    return (
      <MobileViewport>
        <View style={styles.loadingRoot}>
          <ActivityIndicator size="large" color={fan.primary} />
          <ThemedText themeColor="textSecondary" style={styles.loadingText}>
            Loading your pass…
          </ThemedText>
        </View>
      </MobileViewport>
    );
  }

  if (error || !pass) {
    return <PassUnavailable message={error ?? 'Pass not found.'} />;
  }

  return <TicketDetailView pass={pass} />;
}

function MobileViewport({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.viewportOuter}>
      <View style={styles.viewportInner}>{children}</View>
    </View>
  );
}

function TicketDetailView({ pass }: { pass: PublicPassView }) {
  const { height: windowHeight } = useWindowDimensions();
  const statusBanner = getPassStatusBanner(pass.status);
  const isEntryValid = pass.status === 'active';
  const passTypeLabel = formatPassTypeLabel(pass.pass_type);
  const hasUploadedArtwork = Boolean(pass.image_url?.trim());
  const artworkUri = resolvePassArtworkUri(pass.image_url, pass.event_name);

  const heroHeight = Math.round(Math.min(windowHeight, REFERENCE_VIEWPORT_HEIGHT) * HERO_HEIGHT_RATIO);

  const dateTimeLine = useMemo(
    () => formatTicketDateTimeLine(pass.event_date, pass.start_time),
    [pass.event_date, pass.start_time],
  );

  const venueLine = pass.venue_name?.trim().toUpperCase() ?? null;
  const eventTitle = pass.event_name.trim().toUpperCase();

  return (
    <MobileViewport>
      <View style={styles.screen}>
        <View style={[styles.hero, { height: heroHeight }]}>
          <Image
            cachePolicy={hasUploadedArtwork ? 'none' : 'memory-disk'}
            contentFit="cover"
            recyclingKey={artworkUri}
            source={{ uri: artworkUri }}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.heroFade, Platform.OS === 'web' ? heroFadeWeb : null]} />
          {Platform.OS !== 'web' ? (
            <>
              <View style={styles.heroFadeNativeMid} />
              <View style={styles.heroFadeNativeBottom} />
            </>
          ) : null}
          {!hasUploadedArtwork ? <View style={styles.heroFallbackTint} /> : null}

          <SafeAreaView edges={['top']} style={styles.heroHeader}>
            <Pressable accessibilityRole="button" disabled style={styles.headerIconHit}>
              <Text style={styles.headerIcon}>‹</Text>
            </Pressable>
            <Pressable accessibilityRole="button" disabled style={styles.headerIconHit}>
              <Text style={styles.headerIcon}>⋮</Text>
            </Pressable>
          </SafeAreaView>
        </View>

        <View style={styles.body}>
          <View style={styles.textBlock}>
            {dateTimeLine ? <Text style={styles.dateLine}>{dateTimeLine}</Text> : null}
            <Text style={styles.eventTitle}>{eventTitle}</Text>
            {venueLine ? <Text style={styles.venueLine}>{venueLine}</Text> : null}
          </View>

          <View style={styles.qrBlock}>
            <View style={[styles.qrShell, !isEntryValid && styles.qrShellDimmed]}>
              <PassQrCode bare secureToken={pass.secure_token} size={LAYOUT.qrSize} />
              <View style={styles.qrCenterMark}>
                <Text style={styles.qrCenterMarkText}>808</Text>
              </View>
            </View>

            <View style={styles.passTypeBadge}>
              <Text style={styles.passTypeBadgeText}>{passTypeLabel}</Text>
            </View>

            {statusBanner ? (
              <Text style={styles.statusLine}>{statusBanner.toUpperCase()}</Text>
            ) : null}
          </View>

          <View style={styles.actionsSpacer} />

          <SafeAreaView edges={['bottom']} style={styles.actionsRow}>
            <TicketAction icon="⇄" label="Transfer" />
            <TicketAction icon="▣" label="Add to Wallet" />
            <TicketAction icon="☰" label="Details" />
          </SafeAreaView>
        </View>
      </View>
    </MobileViewport>
  );
}

function TicketAction({ icon, label }: { icon: string; label: string }) {
  return (
    <Pressable accessibilityRole="button" disabled style={styles.actionItem}>
      <Text style={styles.actionIcon}>{icon}</Text>
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

function PassUnavailable({ message }: { message: string }) {
  return (
    <MobileViewport>
      <View style={styles.unavailableRoot}>
        <SafeAreaView style={styles.unavailableInner}>
          <Text style={styles.unavailableTitle}>Pass unavailable</Text>
          <ThemedText themeColor="textSecondary" style={styles.unavailableBody}>
            {message}
          </ThemedText>
        </SafeAreaView>
      </View>
    </MobileViewport>
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
  },
  screen: {
    backgroundColor: palette.pureBlack,
    flex: 1,
  },
  hero: {
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },
  heroFade: {
    ...StyleSheet.absoluteFill,
  },
  heroFadeNativeMid: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    top: '48%',
  },
  heroFadeNativeBottom: {
    ...StyleSheet.absoluteFill,
    backgroundColor: palette.pureBlack,
    top: '72%',
  },
  heroFallbackTint: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(8, 8, 8, 0.28)',
  },
  heroHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: LAYOUT.headerHorizontalInset,
    paddingTop: LAYOUT.headerTopInset,
    position: 'absolute',
    top: 0,
    width: '100%',
    zIndex: 2,
  },
  headerIconHit: {
    minHeight: 40,
    minWidth: 40,
    justifyContent: 'center',
  },
  headerIcon: {
    color: palette.white,
    fontSize: LAYOUT.headerIconSize,
    fontWeight: '600',
    lineHeight: LAYOUT.headerIconSize + 4,
  },
  body: {
    backgroundColor: palette.pureBlack,
    flex: 1,
    paddingHorizontal: LAYOUT.horizontalPadding,
  },
  textBlock: {
    alignItems: 'center',
    gap: 0,
    paddingTop: LAYOUT.contentTopPadding,
  },
  dateLine: {
    color: fan.badgeText,
    fontSize: LAYOUT.date.fontSize,
    fontWeight: '600',
    letterSpacing: LAYOUT.date.letterSpacing,
    lineHeight: LAYOUT.date.lineHeight,
    marginBottom: LAYOUT.dateToTitle,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  eventTitle: {
    color: text.primary,
    fontSize: LAYOUT.title.fontSize,
    fontWeight: '800',
    letterSpacing: LAYOUT.title.letterSpacing,
    lineHeight: LAYOUT.title.lineHeight,
    marginBottom: LAYOUT.titleToVenue,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  venueLine: {
    color: text.primary,
    fontSize: LAYOUT.venue.fontSize,
    fontWeight: '600',
    letterSpacing: LAYOUT.venue.letterSpacing,
    lineHeight: LAYOUT.venue.lineHeight,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  qrBlock: {
    alignItems: 'center',
    marginTop: LAYOUT.venueToQr,
  },
  qrShell: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderRadius: LAYOUT.qrBorderRadius,
    justifyContent: 'center',
    overflow: 'hidden',
    padding: LAYOUT.qrPad,
    position: 'relative',
  },
  qrShellDimmed: {
    opacity: 0.45,
  },
  qrCenterMark: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderRadius: 6,
    height: LAYOUT.qrCenterMarkSize,
    justifyContent: 'center',
    left: '50%',
    marginLeft: -LAYOUT.qrCenterMarkSize / 2,
    marginTop: -LAYOUT.qrCenterMarkSize / 2,
    position: 'absolute',
    top: '50%',
    width: LAYOUT.qrCenterMarkSize,
  },
  qrCenterMarkText: {
    color: organizer.accent,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  passTypeBadge: {
    borderColor: organizer.accent,
    borderRadius: 999,
    borderWidth: 1,
    marginTop: LAYOUT.qrToBadge,
    paddingHorizontal: LAYOUT.badge.paddingH,
    paddingVertical: LAYOUT.badge.paddingV,
  },
  passTypeBadgeText: {
    color: organizer.accent,
    fontSize: LAYOUT.badge.fontSize,
    fontWeight: '700',
    letterSpacing: LAYOUT.badge.letterSpacing,
    lineHeight: LAYOUT.badge.lineHeight,
    textTransform: 'uppercase',
  },
  statusLine: {
    color: fan.bright,
    fontSize: LAYOUT.status.fontSize,
    fontWeight: '600',
    letterSpacing: LAYOUT.status.letterSpacing,
    lineHeight: LAYOUT.status.lineHeight,
    marginTop: LAYOUT.status.marginTop,
    textAlign: 'center',
  },
  actionsSpacer: {
    flex: 1,
    minHeight: 16,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: LAYOUT.actions.paddingBottom,
    paddingTop: LAYOUT.actions.paddingTop,
  },
  actionItem: {
    alignItems: 'center',
    flex: 1,
    opacity: 0.92,
  },
  actionIcon: {
    color: palette.white,
    fontSize: LAYOUT.actions.iconSize,
    fontWeight: '500',
    lineHeight: LAYOUT.actions.iconSize + 4,
  },
  actionLabel: {
    color: palette.white,
    fontSize: LAYOUT.actions.labelSize,
    fontWeight: '500',
    letterSpacing: LAYOUT.actions.labelLetterSpacing,
    lineHeight: LAYOUT.actions.labelSize + 4,
    marginTop: LAYOUT.actions.labelMarginTop,
    textAlign: 'center',
  },
  loadingRoot: {
    alignItems: 'center',
    backgroundColor: palette.pureBlack,
    flex: 1,
    gap: 12,
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 15,
  },
  unavailableRoot: {
    backgroundColor: palette.pureBlack,
    flex: 1,
  },
  unavailableInner: {
    flex: 1,
    gap: 10,
    justifyContent: 'center',
    paddingHorizontal: LAYOUT.horizontalPadding,
  },
  unavailableTitle: {
    color: text.primary,
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 38,
  },
  unavailableBody: {
    fontSize: 17,
    lineHeight: 24,
  },
});
