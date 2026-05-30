import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MissingProfileScreen } from '@/components/organizer/missing-profile-screen';
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
} from '@/constants/theme';
import { useOrganizerAuthGate } from '@/hooks/use-organizer-auth-gate';
import { useEventDetail } from '@/hooks/use-event-detail';
import { formatEventDateLabel, formatEventStatus, formatTimeForInput } from '@/lib/event-display';
import { supabase } from '@/lib/supabase';

export default function EventDetailScreen() {
  const router = useRouter();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const authGate = useOrganizerAuthGate();
  const { event, issuedCount, isLoading, error, refetch } = useEventDetail(eventId);
  const [checkedInCount, setCheckedInCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (authGate.state === 'ready') {
        void refetch();
      }
    }, [authGate.state, refetch]),
  );

  useEffect(() => {
    let cancelled = false;

    async function loadCheckedInCount() {
      if (!eventId) {
        setCheckedInCount(0);
        return;
      }

      const { count } = await supabase
        .from('passes')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', eventId)
        .eq('status', 'checked_in');

      if (!cancelled) {
        setCheckedInCount(count ?? 0);
      }
    }

    void loadCheckedInCount();

    return () => {
      cancelled = true;
    };
  }, [eventId, issuedCount]);

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
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <ThemedText style={styles.backText}>Back</ThemedText>
          </Pressable>
          <ThemedText style={styles.errorText}>{error ?? 'Event not found.'}</ThemedText>
        </SafeAreaView>
      </View>
    );
  }

  const dateLabel = formatEventDateLabel(event.event_date, event.start_time);
  const startTimeLabel = formatTimeForInput(event.start_time) || '—';
  const checkInRate = issuedCount > 0 ? Math.round((checkedInCount / issuedCount) * 100) : 0;
  const isLive = event.status === 'published';

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <ThemedText style={styles.backText}>← Dashboard</ThemedText>
          </Pressable>

          <View style={styles.heroWrap}>
            <EventArtwork height={240} imageUrl={event.image_url} name={event.name} rounded={false} />
            {isLive ? (
              <View style={styles.liveBadge}>
                <ThemedText style={styles.liveBadgeText}>● Live</ThemedText>
              </View>
            ) : null}
          </View>

          <View style={styles.heroText}>
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

          <ThemedText style={styles.sectionLabel}>Performance</ThemedText>
          <StatRow>
            <StatBlock label="Passes Issued" value={String(issuedCount)} />
            <StatBlock label="Checked In" value={String(checkedInCount)} />
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
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    alignSelf: 'center',
    gap: Spacing.three,
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
  backButton: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  backText: {
    color: OrganizerAccent,
    fontSize: 15,
    fontWeight: '700',
  },
  heroWrap: {
    position: 'relative',
  },
  liveBadge: {
    backgroundColor: 'rgba(57, 255, 20, 0.15)',
    borderColor: OrganizerAccent,
    borderRadius: Radii.input,
    borderWidth: 1,
    left: Spacing.four,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    position: 'absolute',
    top: Spacing.three,
  },
  liveBadgeText: {
    color: OrganizerAccent,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  heroText: {
    gap: Spacing.one,
    paddingHorizontal: Spacing.four,
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
    color: '#888888',
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
    color: '#FF6B6B',
    padding: Spacing.four,
  },
});
