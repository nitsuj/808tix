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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PassQrCode } from '@/components/pass/pass-qr-code';
import { ArtworkEnvironment } from '@/components/ui/artwork-environment';
import { ThemedText } from '@/components/themed-text';
import {
  fan,
  fontFamily,
  layout,
  passScreen,
  shadows,
  spacing,
  surface,
  text,
  typeScale,
} from '@/theme';
import { getPassStatusBanner } from '@/lib/pass-display';
import { resolvePassArtworkUri } from '@/lib/event-artwork-display';
import type { PublicPassView } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

const FAN_SANS = Platform.select({
  ios: fontFamily?.sans ?? 'System',
  android: 'sans-serif',
  default: fontFamily?.sans ?? 'System',
});

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
          <ActivityIndicator size="large" color={fan.primary} />
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

function GuestPassView({ pass }: { pass: PublicPassView }) {
  const { height: windowHeight } = useWindowDimensions();
  const statusBanner = getPassStatusBanner(pass.status);
  const isEntryValid = pass.status === 'active';
  const passTypeLabel = titleCaseLabel(pass.pass_type);
  const hasUploadedArtwork = Boolean(pass.image_url?.trim());
  const artworkUri = resolvePassArtworkUri(pass.image_url, pass.event_name);
  const cardTopInset = Math.max(72, Math.round(windowHeight * 0.22));

  const { dateLine, timeLine } = useMemo(() => {
    return {
      dateLine: formatPassDateLine(pass.event_date),
      timeLine: formatPassTimeLine(pass.start_time),
    };
  }, [pass.event_date, pass.start_time]);

  return (
    <View style={styles.container}>
      <ArtworkEnvironment artworkUri={artworkUri} isUploaded={hasUploadedArtwork} />

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
    backgroundColor: surface.background,
    flex: 1,
    position: 'relative',
  },
  safeArea: {
    flex: 1,
    zIndex: 1,
  },
  centeredSafeArea: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.two,
    justifyContent: 'center',
  },
  scrollContent: {
    alignSelf: 'center',
    flexGrow: 1,
    maxWidth: layout.maxContentWidth,
    paddingBottom: spacing.six,
    width: '100%',
  },
  walletCard: {
    backgroundColor: passScreen.credential.cardBackground,
    borderColor: passScreen.credential.cardBorder,
    borderRadius: passScreen.credential.borderRadius,
    borderWidth: 1,
    gap: spacing.three,
    marginHorizontal: passScreen.credential.marginHorizontal,
    paddingBottom: passScreen.credential.paddingBottom,
    paddingHorizontal: passScreen.credential.paddingHorizontal,
    paddingTop: passScreen.credential.paddingTop,
    shadowColor: shadows.walletCard.shadowColor,
    shadowOffset: shadows.walletCard.shadowOffset,
    shadowOpacity: shadows.walletCard.shadowOpacity,
    shadowRadius: shadows.walletCard.shadowRadius,
  },
  eventTitle: {
    color: text.primary,
    fontFamily: FAN_SANS,
    ...typeScale.passTitle,
  },
  metaStack: {
    gap: 5,
  },
  metaVenue: {
    color: text.venue,
    fontFamily: FAN_SANS,
    ...typeScale.passVenue,
  },
  metaDate: {
    color: text.tertiary,
    fontFamily: FAN_SANS,
    ...typeScale.passMeta,
  },
  metaTime: {
    color: fan.primary,
    fontFamily: FAN_SANS,
    fontSize: typeScale.passMeta.fontSize,
    fontWeight: '500',
    lineHeight: typeScale.passMeta.lineHeight,
  },
  walletDivider: {
    backgroundColor: passScreen.credential.divider,
    height: 1,
    marginVertical: spacing.one,
    width: '100%',
  },
  holderBlock: {
    gap: 4,
  },
  holderLabel: {
    color: text.muted,
    fontFamily: FAN_SANS,
    fontSize: 12,
    fontWeight: '500',
  },
  holderName: {
    color: text.primary,
    fontFamily: FAN_SANS,
    ...typeScale.passHolderName,
  },
  qrSlot: {
    alignItems: 'center',
    marginTop: spacing.one,
    width: '100%',
  },
  passTypeBadge: {
    alignSelf: 'center',
    backgroundColor: passScreen.passTypeBadge.backgroundColor,
    borderRadius: passScreen.passTypeBadge.borderRadius,
    marginTop: spacing.one,
    paddingHorizontal: spacing.three,
    paddingVertical: spacing.one + 2,
  },
  passTypeBadgeText: {
    color: passScreen.passTypeBadge.textColor,
    fontFamily: FAN_SANS,
    fontSize: 13,
    fontWeight: '600',
  },
  statusBanner: {
    backgroundColor: passScreen.statusBanner.backgroundColor,
    borderColor: fan.bright,
    borderLeftWidth: 3,
    borderRadius: passScreen.statusBanner.borderRadius,
    marginHorizontal: passScreen.statusBanner.marginHorizontal,
    marginTop: spacing.three,
    paddingHorizontal: spacing.three,
    paddingVertical: spacing.two + 2,
  },
  statusBannerText: {
    color: text.primary,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  footerActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.two,
    justifyContent: 'center',
    marginTop: spacing.four,
    paddingHorizontal: spacing.four,
  },
  footerAction: {
    opacity: passScreen.footerActionOpacity,
    paddingVertical: spacing.one,
  },
  footerActionLabel: {
    color: text.footer,
    fontFamily: FAN_SANS,
    fontSize: 14,
    fontWeight: '500',
  },
  footerDot: {
    color: text.dotSeparator,
    fontSize: 14,
  },
  loadingText: {
    marginTop: spacing.two,
  },
  errorSafeArea: {
    flex: 1,
    gap: spacing.two,
    justifyContent: 'center',
    paddingHorizontal: spacing.four,
  },
  errorTitle: {
    color: text.primary,
    fontFamily: FAN_SANS,
    ...typeScale.screenTitle,
  },
  errorBody: {
    fontSize: 16,
    lineHeight: 24,
  },
});
