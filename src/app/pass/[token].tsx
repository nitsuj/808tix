import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PassQrCode } from '@/components/pass/pass-qr-code';
import { ThemedText } from '@/components/themed-text';
import {
  FanAccent,
  FanAccentBright,
  Fonts,
  MaxContentWidth,
  Spacing,
  Surface,
} from '@/constants/theme';
import { getPassStatusBanner } from '@/lib/pass-display';
import type { PublicPassView } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

/** Temporary design fallbacks when event.image_url is missing — poster-style concert/nightlife art. */
const PASS_FALLBACK_ARTWORK = [
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1459749434690-5ed0fbc73629?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1429962710451-bb934ee8452c?auto=format&fit=crop&w=1400&q=80',
] as const;

const WALLET_CARD_RADIUS = 24;
const ART_BLUR = 28;
const FAN_SANS = Platform.select({
  ios: Fonts?.sans ?? 'System',
  android: 'sans-serif',
  default: Fonts?.sans ?? 'System',
});

function hashName(name: string): number {
  let hash = 0;

  for (let index = 0; index < name.length; index += 1) {
    hash = (hash << 5) - hash + name.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash);
}

function fallbackArtworkForName(name: string): string {
  return PASS_FALLBACK_ARTWORK[hashName(name) % PASS_FALLBACK_ARTWORK.length];
}

