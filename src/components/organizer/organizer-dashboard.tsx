import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { EventArtwork } from '@/components/ui/event-artwork';
import { organizerEventDisplayTitleStyle } from '@/theme/organizer-event-title';
import { Radii, Spacing, semantic } from '@/constants/theme';
import { organizer, palette, text } from '@/theme';
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
  identityLine: string;
  welcomeMessage?: string;
  onDismissWelcome?: () => void;
};

export function OrganizerDashboard({
  organizerId,
  identityLine,
  welcomeMessage,
  onDismissWelcome,
}: OrganizerDashboardProps) {
  const router = useRouter();
  const { events, dashboardEvents, isLoading, error, refetch } = useOrganizerEvents(organizerId);
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
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <ThemedText style={styles.screenTitle}>Dashboard</ThemedText>

          <Pressable
            accessibilityLabel="Open profile"
            accessibilityRole="button"
            onPress={() => router.push('/profile' as Href)}
            style={({ pressed }) => [styles.profileIdentity, pressed && styles.pressed]}>
            <View style={styles.profileAvatar}>
              <Text style={styles.profileAvatarText}>808</Text>
            </View>
            <View style={styles.profileIdentityText}>
              <ThemedText style={styles.organizerMeta}>{identityLine}</ThemedText>
              <View style={styles.profileIdentityHint}>
                <ThemedText style={styles.viewProfileText}>View profile</ThemedText>
                <ThemedText style={styles.profileChevron}>{'>'}</ThemedText>
              </View>
            </View>
          </Pressable>

          <Pressable
            accessibilityLabel="Create event"
            accessibilityRole="button"
            onPress={() => router.push('/events/create' as Href)}
            style={({ pressed }) => [styles.createEventCta, pressed && styles.pressed]}>
            <View style={styles.createEventCtaIconWrap}>
              <Text style={styles.createEventCtaIcon}>+</Text>
            </View>
            <View style={styles.createEventCtaTextWrap}>
              <ThemedText style={styles.createEventCtaTitle}>Create Event</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.createEventCtaSubtitle}>
                Set up your next show and start issuing passes
              </ThemedText>
            </View>
            <Text style={styles.createEventCtaChevron}>{'›'}</Text>
          </Pressable>

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

          <ThemedText style={styles.sectionTitle}>Upcoming Events</ThemedText>

          {!isLoading && !error && dashboardEvents.length > 0 ? (
            <View style={styles.filterRow}>
              {(['all', 'live', 'draft'] as const).map((option) => {
                const isActive = statusFilter === option;
                const label = option === 'all' ? 'All' : option === 'live' ? 'Live' : 'Draft';

                return (
                  <Pressable
                    key={option}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                    onPress={() => setStatusFilter(option)}
                    style={({ pressed }) => [
                      styles.filterChip,
                      isActive && option === 'draft' && styles.filterChipActiveDraft,
                      isActive && option !== 'draft' && styles.filterChipActive,
                      pressed && styles.pressed,
                    ]}>
                    <ThemedText
                      style={[
                        styles.filterChipText,
                        isActive && option !== 'draft' && styles.filterChipTextActive,
                        isActive && option === 'draft' && styles.filterChipTextActiveDraft,
                      ]}>
                      {label}
                    </ThemedText>
                  </Pressable>
                );
              })}
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

          {isLoading ? (
            <View style={styles.stateCard}>
              <ActivityIndicator color={organizer.accent} />
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

          {!isLoading && !error && filteredDashboardEvents.length > 0 ? (
            <View style={styles.eventsList}>
              {filteredDashboardEvents.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  stats={statsByEvent[event.id] ?? { issued: 0, checkedIn: 0 }}
                  onPress={() => router.push(`/events/${event.id}` as Href)}
                />
              ))}
            </View>
          ) : null}
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
  const saleLabel = isEventLive(event.status) ? 'On Sale' : getEventStatusPillLabel(event.status);
  const isLive = isEventLive(event.status);
  const isDraft = isEventDraft(event.status);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.eventCard, pressed && styles.pressed]}>
      <View style={styles.eventArtworkWrap}>
        <EventArtwork height={72} imageUrl={event.image_url} name={event.name} rounded />
      </View>

      <View style={styles.eventCardInfo}>
        <ThemedText style={styles.eventName} numberOfLines={2}>
          {event.name}
        </ThemedText>
        {dateLabel ? (
          <ThemedText themeColor="textSecondary" style={styles.eventMeta} numberOfLines={1}>
            {dateLabel}
          </ThemedText>
        ) : null}
        {event.venue_name ? (
          <ThemedText themeColor="textSecondary" style={styles.eventMeta} numberOfLines={1}>
            {event.venue_name}
          </ThemedText>
        ) : null}
        {saleLabel ? (
          <View
            style={[
              styles.eventStatusBadge,
              isLive && styles.eventStatusBadgeLive,
              isDraft && styles.eventStatusBadgeDraft,
            ]}>
            <ThemedText
              style={[
                styles.eventStatusBadgeText,
                isLive && styles.eventStatusBadgeTextLive,
                isDraft && styles.eventStatusBadgeTextDraft,
              ]}>
              {saleLabel}
            </ThemedText>
          </View>
        ) : null}
      </View>

      <View style={styles.eventIssuedStat}>
        <ThemedText style={styles.eventIssuedValue}>{String(stats.issued)}</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.eventIssuedLabel}>
          Issued
        </ThemedText>
      </View>
    </Pressable>
  );
}

