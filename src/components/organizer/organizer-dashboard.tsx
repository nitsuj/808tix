import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { EventArtwork } from '@/components/ui/event-artwork';
import { StatBlock, StatRow } from '@/components/ui/stat-block';
import {
  MaxContentWidth,
  OrganizerAccent,
  OrganizerAccentTextOn,
  Radii,
  Spacing,
  Surface,
  semantic,
} from '@/constants/theme';
import { useOrganizerEvents } from '@/hooks/use-organizer-events';
import type { Event } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

type EventPassStats = {
  issued: number;
  checkedIn: number;
};

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
  const [statsByEvent, setStatsByEvent] = useState<Record<string, EventPassStats>>({});

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  useEffect(() => {
    let cancelled = false;

    async function loadPassStats() {
      if (upcomingEvents.length === 0) {
        setStatsByEvent({});
        return;
      }

      const eventIds = upcomingEvents.map((event) => event.id);
      const { data } = await supabase
        .from('passes')
        .select('event_id, status')
        .in('event_id', eventIds)
        .in('status', ['active', 'checked_in']);

      if (cancelled) {
        return;
      }

      const nextStats: Record<string, EventPassStats> = {};

      for (const eventId of eventIds) {
        nextStats[eventId] = { issued: 0, checkedIn: 0 };
      }

      for (const row of data ?? []) {
        const bucket = nextStats[row.event_id];

        if (!bucket) {
          continue;
        }

        bucket.issued += 1;

        if (row.status === 'checked_in') {
          bucket.checkedIn += 1;
        }
      }

      setStatsByEvent(nextStats);
    }

    void loadPassStats();

    return () => {
      cancelled = true;
    };
  }, [upcomingEvents]);

  const aggregateStats = useMemo(() => {
    let issued = 0;
    let checkedIn = 0;

    for (const stats of Object.values(statsByEvent)) {
      issued += stats.issued;
      checkedIn += stats.checkedIn;
    }

    const checkInRate = issued > 0 ? Math.round((checkedIn / issued) * 100) : 0;

    return {
      events: upcomingEvents.length,
      issued,
      checkedIn,
      checkInRate,
    };
  }, [statsByEvent, upcomingEvents.length]);

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

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.headerRow}>
            <View style={styles.headerText}>
              <ThemedText style={styles.screenTitle}>Overview</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.organizerMeta}>
                {displayName} · {displayEmail}
              </ThemedText>
            </View>

            <Pressable
              disabled={isSigningOut}
              onPress={handleSignOut}
              style={({ pressed }) => [styles.signOutButton, pressed && styles.pressed]}>
              {isSigningOut ? (
                <ActivityIndicator color={OrganizerAccent} size="small" />
              ) : (
                <ThemedText style={styles.signOutText}>Sign out</ThemedText>
              )}
            </Pressable>
          </View>

          {signOutError ? <ThemedText style={styles.errorText}>{signOutError}</ThemedText> : null}

          <Pressable
            onPress={() => router.push('/events/create' as Href)}
            style={({ pressed }) => [styles.createButton, pressed && styles.pressed]}>
            <ThemedText style={styles.createButtonText}>+ Create Event</ThemedText>
          </Pressable>

          {!isLoading && !error ? (
            <StatRow>
              <StatBlock compact label="Events" value={String(aggregateStats.events)} />
              <StatBlock compact label="Passes Issued" value={String(aggregateStats.issued)} />
              <StatBlock compact label="Checked In" value={String(aggregateStats.checkedIn)} />
              <StatBlock
                compact
                label="Check-In Rate"
                value={`${aggregateStats.checkInRate}%`}
              />
            </StatRow>
          ) : null}

          <ThemedText style={styles.sectionTitle}>Today&apos;s Events</ThemedText>

          {isLoading ? (
            <View style={styles.stateCard}>
              <ActivityIndicator color={OrganizerAccent} />
              <ThemedText themeColor="textSecondary">Loading events…</ThemedText>
            </View>
          ) : null}

          {!isLoading && error ? (
            <View style={styles.stateCard}>
              <ThemedText style={styles.errorText}>{error}</ThemedText>
              <Pressable onPress={refetch}>
                <ThemedText style={styles.linkText}>Try again</ThemedText>
              </Pressable>
            </View>
          ) : null}

          {!isLoading && !error && upcomingEvents.length === 0 ? (
            <View style={styles.stateCard}>
              <ThemedText style={styles.emptyTitle}>No events yet</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.emptyBody}>
                Create your first event to start issuing passes.
              </ThemedText>
            </View>
          ) : null}

          {!isLoading && !error
            ? upcomingEvents.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  stats={statsByEvent[event.id] ?? { issued: 0, checkedIn: 0 }}
                  onPress={() => router.push(`/events/${event.id}` as Href)}
                />
              ))
            : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function EventCard({
  event,
  stats,
  onPress,
}: {
  event: Event;
  stats: EventPassStats;
  onPress: () => void;
}) {
  const dateLabel = formatEventDate(event.event_date, event.start_time);
  const checkInRate = stats.issued > 0 ? Math.round((stats.checkedIn / stats.issued) * 100) : 0;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.eventCard, pressed && styles.pressed]}>
      <EventArtwork height={88} imageUrl={event.image_url} name={event.name} rounded={false} />
      <View style={styles.eventCardBody}>
        <View style={styles.eventCardTop}>
          <View style={styles.eventCardInfo}>
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
          </View>
          <ThemedText style={styles.chevron}>›</ThemedText>
        </View>

        <View style={styles.eventStatsRow}>
          <MiniStat label="Issued" value={String(stats.issued)} />
          <MiniStat label="Checked In" value={String(stats.checkedIn)} />
          <MiniStat label="Rate" value={`${checkInRate}%`} />
        </View>
      </View>
    </Pressable>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.miniStat}>
      <ThemedText style={styles.miniStatValue}>{value}</ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.miniStatLabel}>
        {label}
      </ThemedText>
    </View>
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

