import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MissingProfileScreen } from '@/components/organizer/missing-profile-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, OrganizerAccent, Spacing } from '@/constants/theme';
import { useOrganizerAuthGate } from '@/hooks/use-organizer-auth-gate';
import {
  formatEventDateLabel,
  formatEventStatus,
  formatIssuedCapacity,
  formatTimeForInput,
} from '@/lib/event-display';
import { useEventDetail } from '@/hooks/use-event-detail';

export default function EventDetailScreen() {
  const router = useRouter();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const authGate = useOrganizerAuthGate();
  const { event, issuedCount, isLoading, error, refetch } = useEventDetail(eventId);

  useFocusEffect(
    useCallback(() => {
      if (authGate.state === 'ready') {
        void refetch();
      }
    }, [authGate.state, refetch]),
  );

  if (authGate.state === 'loading' || isLoading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" color={OrganizerAccent} />
      </ThemedView>
    );
  }

  if (authGate.state === 'unauthenticated') {
    router.replace('/');
    return null;
  }

  if (authGate.state === 'profile_missing') {
    return <MissingProfileScreen email={authGate.email} onSignOut={authGate.signOut} />;
  }

  if (error || !event) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <ThemedText style={styles.backText}>Back</ThemedText>
          </Pressable>
          <ThemedText style={styles.errorText}>{error ?? 'Event not found.'}</ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const dateLabel = formatEventDateLabel(event.event_date, event.start_time);
  const startTimeLabel = formatTimeForInput(event.start_time) || '—';

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <ThemedText style={styles.backText}>Back to Dashboard</ThemedText>
          </Pressable>

          <ThemedText type="subtitle" style={styles.title}>
            {event.name}
          </ThemedText>

          <ThemedView style={styles.card}>
            <DetailRow label="Venue" value={event.venue_name ?? '—'} />
            <DetailRow label="Date" value={dateLabel ?? event.event_date ?? '—'} />
            <DetailRow label="Start Time" value={startTimeLabel} />
            <DetailRow label="Status" value={formatEventStatus(event.status)} accent />
            <DetailRow label="Slug" value={event.slug} mono />
            <DetailRow
              accent
              label="Passes"
              value={formatIssuedCapacity(issuedCount, event.capacity)}
            />
          </ThemedView>

          <Pressable
            onPress={() => router.push(`/events/${event.id}/edit` as Href)}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
            <ThemedText style={styles.primaryButtonText}>Edit Event</ThemedText>
          </Pressable>

          <Pressable
            disabled
            onPress={() => Alert.alert('Coming soon', 'Publishing events is the next step.')}
            style={styles.comingSoonButton}>
            <ThemedText style={styles.comingSoonButtonText}>Publish Event Coming Soon</ThemedText>
          </Pressable>

          <Pressable
            onPress={() => router.push(`/events/${event.id}/issue` as Href)}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
            <ThemedText style={styles.secondaryButtonText}>Issue Pass</ThemedText>
          </Pressable>

          <Pressable
            onPress={() => Alert.alert('Coming soon', 'Scanner mode is the next step.')}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
            <ThemedText style={styles.secondaryButtonText}>Scanner Coming Soon</ThemedText>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function DetailRow({
  label,
  value,
  accent,
  mono,
}: {
  label: string;
  value: string;
  accent?: boolean;
  mono?: boolean;
}) {
  return (
    <View style={styles.detailRow}>
      <ThemedText themeColor="textSecondary" type="small">
        {label}
      </ThemedText>
      <ThemedText
        style={[styles.detailValue, accent && styles.accentValue, mono && styles.monoValue]}>
        {value}
      </ThemedText>
    </View>
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
  backButton: {
    paddingVertical: Spacing.one,
  },
  backText: {
    color: OrganizerAccent,
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
  },
  card: {
    borderColor: '#2a2a2a',
    borderLeftColor: OrganizerAccent,
    borderLeftWidth: 3,
    borderRadius: Spacing.three,
    borderWidth: 1,
    gap: Spacing.three,
    padding: Spacing.four,
  },
  detailRow: {
    gap: Spacing.half,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  accentValue: {
    color: OrganizerAccent,
  },
  monoValue: {
    fontFamily: 'monospace',
    fontSize: 14,
    fontWeight: '500',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: OrganizerAccent,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
  },
  primaryButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: OrganizerAccent,
    borderRadius: Spacing.two,
    borderWidth: 1,
    paddingVertical: Spacing.three,
  },
  secondaryButtonText: {
    color: OrganizerAccent,
    fontSize: 16,
    fontWeight: '600',
  },
  comingSoonButton: {
    alignItems: 'center',
    borderColor: '#444',
    borderRadius: Spacing.two,
    borderWidth: 1,
    opacity: 0.55,
    paddingVertical: Spacing.three,
  },
  comingSoonButtonText: {
    color: '#888',
    fontSize: 16,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.85,
  },
  errorText: {
    color: '#ff6b6b',
    marginTop: Spacing.three,
  },
});
