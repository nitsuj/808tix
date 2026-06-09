import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import QRCodeLib from 'qrcode';
import { useEffect, useMemo, useState } from 'react';
import QRCode from 'react-native-qrcode-svg';
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
import { ThemedText } from '@/components/themed-text';
import { getPassStatusBanner } from '@/lib/pass-display';
import { formatEventDateTimeTicketUpper } from '@/lib/event-datetime-display';
import { resolvePassArtworkUri } from '@/lib/event-artwork-display';
import { resolveEventArtworkPublicUrl } from '@/lib/event-artwork-storage';
import type { PublicPassView } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';
import { fan, organizer, palette, passScreen, spacing, text } from '@/theme';

const MOBILE_VIEWPORT_WIDTH = 390;
const QR_SIZE = 220;

const LAYOUT = {
  horizontalPadding: 24,
  cardTopInset: 112,
  cardBottomInset: 32,
  dateToTitle: 8,
  titleToVenue: 6,
  metaToQr: 24,
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
  return formatEventDateTimeTicketUpper(eventDate, startTime);
}

function formatPassTypeLabel(value: string): string {
  const trimmed = value.trim();
  return (trimmed || 'GENERAL ADMISSION').toUpperCase();
}

export default function GuestPassScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const secureToken = typeof token === 'string' ? token.trim() : '';

  if (!secureToken) {
    return (
      <PassScreenShell>
        <View style={styles.messageRoot}>
          <Text style={styles.unavailableTitle}>Pass unavailable</Text>
          <ThemedText themeColor="textSecondary" style={styles.unavailableBody}>
            Pass link is invalid.
          </ThemedText>
        </View>
      </PassScreenShell>
    );
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

  const artworkUri = pass
    ? resolvePassArtworkUri(pass.image_url, pass.event_name)
    : null;

  if (isLoading) {
    return (
      <PassScreenShell artworkUri={artworkUri}>
        <View style={styles.messageRoot}>
          <ActivityIndicator size="large" color={fan.primary} />
          <ThemedText themeColor="textSecondary" style={styles.loadingText}>
            Loading your pass…
          </ThemedText>
        </View>
      </PassScreenShell>
    );
  }

  if (error || !pass) {
    return (
      <PassScreenShell artworkUri={artworkUri}>
        <View style={styles.messageRoot}>
          <Text style={styles.unavailableTitle}>Pass unavailable</Text>
          <ThemedText themeColor="textSecondary" style={styles.unavailableBody}>
            {error ?? 'Pass not found.'}
          </ThemedText>
        </View>
      </PassScreenShell>
    );
  }

  const passToken = pass.secure_token?.trim();
  if (!passToken) {
    return (
      <PassScreenShell artworkUri={artworkUri}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          style={styles.scrollView}>
          <View style={styles.credentialCard}>
            <Text style={styles.errorCardTitle}>Pass token missing — QR cannot be displayed.</Text>
            <Text style={styles.errorCardBody}>
              Please contact the organizer for a new pass link.
            </Text>
          </View>
        </ScrollView>
      </PassScreenShell>
    );
  }

  return <TicketDetailView pass={pass} artworkUri={artworkUri} />;
}