const styles = StyleSheet.create({
  container: {
    backgroundColor: Surface.background,
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    alignSelf: 'center',
    gap: Spacing.three,
    maxWidth: MaxContentWidth,
    paddingBottom: Spacing.six,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    width: '100%',
  },
  headerRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: Spacing.three,
    justifyContent: 'space-between',
  },
  headerText: {
    flex: 1,
    gap: Spacing.one,
  },
  screenTitle: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 40,
  },
  organizerMeta: {
    fontSize: 13,
  },
  signOutButton: {
    paddingVertical: Spacing.one,
  },
  signOutText: {
    color: OrganizerAccent,
    fontSize: 14,
    fontWeight: '600',
  },
  createButton: {
    alignItems: 'center',
    backgroundColor: OrganizerAccent,
    borderRadius: Radii.button,
    paddingVertical: Spacing.three,
  },
  createButtonText: {
    color: OrganizerAccentTextOn,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  sectionTitle: {
    color: OrganizerAccent,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: Spacing.one,
    textTransform: 'uppercase',
  },
  stateCard: {
    alignItems: 'center',
    backgroundColor: Surface.card,
    borderColor: Surface.divider,
    borderRadius: Radii.card,
    borderWidth: 1,
    gap: Spacing.two,
    padding: Spacing.four,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  emptyBody: {
    textAlign: 'center',
  },
  eventCard: {
    backgroundColor: Surface.card,
    borderColor: Surface.divider,
    borderRadius: Radii.card,
    borderWidth: 1,
    overflow: 'hidden',
  },
  eventCardBody: {
    gap: Spacing.three,
    padding: Spacing.three,
  },
  eventCardTop: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: Spacing.two,
  },
  eventCardInfo: {
    flex: 1,
    gap: Spacing.half,
  },
  eventName: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
  },
  eventMeta: {
    fontSize: 14,
    lineHeight: 20,
  },
  chevron: {
    color: OrganizerAccent,
    fontSize: 28,
    fontWeight: '300',
    lineHeight: 28,
  },
  eventStatsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  miniStat: {
    backgroundColor: Surface.secondary,
    borderRadius: Radii.input,
    flex: 1,
    gap: 2,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
  },
  miniStatValue: {
    color: OrganizerAccent,
    fontSize: 18,
    fontWeight: '800',
  },
  miniStatLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  errorText: {
    color: semantic.errorSoft,
  },
  linkText: {
    color: OrganizerAccent,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.88,
  },
});
