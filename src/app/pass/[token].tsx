import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PassQrCode } from '@/components/pass/pass-qr-code';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  FanAccent,
  FanAccentBright,
  FanAccentMuted,
  MaxContentWidth,
  Spacing,
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
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText style={styles.errorText}>Pass link is invalid.</ThemedText>
        </SafeAreaView>
      </ThemedView>
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
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.centeredSafeArea}>
          <ActivityIndicator size="large" color={FanAccent} />
          <ThemedText themeColor="textSecondary" style={styles.loadingText}>
            Loading your pass…
          </ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (error || !pass) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText style={styles.errorText}>{error ?? 'Pass not found.'}</ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return <GuestPassView pass={pass} />;
}

function GuestPassView({ pass }: { pass: PublicPassView }) {
  const dateLabel = formatEventDateLabel(pass.event_date, pass.start_time);
  const statusBanner = getPassStatusBanner(pass.status);
  const isEntryValid = pass.status === 'active';

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <ThemedText themeColor="textSecondary" type="small" style={styles.eyebrow}>
            Your pass
          </ThemedText>

          <ThemedText type="subtitle" style={styles.eventTitle}>
            {pass.event_name}
          </ThemedText>

          {pass.venue_name ? (
            <ThemedText themeColor="textSecondary" style={styles.venue}>
              {pass.venue_name}
            </ThemedText>
          ) : null}

          {dateLabel ? (
            <ThemedText themeColor="textSecondary" style={styles.dateTime}>
              {dateLabel}
            </ThemedText>
          ) : null}

          {statusBanner ? (
            <View style={styles.statusBanner}>
              <ThemedText style={styles.statusBannerText}>{statusBanner}</ThemedText>
            </View>
          ) : null}

          <ThemedView type="backgroundElement" style={styles.guestCard}>
            <ThemedText style={styles.guestName}>{pass.guest_name}</ThemedText>
            <ThemedText style={styles.passType}>{pass.pass_type}</ThemedText>
            <PassStatusPill status={pass.status} />
          </ThemedView>

          <View style={styles.qrSection}>
            <ThemedText style={styles.qrHeading}>Scan at the door</ThemedText>
            <PassQrCode dimmed={!isEntryValid} secureToken={pass.secure_token} />
            {isEntryValid ? (
              <ThemedText themeColor="textSecondary" style={styles.qrHint}>
                Brighten your screen and hold steady for staff to scan.
              </ThemedText>
            ) : (
              <ThemedText themeColor="textSecondary" style={styles.qrHint}>
                This code is shown for reference only.
              </ThemedText>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function PassStatusPill({ status }: { status: PassStatus }) {
  const label = formatPassStatusLabel(status);
  const isActive = status === 'active';

  return (
    <View
      style={[
        styles.statusPill,
        isActive ? styles.statusPillActive : styles.statusPillInactive,
      ]}>
      <ThemedText
        style={[styles.statusPillText, isActive ? styles.statusPillTextActive : null]}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  safeArea: {
    flex: 1,
  },
  centeredSafeArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  scrollContent: {
    gap: Spacing.three,
    paddingBottom: Spacing.six,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  eyebrow: {
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  eventTitle: {
    color: FanAccent,
    fontSize: 30,
    fontWeight: '700',
    lineHeight: 36,
  },
  venue: {
    fontSize: 17,
    fontWeight: '500',
    marginTop: -Spacing.one,
  },
  dateTime: {
    fontSize: 16,
    marginTop: -Spacing.one,
  },
  statusBanner: {
    backgroundColor: '#2E3135',
    borderColor: FanAccentBright,
    borderLeftWidth: 4,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  statusBannerText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
  guestCard: {
    borderColor: FanAccentMuted,
    borderRadius: Spacing.three,
    borderWidth: 1,
    gap: Spacing.two,
    padding: Spacing.four,
  },
  guestName: {
    fontSize: 24,
    fontWeight: '700',
  },
  passType: {
    color: FanAccentBright,
    fontSize: 16,
    fontWeight: '600',
  },
  statusPill: {
    alignSelf: 'flex-start',
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  statusPillActive: {
    backgroundColor: FanAccentMuted,
  },
  statusPillInactive: {
    backgroundColor: '#2E3135',
    borderColor: '#444',
    borderWidth: 1,
  },
  statusPillText: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  statusPillTextActive: {
    color: '#FFFFFF',
  },
  qrSection: {
    alignItems: 'center',
    gap: Spacing.three,
    marginTop: Spacing.one,
  },
  qrHeading: {
    color: FanAccent,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  qrHint: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  loadingText: {
    marginTop: Spacing.two,
  },
  errorText: {
    color: '#ff6b6b',
    padding: Spacing.four,
  },
});
