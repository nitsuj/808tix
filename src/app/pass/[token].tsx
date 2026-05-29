import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { FanAccent, MaxContentWidth, Spacing } from '@/constants/theme';
import { formatEventDateLabel } from '@/lib/event-display';
import type { PublicPassView } from '@/lib/database.types';
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
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" color={FanAccent} />
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

  const dateLabel = formatEventDateLabel(pass.event_date, pass.start_time);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <ThemedText themeColor="textSecondary" type="small">
            Your pass
          </ThemedText>
          <ThemedText type="subtitle" style={styles.title}>
            {pass.event_name}
          </ThemedText>

          <ThemedView style={styles.card}>
            <ThemedText style={styles.guestName}>{pass.guest_name}</ThemedText>
            <ThemedText themeColor="textSecondary">{pass.pass_type}</ThemedText>
            {pass.venue_name ? (
              <ThemedText themeColor="textSecondary" style={styles.meta}>
                {pass.venue_name}
              </ThemedText>
            ) : null}
            {dateLabel ? (
              <ThemedText themeColor="textSecondary" style={styles.meta}>
                {dateLabel}
              </ThemedText>
            ) : null}
            <ThemedText style={styles.status}>Status: {pass.status}</ThemedText>
          </ThemedView>

          <ThemedText themeColor="textSecondary" style={styles.hint}>
            QR check-in view is coming next. This link confirms the pass exists.
          </ThemedText>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: FanAccent,
    fontSize: 28,
    lineHeight: 34,
  },
  card: {
    borderColor: FanAccent,
    borderLeftWidth: 3,
    borderRadius: Spacing.three,
    borderWidth: 1,
    gap: Spacing.two,
    padding: Spacing.four,
  },
  guestName: {
    fontSize: 22,
    fontWeight: '700',
  },
  meta: {
    fontSize: 15,
  },
  status: {
    color: FanAccent,
    fontSize: 14,
    fontWeight: '600',
    marginTop: Spacing.one,
    textTransform: 'capitalize',
  },
  hint: {
    lineHeight: 20,
  },
  errorText: {
    color: '#ff6b6b',
    padding: Spacing.four,
  },
});
