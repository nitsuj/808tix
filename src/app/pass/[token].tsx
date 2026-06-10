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
import { fan, organizer, palette, spacing, text } from '@/theme';

const MOBILE_VIEWPORT_WIDTH = 390;
const QR_SIZE = 220;

const LAYOUT = {
  horizontalPadding: 20,
  topInset: 16,
  bottomInset: 32,
  posterToCard: 20,
  qrBorderRadius: 12,
  qrPad: 14,
  qrToChip: 16,
  qrCenterMarkSize: 36,
} as const;

const GLASS = {
  posterBackground: 'rgba(0, 0, 0, 0.58)',
  posterBorder: 'rgba(255, 255, 255, 0.14)',
  cardBackground: 'rgba(8, 8, 14, 0.88)',
  cardBorder: 'rgba(162, 91, 255, 0.32)',
  chipBackground: 'rgba(162, 91, 255, 0.12)',
} as const;

function formatTicketDateTimeLine(
  eventDate: string | null,
  startTime: string | null,
): string | null {
  return formatEventDateTimeTicketUpper(eventDate, startTime);
}

function formatPassTypeLabel(value: string): string {
  const trimmed = value.trim();
  return (trimmed || 'General Admission').toUpperCase();
}

export default function GuestPassScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const secureToken = typeof token === 'string' ? token.trim() : '';

  if (!secureToken) {
    return (
      <PassScreenShell>
        <View style={styles.messageRoot}>
          <Text style={styles.unavailableTitle}>Ticket unavailable</Text>
          <ThemedText themeColor="textSecondary" style={styles.unavailableBody}>
            This ticket link is invalid.
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
        setError('Ticket not found.');
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
            Loading your ticket…
          </ThemedText>
        </View>
      </PassScreenShell>
    );
  }

  if (error || !pass) {
    return (
      <PassScreenShell artworkUri={artworkUri}>
        <View style={styles.messageRoot}>
          <Text style={styles.unavailableTitle}>Ticket unavailable</Text>
          <ThemedText themeColor="textSecondary" style={styles.unavailableBody}>
            {error ?? 'Ticket not found.'}
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
              Please contact the organizer for a new ticket link.
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
  const guestName = pass.guest_name?.trim() ?? 'Ticket holder';
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
        <View style={styles.posterPanel}>
          <Text style={styles.ticketBrandLabel}>808TIX TICKET</Text>
          <View style={styles.posterAccentLine} />
          <Text style={styles.posterEventTitle}>{eventTitle}</Text>
          {dateTimeLine ? <Text style={styles.posterDateLine}>{dateTimeLine}</Text> : null}
          {venueLine ? <Text style={styles.posterVenueLine}>{venueLine}</Text> : null}
        </View>

        <View style={styles.credentialCard}>
          <View style={styles.holderBlock}>
            <Text style={styles.fieldLabel}>Ticket holder</Text>
            <Text style={styles.holderName}>{guestName}</Text>
          </View>

          <View style={styles.ticketMetaRow}>
            <View style={styles.ticketTypeChip}>
              <Text style={styles.ticketTypeLabel}>Ticket type</Text>
              <Text style={styles.ticketTypeValue}>{passTypeLabel}</Text>
            </View>
            {statusBanner ? (
              <View
                style={[
                  styles.statusChip,
                  isEntryValid ? styles.statusChipValid : styles.statusChipInactive,
                ]}>
                <Text
                  style={[
                    styles.statusChipText,
                    isEntryValid ? styles.statusChipTextValid : styles.statusChipTextInactive,
                  ]}>
                  {statusBanner.toUpperCase()}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.qrBlock}>
            <View style={[styles.qrShell, !isEntryValid && styles.qrShellDimmed]}>
              {Platform.OS === 'web' ? (
                qrDataUrl ? (
                  <Image
                    accessibilityLabel="Ticket QR code"
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

            {isEntryValid ? (
              <Text style={styles.entryHelpText}>Present this ticket at entry</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.32)',
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
    gap: LAYOUT.posterToCard,
    paddingBottom: LAYOUT.bottomInset,
    paddingHorizontal: LAYOUT.horizontalPadding,
    paddingTop: LAYOUT.topInset,
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
  posterPanel: {
    alignSelf: 'stretch',
    backgroundColor: GLASS.posterBackground,
    borderColor: GLASS.posterBorder,
    borderRadius: 18,
    borderWidth: 1,
    gap: spacing.one,
    paddingHorizontal: spacing.three,
    paddingVertical: spacing.three,
    width: '100%',
  },
  ticketBrandLabel: {
    color: fan.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2.4,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  posterAccentLine: {
    alignSelf: 'center',
    backgroundColor: fan.primary,
    borderRadius: 2,
    height: 3,
    marginBottom: spacing.one,
    marginTop: spacing.one,
    width: 48,
  },
  posterEventTitle: {
    color: text.primary,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: 0.4,
    lineHeight: 34,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  posterDateLine: {
    color: fan.badgeText,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.1,
    lineHeight: 16,
    marginTop: spacing.one,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  posterVenueLine: {
    color: text.secondary,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.6,
    lineHeight: 18,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  credentialCard: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: GLASS.cardBackground,
    borderColor: GLASS.cardBorder,
    borderRadius: 22,
    borderWidth: 1,
    gap: spacing.three,
    maxWidth: MOBILE_VIEWPORT_WIDTH,
    overflow: 'visible',
    paddingBottom: spacing.four,
    paddingHorizontal: spacing.three,
    paddingTop: spacing.three,
    width: '100%',
  },
  holderBlock: {
    alignItems: 'center',
    gap: 4,
    width: '100%',
  },
  fieldLabel: {
    color: fan.badgeText,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  holderName: {
    color: text.primary,
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 26,
    textAlign: 'center',
  },
  ticketMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.two,
    justifyContent: 'center',
    width: '100%',
  },
  ticketTypeChip: {
    alignItems: 'center',
    backgroundColor: GLASS.chipBackground,
    borderColor: 'rgba(162, 91, 255, 0.45)',
    borderRadius: 12,
    borderWidth: 1,
    gap: 2,
    minWidth: 140,
    paddingHorizontal: spacing.two,
    paddingVertical: spacing.one + 2,
  },
  ticketTypeLabel: {
    color: fan.badgeText,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  ticketTypeValue: {
    color: fan.primary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  statusChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: spacing.two,
    paddingVertical: spacing.one,
  },
  statusChipValid: {
    backgroundColor: 'rgba(57, 255, 20, 0.12)',
    borderColor: 'rgba(57, 255, 20, 0.45)',
  },
  statusChipInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  statusChipText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  statusChipTextValid: {
    color: organizer.accent,
  },
  statusChipTextInactive: {
    color: text.secondary,
  },
  qrBlock: {
    alignItems: 'center',
    gap: spacing.two,
    width: '100%',
  },
  qrShell: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderRadius: LAYOUT.qrBorderRadius,
    height: QR_SIZE + LAYOUT.qrPad * 2,
    justifyContent: 'center',
    overflow: 'visible',
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
    color: fan.primary,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  entryHelpText: {
    color: organizer.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  legalFooter: {
    alignItems: 'center',
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
