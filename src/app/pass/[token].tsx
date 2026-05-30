import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PassQrCode } from '@/components/pass/pass-qr-code';
import { ThemedText } from '@/components/themed-text';
import { EventArtwork } from '@/components/ui/event-artwork';
import {
  FanAccent,
  FanAccentBright,
  MaxContentWidth,
  Radii,
  Spacing,
  Surface,
} from '@/constants/theme';
import { formatEventDateLabel } from '@/lib/event-display';
import { formatPassStatusLabel, getPassStatusBanner } from '@/lib/pass-display';
import type { PassStatus, PublicPassView } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

export default function GuestPassScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const secureToken = typeof token === 'string' ? token.trim() : '';

  if (!secureToken) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText style={styles.errorText}>Pass link is invalid.</ThemedText>
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
        <View style={styles.ambientGlowLarge} />
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
        <View style={styles.ambientGlowLarge} />
        <View style={styles.ambientGlowSmall} />
        <SafeAreaView style={styles.errorSafeArea}>
          <ThemedText style={styles.inviteEyebrow}>808Tix Pass</ThemedText>
          <ThemedText style={styles.errorTitle}>Pass unavailable</ThemedText>
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
  const dateLabel = formatEventDateLabel(pass.event_date, pass.start_time);
  const statusBanner = getPassStatusBanner(pass.status);
  const isEntryValid = pass.status === 'active';

  return (
    <View style={styles.container}>
      <View style={styles.ambientGlowLarge} />
      <View style={styles.ambientGlowSmall} />

      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <EventArtwork height={280} imageUrl={pass.image_url} name={pass.event_name} />

          <View style={styles.inviteBlock}>
            <ThemedText style={styles.inviteEyebrow}>Your pass</ThemedText>
            <ThemedText style={styles.eventTitle}>{pass.event_name}</ThemedText>

            {pass.venue_name ? (
              <ThemedText themeColor="textSecondary" style={styles.metaLine}>
                {pass.venue_name}
              </ThemedText>
            ) : null}

            {dateLabel ? (
              <ThemedText themeColor="textSecondary" style={styles.metaLine}>
                {dateLabel}
              </ThemedText>
            ) : null}

            <ThemedText style={styles.passType}>{pass.pass_type}</ThemedText>
            <ThemedText style={styles.guestName}>{pass.guest_name}</ThemedText>
            <PassStatusPill status={pass.status} />
          </View>

          {statusBanner ? (
            <View style={styles.statusBanner}>
              <ThemedText style={styles.statusBannerText}>{statusBanner}</ThemedText>
            </View>
          ) : null}

          <View style={styles.qrCard}>
            <ThemedText style={styles.qrHeading}>Show at the door</ThemedText>
            <PassQrCode dimmed={!isEntryValid} secureToken={pass.secure_token} />
            <ThemedText themeColor="textSecondary" style={styles.qrHint}>
              {isEntryValid
                ? 'Brighten your screen and hold steady for staff to scan.'
                : 'This code is shown for reference only.'}
            </ThemedText>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function PassStatusPill({ status }: { status: PassStatus }) {
  const label = formatPassStatusLabel(status);
  const isActive = status === 'active';

  return (
    <View style={[styles.statusPill, isActive ? styles.statusPillActive : styles.statusPillInactive]}>
      <ThemedText style={[styles.statusPillText, isActive ? styles.statusPillTextActive : null]}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Surface.background,
    flex: 1,
  },
  ambientGlowLarge: {
    backgroundColor: FanAccent,
    borderRadius: 999,
    height: 220,
    left: -40,
    opacity: 0.12,
    position: 'absolute',
    top: 80,
    width: 220,
  },
  ambientGlowSmall: {
    backgroundColor: FanAccentBright,
    borderRadius: 999,
    height: 140,
    opacity: 0.1,
    position: 'absolute',
    right: -20,
    top: 260,
    width: 140,
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
    gap: Spacing.four,
    maxWidth: MaxContentWidth,
    paddingBottom: Spacing.six,
    width: '100%',
  },
  inviteBlock: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
  inviteEyebrow: {
    color: FanAccentBright,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  eventTitle: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.4,
    lineHeight: 40,
  },
  metaLine: {
    fontSize: 17,
    lineHeight: 24,
  },
  passType: {
    color: FanAccent,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginTop: Spacing.one,
    textTransform: 'uppercase',
  },
  guestName: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
  },
  statusBanner: {
    backgroundColor: Surface.card,
    borderColor: FanAccentBright,
    borderLeftWidth: 4,
    borderRadius: Radii.card,
    marginHorizontal: Spacing.four,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  statusBannerText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
  },
  statusPill: {
    alignSelf: 'flex-start',
    borderRadius: Radii.input,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  statusPillActive: {
    backgroundColor: 'rgba(162, 91, 255, 0.25)',
    borderColor: FanAccent,
    borderWidth: 1,
  },
  statusPillInactive: {
    backgroundColor: Surface.secondary,
    borderColor: Surface.divider,
    borderWidth: 1,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  statusPillTextActive: {
    color: '#FFFFFF',
  },
  qrCard: {
    alignItems: 'center',
    backgroundColor: Surface.card,
    borderColor: Surface.divider,
    borderRadius: Radii.card,
    borderWidth: 1,
    gap: Spacing.three,
    marginHorizontal: Spacing.four,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.four,
  },
  qrHeading: {
    color: FanAccentBright,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  qrHint: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
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
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 38,
  },
  errorBody: {
    fontSize: 16,
    lineHeight: 24,
  },
  errorText: {
    color: '#FF6B6B',
    padding: Spacing.four,
  },
});