const MOBILE_VIEWPORT_WIDTH = 390;

const styles = StyleSheet.create({
  container: {
    backgroundColor: palette.pureBlack,
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    alignSelf: 'center',
    gap: Spacing.two + 2,
    maxWidth: MOBILE_VIEWPORT_WIDTH,
    paddingBottom: Spacing.six,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    width: '100%',
  },
  screenTitle: {
    color: text.primary,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: 0.2,
    lineHeight: 34,
  },
  profileIdentity: {
    alignItems: 'center',
    backgroundColor: palette.black,
    borderColor: organizer.accent,
    borderRadius: Radii.card,
    borderWidth: 1,
    flexDirection: 'row',
    gap: Spacing.three,
    marginBottom: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  profileAvatar: {
    alignItems: 'center',
    backgroundColor: 'rgba(57, 255, 20, 0.08)',
    borderColor: organizer.accent,
    borderRadius: 999,
    borderWidth: 2,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  profileAvatarText: {
    color: organizer.accent,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  profileIdentityText: {
    flex: 1,
    gap: 4,
  },
  organizerMeta: {
    color: text.primary,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  profileIdentityHint: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  viewProfileText: {
    color: organizer.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  profileChevron: {
    color: organizer.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  createEventCta: {
    alignItems: 'center',
    backgroundColor: 'rgba(57, 255, 20, 0.1)',
    borderColor: organizer.accent,
    borderRadius: Radii.card,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: Spacing.three,
    minHeight: 72,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  createEventCtaIconWrap: {
    alignItems: 'center',
    backgroundColor: 'rgba(57, 255, 20, 0.16)',
    borderColor: organizer.accent,
    borderRadius: 14,
    borderWidth: 1.5,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  createEventCtaIcon: {
    color: organizer.accent,
    fontSize: 28,
    fontWeight: '300',
    lineHeight: 30,
    marginTop: -2,
  },
  createEventCtaTextWrap: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  createEventCtaTitle: {
    color: text.primary,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.2,
    lineHeight: 22,
  },
  createEventCtaSubtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  createEventCtaChevron: {
    color: organizer.accent,
    fontSize: 26,
    fontWeight: '600',
    lineHeight: 28,
  },
  sectionTitle: {
    color: text.primary,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.2,
    marginTop: Spacing.two,
  },
  eventsList: {
    gap: 8,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  filterChipActive: {
    backgroundColor: 'rgba(57, 255, 20, 0.1)',
    borderColor: 'rgba(57, 255, 20, 0.35)',
  },
  filterChipActiveDraft: {
    backgroundColor: 'rgba(255, 196, 64, 0.08)',
    borderColor: 'rgba(255, 196, 64, 0.32)',
  },
  filterChipText: {
    color: text.secondary,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
    lineHeight: 12,
  },
  filterChipTextActive: {
    color: organizer.accent,
  },
  filterChipTextActiveDraft: {
    color: '#FFC440',
  },
  stateCard: {
    alignItems: 'center',
    backgroundColor: palette.black,
    borderColor: 'rgba(255, 255, 255, 0.1)',
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
    alignItems: 'center',
    backgroundColor: '#0C0C0C',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: Radii.card,
    borderWidth: 1,
    elevation: 2,
    flexDirection: 'row',
    gap: Spacing.two + 2,
    overflow: 'hidden',
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: Spacing.two,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
  },
  eventArtworkWrap: {
    borderRadius: 12,
    height: 72,
    overflow: 'hidden',
    width: 72,
  },
  eventCardInfo: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  eventName: {
    ...organizerEventDisplayTitleStyle.cardTitle,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 20,
  },
  eventMeta: {
    fontSize: 13,
    lineHeight: 17,
  },
  eventStatusBadge: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 2,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  eventStatusBadgeLive: {
    backgroundColor: 'rgba(57, 255, 20, 0.1)',
    borderColor: 'rgba(57, 255, 20, 0.35)',
  },
  eventStatusBadgeDraft: {
    backgroundColor: 'rgba(255, 196, 64, 0.08)',
    borderColor: 'rgba(255, 196, 64, 0.32)',
  },
  eventStatusBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
    lineHeight: 12,
  },
  eventStatusBadgeTextLive: {
    color: organizer.accent,
  },
  eventStatusBadgeTextDraft: {
    color: '#FFC440',
  },
  eventIssuedStat: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    minWidth: 52,
  },
  eventIssuedValue: {
    color: text.primary,
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 26,
  },
  eventIssuedLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
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
    color: organizer.accent,
    fontSize: 14,
    fontWeight: '700',
  },
  errorText: {
    color: semantic.errorSoft,
  },
  linkText: {
    color: organizer.accent,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.88,
  },
});
