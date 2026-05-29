import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, OrganizerAccent, Spacing } from '@/constants/theme';
import { useOrganizerEvents } from '@/hooks/use-organizer-events';
import type { Event } from '@/lib/database.types';

type OrganizerDashboardProps = {
  organizerId: string;
  displayName: string;
  displayEmail: string;
  onSignOut: () => Promise<void>;
};

export function OrganizerDashboard({
  organizerId,
  displayName,
  displayEmail,
  onSignOut,
}: OrganizerDashboardProps) {
  const router = useRouter();
  const { upcomingEvents, isLoading, error, refetch } = useOrganizerEvents(organizerId);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  async function handleSignOut() {
    setIsSigningOut(true);
    setSignOutError(null);

    try {
      await onSignOut();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign out failed.';
      setSignOutError(message);
    } finally {
      setIsSigningOut(false);
    }
  }

  function handleCreateEventPress() {
    router.push('/events/create' as Href);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <ThemedText type="subtitle" style={styles.appTitle}>
                808Tix
              </ThemedText>
              <ThemedText style={styles.organizerName}>{displayName}</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.organizerEmail}>
                {displayEmail}
              </ThemedText>
            </View>

            <Pressable
              disabled={isSigningOut}
              onPress={handleSignOut}
              style={({ pressed }) => [styles.signOutButton, pressed && styles.signOutPressed]}>
              {isSigningOut ? (
                <ActivityIndicator color={OrganizerAccent} size="small" />
              ) : (
                <ThemedText style={styles.signOutText}>Sign out</ThemedText>
              )}
            </Pressable>
          </View>

          {signOutError ? <ThemedText style={styles.errorText}>{signOutError}</ThemedText> : null}

          <Pressable
            onPress={handleCreateEventPress}
            style={({ pressed }) => [styles.createButton, pressed && styles.createButtonPressed]}>
            <ThemedText style={styles.createButtonText}>Create Event</ThemedText>
          </Pressable>

          <View style={styles.sectionHeader}>
            <ThemedText type="smallBold" style={styles.sectionTitle}>
              Upcoming Events
            </ThemedText>
            {!isLoading && !error ? (
              <ThemedText themeColor="textSecondary" type="small">
                {upcomingEvents.length}
              </ThemedText>
            ) : null}
          </View>

          {isLoading ? (
            <ThemedView style={styles.stateCard}>
              <ActivityIndicator color={OrganizerAccent} />
              <ThemedText themeColor="textSecondary" style={styles.stateText}>
                Loading events…
              </ThemedText>
            </ThemedView>
          ) : null}

          {!isLoading && error ? (
            <ThemedView style={styles.stateCard}>
              <ThemedText style={styles.errorText}>{error}</ThemedText>
              <Pressable onPress={refetch} style={styles.retryButton}>
                <ThemedText style={styles.retryText}>Try again</ThemedText>
              </Pressable>
            </ThemedView>
          ) : null}

          {!isLoading && !error && upcomingEvents.length === 0 ? (
            <ThemedView style={styles.stateCard}>
              <ThemedText style={styles.emptyTitle}>No Events Yet</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.stateText}>
                Create your first event to start issuing passes.
              </ThemedText>
            </ThemedView>
          ) : null}

          {!isLoading && !error
            ? upcomingEvents.map((event) => (
                <EventCard key={event.id} event={event} onPress={() => router.push(`/events/${event.id}` as Href)} />
              ))
            : null}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function EventCard({ event, onPress }: { event: Event; onPress: () => void }) {
  const dateLabel = formatEventDate(event.event_date, event.start_time);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && styles.eventCardPressed]}>
      <ThemedView style={styles.eventCard}>
        <ThemedText style={styles.eventName}>{event.name}</ThemedText>
        {event.venue_name ? (
          <ThemedText themeColor="textSecondary" style={styles.eventMeta}>
            {event.venue_name}
          </ThemedText>
        ) : null}
        {dateLabel ? (
          <ThemedText themeColor="textSecondary" style={styles.eventMeta}>
            {dateLabel}
          </ThemedText>
        ) : null}
        <ThemedText themeColor="textSecondary" style={styles.eventMeta}>
          {event.capacity} max passes
        </ThemedText>
        <ThemedText style={styles.eventStatus}>{formatStatus(event.status)}</ThemedText>
      </ThemedView>
    </Pressable>
  );
}

function formatEventDate(eventDate: string | null, startTime: string | null): string | null {
  if (!eventDate) {
    return null;
  }

  const parsed = new Date(`${eventDate}T${startTime ?? '00:00:00'}`);

  if (Number.isNaN(parsed.getTime())) {
    return eventDate;
  }

  const datePart = parsed.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  if (!startTime) {
    return datePart;
  }

  const timePart = parsed.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });

  return `${datePart} · ${timePart}`;
}

function formatStatus(status: Event['status']): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
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
    paddingTop: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: Spacing.three,
    justifyContent: 'space-between',
  },
  headerText: {
    flex: 1,
    gap: Spacing.half,
  },
  appTitle: {
    color: OrganizerAccent,
    fontSize: 28,
    lineHeight: 34,
  },
  organizerName: {
    fontSize: 18,
    fontWeight: '600',
  },
  organizerEmail: {
    fontSize: 14,
  },
  signOutButton: {
    paddingHorizontal: Spacing.one,
    paddingVertical: Spacing.one,
  },
  signOutPressed: {
    opacity: 0.7,
  },
  signOutText: {
    color: OrganizerAccent,
    fontSize: 14,
    fontWeight: '600',
  },
  createButton: {
    alignItems: 'center',
    backgroundColor: OrganizerAccent,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
  },
  createButtonPressed: {
    opacity: 0.85,
  },
  createButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.one,
  },
  sectionTitle: {
    color: OrganizerAccent,
    fontSize: 16,
    textTransform: 'uppercase',
  },
  stateCard: {
    alignItems: 'center',
    borderColor: '#2a2a2a',
    borderRadius: Spacing.three,
    borderWidth: 1,
    gap: Spacing.two,
    padding: Spacing.four,
  },
  stateText: {
    textAlign: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  eventCardPressed: {
    opacity: 0.85,
  },
  eventCard: {
    borderColor: '#2a2a2a',
    borderLeftColor: OrganizerAccent,
    borderLeftWidth: 3,
    borderRadius: Spacing.three,
    borderWidth: 1,
    gap: Spacing.one,
    padding: Spacing.three,
  },
  eventName: {
    fontSize: 17,
    fontWeight: '600',
  },
  eventMeta: {
    fontSize: 14,
  },
  eventStatus: {
    color: OrganizerAccent,
    fontSize: 12,
    fontWeight: '600',
    marginTop: Spacing.one,
    textTransform: 'uppercase',
  },
  errorText: {
    color: '#ff6b6b',
  },
  retryButton: {
    paddingVertical: Spacing.one,
  },
  retryText: {
    color: OrganizerAccent,
    fontWeight: '600',
  },
});
