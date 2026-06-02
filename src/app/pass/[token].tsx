import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AddToAppleWallet } from '@/components/pass/add-to-apple-wallet';
import { LegalFooterLinks } from '@/components/legal/legal-footer-links';
import { PassQrCode } from '@/components/pass/pass-qr-code';
import { ArtworkEnvironment } from '@/components/ui/artwork-environment';
import { ThemedText } from '@/components/themed-text';
import { getPassStatusBanner } from '@/lib/pass-display';
import { resolvePassArtworkUri } from '@/lib/event-artwork-display';
import type { PublicPassView } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';
import { fan, organizer, palette, passScreen, shadows, spacing, text } from '@/theme';

const MOBILE_VIEWPORT_WIDTH = 390;

/** Ticket Detail layout at 390×844 — typography + spacing. */
const LAYOUT = {
  horizontalPadding: 24,
  cardTopInset: 112,
  cardBottomInset: 32,
  dateToTitle: 8,
  titleToVenue: 6,
  metaToQr: 24,
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
} as const;

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
  const statusBanner = getPassStatusBanner(pass.status);
  const isEntryValid = pass.status === 'active';
  const passTypeLabel = formatPassTypeLabel(pass.pass_type);
  const hasUploadedArtwork = Boolean(pass.image_url?.trim());
  const artworkUri = resolvePassArtworkUri(pass.image_url, pass.event_name);

  const dateTimeLine = useMemo(
    () => formatTicketDateTimeLine(pass.event_date, pass.start_time),
    [pass.event_date, pass.start_time],
  );

  const venueLine = pass.venue_name?.trim().toUpperCase() ?? null;
  const eventTitle = pass.event_name.trim().toUpperCase();

  return (
    <MobileViewport>
      <View style={styles.screen}>
        <ArtworkEnvironment artworkUri={artworkUri} isUploaded={hasUploadedArtwork} />

        <SafeAreaView edges={['top', 'bottom']} style={styles.foreground}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}>
            <View style={styles.credentialCard}>
              <View style={styles.metaBlock}>
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

                <AddToAppleWallet disabled={!isEntryValid} secureToken={pass.secure_token} />
              </View>
            </View>

            <View style={styles.legalFooter}>
              <LegalFooterLinks centered variant="fan" />
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    </MobileViewport>
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

const webViewportMinHeight =
  Platform.OS === 'web' ? ({ minHeight: '100dvh' } as const) : null;

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
  screen: {
    backgroundColor: palette.pureBlack,
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  foreground: {
    flex: 1,
    zIndex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: LAYOUT.cardBottomInset,
    paddingHorizontal: LAYOUT.horizontalPadding,
    paddingTop: LAYOUT.cardTopInset,
  },
  credentialCard: {
    alignSelf: 'center',
    backgroundColor: passScreen.credential.cardBackground,
    borderColor: passScreen.credential.cardBorder,
    borderRadius: passScreen.credential.borderRadius,
    borderWidth: 1,
    gap: spacing.three,
    maxWidth: MOBILE_VIEWPORT_WIDTH - LAYOUT.horizontalPadding * 2,
    paddingBottom: passScreen.credential.paddingBottom,
    paddingHorizontal: passScreen.credential.paddingHorizontal,
    paddingTop: passScreen.credential.paddingTop,
    shadowColor: shadows.walletCard.shadowColor,
    shadowOffset: shadows.walletCard.shadowOffset,
    shadowOpacity: shadows.walletCard.shadowOpacity,
    shadowRadius: shadows.walletCard.shadowRadius,
    width: '100%',
  },
  metaBlock: {
    alignItems: 'center',
    gap: 0,
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
    marginTop: LAYOUT.metaToQr,
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
  legalFooter: {
    alignItems: 'center',
    marginTop: spacing.four,
    paddingBottom: spacing.two,
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