function titleCaseLabel(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    return 'General Admission';
  }

  return trimmed
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function formatPassDateLine(eventDate: string | null): string | null {
  if (!eventDate) {
    return null;
  }

  const parsed = new Date(`${eventDate}T12:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return eventDate;
  }

  return parsed.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function formatPassTimeLine(startTime: string | null): string | null {
  if (!startTime) {
    return null;
  }

  const parsed = new Date(`1970-01-01T${startTime}`);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

const webBlurStyle = Platform.OS === 'web' ? ({ filter: `blur(${ART_BLUR}px)` } as ViewStyle) : null;

export default function GuestPassScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const secureToken = typeof token === 'string' ? token.trim() : '';

  if (!secureToken) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.errorSafeArea}>
          <Text style={styles.errorTitle}>Pass unavailable</Text>
          <ThemedText themeColor="textSecondary" style={styles.errorBody}>
            Pass link is invalid.
          </ThemedText>
        </SafeAreaView>
      </View>
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

  if (isLoading) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.centeredSafeArea}>
          <ActivityIndicator size="large" color={FanAccent} />
          <ThemedText themeColor="textSecondary" style={styles.loadingText}>
            Loading your pass…
          </ThemedText>
        </SafeAreaView>
      </View>
    );
  }

  if (error || !pass) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.errorSafeArea}>
          <Text style={styles.errorTitle}>Pass unavailable</Text>
          <ThemedText themeColor="textSecondary" style={styles.errorBody}>
            {error ?? 'Pass not found.'}
          </ThemedText>
        </SafeAreaView>
      </View>
    );
  }

  return <GuestPassView pass={pass} />;
}

function PassArtEnvironment({ artworkUri }: { artworkUri: string }) {
  return (
    <View pointerEvents="none" style={styles.environment}>
      <View style={styles.artLayer}>
        <Image
          blurRadius={Platform.OS === 'web' ? 0 : ART_BLUR}
          contentFit="cover"
          source={{ uri: artworkUri }}
          style={[styles.artImage, webBlurStyle]}
        />
      </View>

      <View style={styles.envDarkOverlay} />
      <View style={styles.envPurpleWash} />
      <View style={styles.envVignetteTop} />
      <View style={styles.envVignetteBottom} />
      <View style={styles.envVignetteLeft} />
      <View style={styles.envVignetteRight} />
      <View style={styles.envGradientFadeLow} />
      <View style={styles.envGradientFadeMid} />
      <View style={styles.envGradientFadeHigh} />
    </View>
  );
}

function GuestPassView({ pass }: { pass: PublicPassView }) {
  const { height: windowHeight } = useWindowDimensions();
  const statusBanner = getPassStatusBanner(pass.status);
  const isEntryValid = pass.status === 'active';
  const passTypeLabel = titleCaseLabel(pass.pass_type);
  const artworkUri = pass.image_url?.trim() || fallbackArtworkForName(pass.event_name);
  const cardTopInset = Math.max(56, Math.round(windowHeight * 0.1));

  const { dateLine, timeLine } = useMemo(() => {
    return {
      dateLine: formatPassDateLine(pass.event_date),
      timeLine: formatPassTimeLine(pass.start_time),
    };
  }, [pass.event_date, pass.start_time]);

  return (
    <View style={styles.container}>
      <PassArtEnvironment artworkUri={artworkUri} />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingTop: cardTopInset }]}
          showsVerticalScrollIndicator={false}>
          <View style={styles.walletCard}>
            <Text style={styles.eventTitle}>{pass.event_name}</Text>

            <View style={styles.metaStack}>
              {pass.venue_name ? <Text style={styles.metaVenue}>{pass.venue_name}</Text> : null}
              {dateLine ? <Text style={styles.metaDate}>{dateLine}</Text> : null}
              {timeLine ? <Text style={styles.metaTime}>{timeLine}</Text> : null}
            </View>

            <View style={styles.walletDivider} />

            <View style={styles.holderBlock}>
              <Text style={styles.holderLabel}>Admitted to</Text>
              <Text style={styles.holderName}>{pass.guest_name}</Text>
            </View>

            <View style={styles.qrSlot}>
              <PassQrCode dimmed={!isEntryValid} secureToken={pass.secure_token} />
            </View>

            <View style={styles.passTypeBadge}>
              <Text style={styles.passTypeBadgeText}>{passTypeLabel}</Text>
            </View>
          </View>

          {statusBanner ? (
            <View style={styles.statusBanner}>
              <ThemedText style={styles.statusBannerText}>{statusBanner}</ThemedText>
            </View>
          ) : null}

          <View style={styles.footerActions}>
            <ComingSoonAction label="Transfer pass" />
            <Text style={styles.footerDot}>·</Text>
            <ComingSoonAction label="Add to Wallet" />
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function ComingSoonAction({ label }: { label: string }) {
  return (
    <Pressable disabled style={styles.footerAction}>
      <Text style={styles.footerActionLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Surface.background,
    flex: 1,
  },
  environment: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  artLayer: {
    ...StyleSheet.absoluteFillObject,
    transform: [{ scale: 1.12 }],
  },
  artImage: {
    height: '100%',
    width: '100%',
  },
  envDarkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 8, 8, 0.52)',
  },
  envPurpleWash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(42, 16, 64, 0.18)',
  },
  envVignetteTop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 8, 8, 0.38)',
    bottom: '55%',
  },
  envVignetteBottom: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 8, 8, 0.45)',
    top: '55%',
  },
  envVignetteLeft: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 8, 8, 0.32)',
    right: '72%',
  },
  envVignetteRight: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 8, 8, 0.32)',
    left: '72%',
  },
  envGradientFadeHigh: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 8, 8, 0.28)',
    top: '68%',
  },
  envGradientFadeMid: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 8, 8, 0.22)',
    top: '78%',
  },
  envGradientFadeLow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 8, 8, 0.18)',
    top: '88%',
  },
  safeArea: {
    flex: 1,
  },
  centeredSafeArea: {
    alignItems: 'center',
    flex: 1,
    gap: Spacing.two,
    justifyContent: 'center',
  },
  scrollContent: {
    alignSelf: 'center',
    flexGrow: 1,
    maxWidth: MaxContentWidth,
    paddingBottom: Spacing.six,
    width: '100%',
  },
  walletCard: {
    backgroundColor: 'rgba(14, 14, 14, 0.88)',
    borderColor: 'rgba(255, 255, 255, 0.09)',
    borderRadius: WALLET_CARD_RADIUS,
    borderWidth: 1,
    gap: Spacing.three,
    marginHorizontal: Spacing.three,
    paddingBottom: Spacing.four,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four + 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: Platform.select({ web: 0.55, default: 0.45 }) ?? 0.45,
    shadowRadius: 40,
  },
  eventTitle: {
    color: '#FFFFFF',
    fontFamily: FAN_SANS,
    fontSize: 38,
    fontWeight: '700',
    letterSpacing: -0.8,
    lineHeight: 44,
  },
  metaStack: {
    gap: 5,
  },
  metaVenue: {
    color: '#EDEDED',
    fontFamily: FAN_SANS,
    fontSize: 19,
    fontWeight: '500',
    letterSpacing: -0.2,
    lineHeight: 26,
  },
  metaDate: {
    color: '#A8ADB5',
    fontFamily: FAN_SANS,
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 22,
  },
  metaTime: {
    color: FanAccent,
    fontFamily: FAN_SANS,
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 22,
  },
  walletDivider: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    height: 1,
    marginVertical: Spacing.one,
    width: '100%',
  },
  holderBlock: {
    gap: 4,
  },
  holderLabel: {
    color: '#7E848C',
    fontFamily: FAN_SANS,
    fontSize: 12,
    fontWeight: '500',
  },
  holderName: {
    color: '#FFFFFF',
    fontFamily: FAN_SANS,
    fontSize: 26,
    fontWeight: '600',
    letterSpacing: -0.2,
    lineHeight: 32,
  },
  qrSlot: {
    alignItems: 'center',
    marginTop: Spacing.one,
    width: '100%',
  },
  passTypeBadge: {
    alignSelf: 'center',
    backgroundColor: 'rgba(162, 91, 255, 0.14)',
    borderRadius: 999,
    marginTop: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
  },
  passTypeBadgeText: {
    color: '#E2CCFF',
    fontFamily: FAN_SANS,
    fontSize: 13,
    fontWeight: '600',
  },
  statusBanner: {
    backgroundColor: 'rgba(20, 20, 20, 0.82)',
    borderColor: FanAccentBright,
    borderLeftWidth: 3,
    borderRadius: 12,
    marginHorizontal: Spacing.three,
    marginTop: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
  },
  statusBannerText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  footerActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
    justifyContent: 'center',
    marginTop: Spacing.four,
    paddingHorizontal: Spacing.four,
  },
  footerAction: {
    opacity: 0.55,
    paddingVertical: Spacing.one,
  },
  footerActionLabel: {
    color: '#E2E4E8',
    fontFamily: FAN_SANS,
    fontSize: 14,
    fontWeight: '500',
  },
  footerDot: {
    color: 'rgba(255, 255, 255, 0.25)',
    fontSize: 14,
  },
  loadingText: {
    marginTop: Spacing.two,
  },
  errorSafeArea: {
    flex: 1,
    gap: Spacing.two,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  errorTitle: {
    color: '#FFFFFF',
    fontFamily: FAN_SANS,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.4,
    lineHeight: 38,
  },
  errorBody: {
    fontSize: 16,
    lineHeight: 24,
  },
});
