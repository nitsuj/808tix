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
import { organizerEventDisplayTitleStyle } from '@/theme/organizer-event-title';
import { OrganizerAmbientBackground } from '@/components/ui/organizer-ambient-background';
import { StatBlock, StatRow } from '@/components/ui/stat-block';
import { Radii, Spacing, semantic } from '@/constants/theme';
import { chrome, fan, surface, text } from '@/theme';
import { useOrganizerEvents } from '@/hooks/use-organizer-events';
import type { Event } from '@/lib/database.types';
import { formatEventDateTimeLong } from '@/lib/event-datetime-display';
import {
  filterDashboardEventsByStatus,
  getEventStatusPillLabel,
  isEventDraft,
  isEventLive,
  type DashboardStatusFilter,
} from '@/lib/event-status';
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
  welcomeMessage?: string;
  onDismissWelcome?: () => void;
};

export function OrganizerDashboard({
  organizerId,
  displayName,
  displayEmail,
  onSignOut,
  welcomeMessage,
  onDismissWelcome,
}: OrganizerDashboardProps) {
  const router = useRouter();
  const { events, dashboardEvents, isLoading, error, refetch } = useOrganizerEvents(organizerId);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [statsByEvent, setStatsByEvent] = useState<Record<string, EventPassStats>>({});
  const [statusFilter, setStatusFilter] = useState<DashboardStatusFilter>('all');

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  useEffect(() => {
    let cancelled = false;

    async function loadPassStats() {
      if (dashboardEvents.length === 0) {
        setStatsByEvent({});
        return;
      }

      const eventIds = dashboardEvents.map((event) => event.id);
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
  }, [dashboardEvents]);

  const aggregateStats = useMemo(() => {
    let issued = 0;
    let checkedIn = 0;

    for (const stats of Object.values(statsByEvent)) {
      issued += stats.issued;
      checkedIn += stats.checkedIn;
    }

    const checkInRate = issued > 0 ? Math.round((checkedIn / issued) * 100) : 0;

    return {
      events: dashboardEvents.length,
      issued,
      checkedIn,
      checkInRate,
    };
  }, [statsByEvent, dashboardEvents.length]);

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

  const filteredDashboardEvents = useMemo(
    () => filterDashboardEventsByStatus(dashboardEvents, statusFilter),
    [dashboardEvents, statusFilter],
  );

  const showNoEventsEmptyState = !isLoading && !error && events.length === 0;
  const showOnlyFinishedEmptyState =
    !isLoading && !error && dashboardEvents.length === 0 && events.length > 0;
  const showFilterEmptyState =
    !isLoading && !error && dashboardEvents.length > 0 && filteredDashboardEvents.length === 0;

  return (
    <View style={styles.container}>
      <OrganizerAmbientBackground />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.headerRow}>
            <View style={styles.headerText}>
              <ThemedText style={styles.screenTitle}>Command center</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.organizerMeta}>
                {displayName === displayEmail ? displayEmail : `${displayName} · ${displayEmail}`}
              </ThemedText>
            </View>

            <Pressable
              disabled={isSigningOut}
              onPress={handleSignOut}
              style={({ pressed }) => [styles.signOutButton, pressed && styles.pressed]}>
              {isSigningOut ? (
                <ActivityIndicator color={fan.primary} size="small" />
              ) : (
                <ThemedText style={styles.signOutText}>Sign out</ThemedText>
              )}
            </Pressable>
          </View>

          {signOutError ? <ThemedText style={styles.errorText}>{signOutError}</ThemedText> : null}

          {welcomeMessage ? (
            <View style={styles.welcomeBanner}>
              <ThemedText style={styles.welcomeBannerText}>{welcomeMessage}</ThemedText>
              {onDismissWelcome ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={onDismissWelcome}
                  style={({ pressed }) => [styles.welcomeDismiss, pressed && styles.pressed]}>
                  <ThemedText style={styles.welcomeDismissText}>Dismiss</ThemedText>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {showNoEventsEmptyState ? (
            <View style={styles.stateCard}>
              <ThemedText style={styles.emptyTitle}>No events yet</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.emptyBody}>
                Create your first event to start issuing passes.
              </ThemedText>
            </View>
          ) : null}

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

          <ThemedText style={styles.sectionTitle}>Your events</ThemedText>

          {!isLoading && !error && dashboardEvents.length > 0 ? (
            <View style={styles.filterRow}>
              {(['all', 'live', 'draft'] as const).map((option) => {
                const isActive = statusFilter === option;
                const label = option === 'all' ? 'All' : option === 'live' ? 'Live' : 'Draft';

                return (
                  <Pressable
                    key={option}
                    onPress={() => setStatusFilter(option)}
                    style={({ pressed }) => [
                      styles.filterChip,
                      isActive && styles.filterChipActive,
                      pressed && styles.pressed,
                    ]}>
                    <ThemedText style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                      {label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {isLoading ? (
            <View style={styles.stateCard}>
              <ActivityIndicator color={fan.primary} />
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

          {showOnlyFinishedEmptyState ? (
            <View style={styles.stateCard}>
              <ThemedText style={styles.emptyTitle}>No active events</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.emptyBody}>
                You have {events.length} completed or cancelled event
                {events.length === 1 ? '' : 's'}. Create a new event to issue passes.
              </ThemedText>
            </View>
          ) : null}

          {showFilterEmptyState ? (
            <View style={styles.stateCard}>
              <ThemedText style={styles.emptyTitle}>No {statusFilter} events</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.emptyBody}>
                Try another filter or create a new event.
              </ThemedText>
            </View>
          ) : null}

          {!isLoading && !error
            ? filteredDashboardEvents.map((event) => (
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
  const dateLabel = formatEventDateTimeLong(event.event_date, event.start_time);
  const checkInRate = stats.issued > 0 ? Math.round((stats.checkedIn / stats.issued) * 100) : 0;
  const statusLabel = getEventStatusPillLabel(event.status);
  const isLive = isEventLive(event.status);
  const isDraft = isEventDraft(event.status);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.eventCard, pressed && styles.pressed]}>
      <EventArtwork height={88} imageUrl={event.image_url} name={event.name} rounded={false} />
      <View style={styles.eventCardBody}>
        <View style={styles.eventCardTop}>
          <View style={styles.eventCardInfo}>
            <View style={styles.eventTitleRow}>
              <ThemedText style={styles.eventName}>{event.name}</ThemedText>
              <View
                style={[
                  styles.eventStatusBadge,
                  isLive && styles.eventStatusBadgeLive,
                  isDraft && styles.eventStatusBadgeDraft,
                ]}>
                <ThemedText style={styles.eventStatusBadgeText}>{statusLabel}</ThemedText>
              </View>
            </View>
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

// (removed) local date formatting helper — use canonical formatter instead

const MOBILE_VIEWPORT_WIDTH = 390;

const styles = StyleSheet.create({
  container: {
    backgroundColor: surface.background,
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    alignSelf: 'center',
    gap: Spacing.three,
    maxWidth: MOBILE_VIEWPORT_WIDTH,
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
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.6,
    lineHeight: 32,
  },
  organizerMeta: {
    fontSize: 13,
  },
  signOutButton: {
    paddingVertical: Spacing.one,
  },
  signOutText: {
    color: text.secondary,
    fontSize: 14,
    fontWeight: '600',
  },
  createButton: {
    alignItems: 'center',
    backgroundColor: fan.primary,
    borderRadius: Radii.button,
    minHeight: 48,
    paddingVertical: Spacing.three,
  },
  createButtonText: {
    color: chrome.white,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  sectionTitle: {
    color: chrome.brand.eyebrow,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: Spacing.one,
    textTransform: 'uppercase',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  filterChip: {
    backgroundColor: chrome.glass.fill,
    borderColor: chrome.glass.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: Spacing.one + 2,
  },
  filterChipActive: {
    borderColor: fan.primary,
    backgroundColor: 'rgba(162, 91, 255, 0.14)',
  },
  filterChipText: {
    color: text.secondary,
    fontSize: 12,
    fontWeight: '700',
  },
  filterChipTextActive: {
    color: fan.badgeText,
  },
  stateCard: {
    alignItems: 'center',
    backgroundColor: chrome.glass.fill,
    borderColor: chrome.glass.border,
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
    backgroundColor: chrome.glass.fill,
    borderColor: chrome.glass.border,
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
  eventTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  eventName: {
    ...organizerEventDisplayTitleStyle.cardTitle,
    flexShrink: 1,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
  },
  eventStatusBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
  },
  eventStatusBadgeLive: {
    borderColor: 'rgba(57, 255, 20, 0.45)',
    backgroundColor: 'rgba(57, 255, 20, 0.1)',
  },
  eventStatusBadgeDraft: {
    borderColor: 'rgba(255, 196, 64, 0.45)',
    backgroundColor: 'rgba(255, 196, 64, 0.1)',
  },
  eventStatusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  eventMeta: {
    fontSize: 14,
    lineHeight: 20,
  },
  chevron: {
    color: fan.primary,
    fontSize: 28,
    fontWeight: '300',
    lineHeight: 28,
  },
  eventStatsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  miniStat: {
    backgroundColor: chrome.glass.highlight,
    borderColor: chrome.glass.border,
    borderRadius: Radii.input,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
  },
  miniStatValue: {
    color: fan.primary,
    fontSize: 18,
    fontWeight: '800',
  },
  miniStatLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  welcomeBanner: {
    alignItems: 'center',
    backgroundColor: 'rgba(57, 255, 20, 0.1)',
    borderColor: 'rgba(57, 255, 20, 0.35)',
    borderRadius: Radii.card,
    borderWidth: 1,
    flexDirection: 'row',
    gap: Spacing.two,
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  welcomeBannerText: {
    color: text.primary,
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
  },
  welcomeDismiss: {
    paddingHorizontal: Spacing.one,
    paddingVertical: Spacing.half,
  },
  welcomeDismissText: {
    color: fan.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  errorText: {
    color: semantic.errorSoft,
  },
  linkText: {
    color: fan.primary,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.88,
  },
});