function TicketDetailView({
  pass,
  artworkUri,
}: {
  pass: PublicPassView;
  artworkUri: string;
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);

  const statusBanner = getPassStatusBanner(pass.status);
  const isEntryValid = pass.status === 'active';
  const passTypeLabel = formatPassTypeLabel(pass.pass_type);
  const hasUploadedArtwork = Boolean(pass.image_url?.trim());

  const dateTimeLine = useMemo(
    () => formatTicketDateTimeLine(pass.event_date, pass.start_time),
    [pass.event_date, pass.start_time],
  );

  const venueLine = pass.venue_name?.trim().toUpperCase() ?? null;
  const eventTitle = pass.event_name.trim().toUpperCase();
  const guestName = pass.guest_name?.trim() ?? null;
  const qrToken = pass.secure_token?.trim() ?? '';

  useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }

    const token = pass.secure_token?.trim();
    if (!token) {
      return;
    }

    let cancelled = false;

    void QRCodeLib.toDataURL(token, {
      width: QR_SIZE,
      margin: 0,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    })
      .then((uri) => {
        if (!cancelled) {
          setQrDataUrl(uri);
          setQrError(null);
        }
      })
      .catch((err: unknown) => {
        console.error('Guest pass QR generation failed:', err);
        if (!cancelled) {
          setQrDataUrl(null);
          setQrError('QR failed to generate');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [pass.secure_token]);

  return (
    <PassScreenShell artworkUri={artworkUri} isUploaded={hasUploadedArtwork}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        style={styles.scrollView}>
        <View style={styles.credentialCard}>
          <View style={styles.metaBlock}>
            {dateTimeLine ? <Text style={styles.dateLine}>{dateTimeLine}</Text> : null}
            <Text style={styles.eventTitle}>{eventTitle}</Text>
            {venueLine ? <Text style={styles.venueLine}>{venueLine}</Text> : null}
            {guestName ? <Text style={styles.guestLine}>{guestName}</Text> : null}
          </View>

          <View style={styles.qrBlock}>
            <View style={[styles.qrShell, !isEntryValid && styles.qrShellDimmed]}>
              {Platform.OS === 'web' ? (
                qrDataUrl ? (
                  <Image
                    accessibilityLabel="Pass QR code"
                    contentFit="fill"
                    source={{ uri: qrDataUrl }}
                    style={styles.qrImage}
                  />
                ) : qrError ? (
                  <Text style={styles.qrErrorText}>{qrError}</Text>
                ) : (
                  <ActivityIndicator color="#000000" size="small" />
                )
              ) : (
                <QRCode
                  backgroundColor="#FFFFFF"
                  color="#000000"
                  quietZone={0}
                  size={QR_SIZE}
                  value={qrToken}
                />
              )}
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
    </PassScreenShell>
  );
}

function PassScreenShell({
  artworkUri,
  isUploaded = false,
  children,
}: {
  artworkUri?: string | null;
  isUploaded?: boolean;
  children: React.ReactNode;
}) {
  const resolvedArtworkUri =
    artworkUri && isUploaded
      ? resolveEventArtworkPublicUrl(artworkUri) ?? artworkUri
      : artworkUri;
  const uploadedCachePolicy = Platform.OS === 'web' ? 'none' : 'memory-disk';

  return (
    <View style={styles.root}>
      <View style={styles.backgroundLayer}>
        {resolvedArtworkUri ? (
          <Image
            cachePolicy={isUploaded ? uploadedCachePolicy : 'memory-disk'}
            contentFit="cover"
            recyclingKey={resolvedArtworkUri}
            source={{ uri: resolvedArtworkUri }}
            style={styles.backgroundImage}
          />
        ) : null}
        <View style={styles.backgroundScrim} />
      </View>

      <SafeAreaView edges={['top', 'bottom']} style={styles.foreground}>
        {children}
      </SafeAreaView>
    </View>
  );
}

const webViewportMinHeight =
  Platform.OS === 'web' ? ({ minHeight: '100dvh' } as const) : null;

const styles = StyleSheet.create({
  root: {
    backgroundColor: palette.pureBlack,
    flex: 1,
    position: 'relative',
    ...webViewportMinHeight,
  },
  backgroundLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
  },
  backgroundScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
    zIndex: 1,
  },
  foreground: {
    alignItems: 'center',
    elevation: 2,
    flex: 1,
    position: 'relative',
    width: '100%',
    zIndex: 2,
  },
  scrollView: {
    alignSelf: 'center',
    flex: 1,
    maxWidth: MOBILE_VIEWPORT_WIDTH,
    width: '100%',
  },
  scrollContent: {
    alignItems: 'center',
    flexGrow: 1,
    paddingBottom: LAYOUT.cardBottomInset,
    paddingHorizontal: LAYOUT.horizontalPadding,
    paddingTop: LAYOUT.cardTopInset,
    width: '100%',
  },
  messageRoot: {
    alignItems: 'center',
    flex: 1,
    gap: 12,
    justifyContent: 'center',
    maxWidth: MOBILE_VIEWPORT_WIDTH,
    paddingHorizontal: LAYOUT.horizontalPadding,
    width: '100%',
  },
  credentialCard: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: passScreen.credential.cardBackground,
    borderColor: passScreen.credential.cardBorder,
    borderRadius: passScreen.credential.borderRadius,
    borderWidth: 1,
    gap: spacing.three,
    maxWidth: MOBILE_VIEWPORT_WIDTH,
    paddingBottom: passScreen.credential.paddingBottom,
    paddingHorizontal: passScreen.credential.paddingHorizontal,
    paddingTop: passScreen.credential.paddingTop,
    width: '100%',
  },
  metaBlock: {
    alignItems: 'center',
    gap: 0,
    width: '100%',
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
  guestLine: {
    color: text.secondary,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: spacing.one,
    textAlign: 'center',
  },
  qrBlock: {
    alignItems: 'center',
    marginTop: LAYOUT.metaToQr,
    width: '100%',
  },
  qrShell: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderRadius: LAYOUT.qrBorderRadius,
    height: QR_SIZE + LAYOUT.qrPad * 2,
    justifyContent: 'center',
    padding: LAYOUT.qrPad,
    position: 'relative',
    width: QR_SIZE + LAYOUT.qrPad * 2,
  },
  qrImage: {
    alignSelf: 'center',
    backgroundColor: palette.white,
    height: QR_SIZE,
    width: QR_SIZE,
  },
  qrErrorText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '700',
    paddingHorizontal: spacing.two,
    textAlign: 'center',
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
    width: '100%',
  },
  loadingText: {
    fontSize: 15,
  },
  unavailableTitle: {
    color: text.primary,
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 38,
    textAlign: 'center',
  },
  unavailableBody: {
    fontSize: 17,
    lineHeight: 24,
    textAlign: 'center',
  },
  errorCardTitle: {
    color: text.primary,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
    textAlign: 'center',
  },
  errorCardBody: {
    color: text.secondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
