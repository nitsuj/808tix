import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useCallback } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MissingProfileScreen } from '@/components/organizer/missing-profile-screen';
import { ThemedText } from '@/components/themed-text';
import { ArtworkEnvironment } from '@/components/ui/artwork-environment';
import { EventArtwork } from '@/components/ui/event-artwork';
import { StatBlock, StatRow } from '@/components/ui/stat-block';
import { organizerScreen, semantic, text } from '@/theme';
import {
  MaxContentWidth,
  OrganizerAccent,
  OrganizerAccentTextOn,
  Radii,
  Spacing,
  Surface,
} from '@/constants/theme';
import { useOrganizerAuthGate } from '@/hooks/use-organizer-auth-gate';
import { useEventDetail } from '@/hooks/use-event-detail';
import { formatEventDateLabel, formatEventStatus, formatTimeForInput } from '@/lib/event-display';
import { formatCheckInRatePercent } from '@/lib/event-stats';
import { resolveOrganizerArtworkUrl } from '@/lib/event-artwork-display';
import type { Event } from '@/lib/database.types';

const DASHBOARD_ROUTE = '/' as Href;

export default function EventDetailScreen() {
  const router = useRouter();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const authGate = useOrganizerAuthGate();
  const { event, issuedCount, checkedInCount, remainingCount, isLoading, error, refetch } =
    useEventDetail(eventId);

  const goToDashboard = useCallback(() => {
    router.replace(DASHBOARD_ROUTE);
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      if (authGate.state === 'ready') {
        void refetch();
      }
    }, [authGate.state, refetch]),
  );

  if (authGate.state === 'loading' || isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={OrganizerAccent} />
      </View>
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
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <Pressable onPress={goToDashboard} style={styles.backButtonOverlay}>
            <ThemedText style={styles.backText}>← Dashboard</ThemedText>
          </Pressable>
          <ThemedText style={styles.errorText}>{error ?? 'Event not found.'}</ThemedText>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <EventDetailContent
      checkedInCount={checkedInCount}
      event={event}
      issuedCount={issuedCount}
      remainingCount={remainingCount}
      onGoToDashboard={goToDashboard}
      router={router}
    />
  );
}

type EventDetailContentProps = {
  event: Event;
  issuedCount: number;
  checkedInCount: number;
  remainingCount: number;
  onGoToDashboard: () => void;
  router: ReturnType<typeof useRouter>;
};

function EventDetailContent({
  event,
  issuedCount,
  checkedInCount,
  remainingCount,
  onGoToDashboard,
  router,
}: EventDetailContentProps) {
  const { height: windowHeight } = useWindowDimensions();
  const artworkUri = resolveOrganizerArtworkUrl(event.image_url);
  const hasUploadedArtwork = Boolean(artworkUri);

  const dateLabel = formatEventDateLabel(event.event_date, event.start_time);
  const startTimeLabel = formatTimeForInput(event.start_time) || '—';
  const checkInRate = formatCheckInRatePercent({
    issuedCount,
    checkedInCount,
    capacity: event.capacity,
    remainingCount,
  });
  const isLive = event.status === 'published';

  return (
    <View style={styles.container}>
      {hasUploadedArtwork ? (
        <ArtworkEnvironment artworkUri={artworkUri!} isUploaded />
      ) : (
        <View style={[styles.fallbackArtLayer, { height: windowHeight }]}>
          <EventArtwork
            height={windowHeight}
            imageUrl={null}
            name={event.name}
            rounded={false}
            style={StyleSheet.absoluteFill}
          />
        </View>
      )}

      <SafeAreaView edges={['top']} style={styles.contentLayer}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.heroTopRow}>
            <Pressable onPress={onGoToDashboard} style={styles.backButtonOverlay}>
              <ThemedText style={styles.backText}>← Dashboard</ThemedText>
            </Pressable>

            {isLive ? (
              <View style={styles.liveBadge}>
                <ThemedText style={styles.liveBadgeText}>● Live</ThemedText>
              </View>
            ) : null}
          </View>

          <View style={styles.heroTextBlock}>
            <ThemedText style={styles.title}>{event.name}</ThemedText>
            {event.venue_name ? (
              <ThemedText themeColor="textSecondary" style={styles.subtitle}>
                {event.venue_name}
              </ThemedText>
            ) : null}
            {dateLabel ? (
              <ThemedText themeColor="textSecondary" style={styles.subtitle}>
                {dateLabel} · {startTimeLabel}
              </ThemedText>
            ) : null}
            <ThemedText style={styles.statusPill}>{formatEventStatus(event.status)}</ThemedText>
          </View>

          <View style={styles.body}>
            <ThemedText style={styles.sectionLabel}>Performance</ThemedText>
            <StatRow>
              <StatBlock label="Issued" value={String(issuedCount)} />
              <StatBlock label="Checked In" value={String(checkedInCount)} />
              <StatBlock label="Remaining" value={String(remainingCount)} />
              <StatBlock label="Check-In Rate" value={`${checkInRate}%`} />
            </StatRow>

            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${checkInRate}%` }]} />
            </View>

            <View style={styles.actionsCard}>
              <ActionRow
                label="Issue Pass"
                onPress={() => router.push(`/events/${event.id}/issue` as Href)}
                primary
              />
              <ActionRow
                label="Scanner"
                onPress={() => router.push(`/events/${event.id}/scan` as Href)}
              />
              <ActionRow
                label="Edit Event"
                onPress={() => router.push(`/events/${event.id}/edit` as Href)}
              />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function ActionRow({
  label,
  onPress,
  primary = false,
  disabled = false,
}: {
  label: string;
  onPress?: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      disabled={disabled || !onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionRow,
        primary && styles.actionRowPrimary,
        disabled && styles.actionRowDisabled,
        pressed && styles.pressed,
      ]}>
      <ThemedText
        style={[
          styles.actionRowText,
          primary && styles.actionRowTextPrimary,
          disabled && styles.actionRowTextDisabled,
        ]}>
        {label}
      </ThemedText>
      {!disabled ? <ThemedText style={styles.actionChevron}>›</ThemedText> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Surface.background,
    flex: 1,
    position: 'relative',
  },
  fallbackArtLayer: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
  },
  contentLayer: {
    flex: 1,
    zIndex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    alignSelf: 'center',
    flexGrow: 1,
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
    paddingBottom: Spacing.six,
    width: '100%',
  },
  centered: {
    alignItems: 'center',
    backgroundColor: Surface.background,
    flex: 1,
    justifyContent: 'center',
  },
  heroTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.one,
  },
  backButtonOverlay: {
    paddingVertical: Spacing.two,
  },
  backText: {
    color: OrganizerAccent,
    fontSize: 15,
    fontWeight: '700',
  },
  liveBadge: {
    backgroundColor: organizerScreen.liveBadge.backgroundColor,
    borderColor: OrganizerAccent,
    borderRadius: Radii.input,
    borderWidth: 1,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  liveBadgeText: {
    color: OrganizerAccent,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  heroTextBlock: {
    gap: Spacing.one,
    paddingHorizontal: Spacing.four,
    width: '100%',
  },
  body: {
    gap: Spacing.two,
    marginTop: Spacing.one,
    paddingHorizontal: Spacing.four,
    width: '100%',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.3,
    lineHeight: 38,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
  },
  statusPill: {
    alignSelf: 'flex-start',
    backgroundColor: Surface.secondary,
    borderRadius: Radii.input,
    color: OrganizerAccent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginTop: Spacing.one,
    overflow: 'hidden',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    textTransform: 'uppercase',
  },
  sectionLabel: {
    color: OrganizerAccent,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
    paddingHorizontal: Spacing.four,
    textTransform: 'uppercase',
  },
  progressTrack: {
    backgroundColor: Surface.secondary,
    borderRadius: 999,
    height: 8,
    marginHorizontal: Spacing.four,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: OrganizerAccent,
    borderRadius: 999,
    height: '100%',
  },
  actionsCard: {
    backgroundColor: Surface.card,
    borderColor: Surface.divider,
    borderRadius: Radii.card,
    borderWidth: 1,
    marginHorizontal: Spacing.four,
    overflow: 'hidden',
  },
  actionRow: {
    alignItems: 'center',
    borderBottomColor: Surface.divider,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  actionRowPrimary: {
    backgroundColor: OrganizerAccent,
  },
  actionRowDisabled: {
    opacity: 0.45,
  },
  actionRowText: {
    fontSize: 16,
    fontWeight: '700',
  },
  actionRowTextPrimary: {
    color: OrganizerAccentTextOn,
  },
  actionRowTextDisabled: {
    color: text.disabled,
  },
  actionChevron: {
    color: OrganizerAccent,
    fontSize: 24,
    fontWeight: '300',
  },
  pressed: {
    opacity: 0.88,
  },
  errorText: {
    color: semantic.errorSoft,
    padding: Spacing.four,
  },
});
