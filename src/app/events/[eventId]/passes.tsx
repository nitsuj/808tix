import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EventPassListCard } from '@/components/organizer/event-pass-list-card';
import { MissingProfileScreen } from '@/components/organizer/missing-profile-screen';
import { ThemedText } from '@/components/themed-text';
import { ArtworkEnvironment } from '@/components/ui/artwork-environment';
import { EventArtwork } from '@/components/ui/event-artwork';
import { MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { GlassCard } from '@/components/ui/glass-card';
import { chrome, fan, organizerScreen, semantic, surface } from '@/theme';
import { useEventDetail } from '@/hooks/use-event-detail';
import { useOrganizerAuthGate } from '@/hooks/use-organizer-auth-gate';
import {
  fetchEventPasses,
  getEventPassListTitle,
  parseEventPassFilter,
  type EventPassFilter,
} from '@/lib/event-passes';
import { resolveOrganizerArtworkUrl } from '@/lib/event-artwork-display';
import type { Pass } from '@/lib/database.types';

export default function EventPassesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    eventId: string | string[];
    filter?: string | string[];
  }>();

  const eventId = Array.isArray(params.eventId) ? params.eventId[0] : params.eventId;
  const filterParam = Array.isArray(params.filter) ? params.filter[0] : params.filter;
  const filter = parseEventPassFilter(filterParam);

  const authGate = useOrganizerAuthGate();
  const { event, isLoading: isEventLoading, error: eventError } = useEventDetail(eventId);

  const [passes, setPasses] = useState<Pass[]>([]);
  const [isPassesLoading, setIsPassesLoading] = useState(true);
  const [passesError, setPassesError] = useState<string | null>(null);

  const loadPasses = useCallback(async () => {
    if (!eventId) {
      setPasses([]);
      setIsPassesLoading(false);
      return;
    }

    setIsPassesLoading(true);
    setPassesError(null);

    const outcome = await fetchEventPasses(eventId, filter);

    if (!outcome.ok) {
      setPassesError(outcome.error);
      setPasses([]);
    } else {
      setPasses(outcome.passes);
    }

    setIsPassesLoading(false);
  }, [eventId, filter]);

  useFocusEffect(
    useCallback(() => {
      if (authGate.state === 'ready' && eventId) {
        void loadPasses();
      }
    }, [authGate.state, eventId, loadPasses]),
  );

  const goToEventDetail = useCallback(() => {
    if (!eventId) {
      return;
    }

    router.replace(`/events/${eventId}` as Href);
  }, [eventId, router]);

  if (authGate.state === 'loading' || isEventLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={fan.primary} />
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

  if (eventError || !event || !eventId) {
    return (
      <View style={styles.centered}>
        <ThemedText style={styles.errorText}>{eventError ?? 'Event not found.'}</ThemedText>
      </View>
    );
  }

  return (
    <EventPassesContent
      eventName={event.name}
      filter={filter}
      imageUrl={event.image_url}
      isLoading={isPassesLoading}
      listError={passesError}
      onGoToEventDetail={goToEventDetail}
      passes={passes}
    />
  );
}

type EventPassesContentProps = {
  eventName: string;
  imageUrl: string | null;
  filter: EventPassFilter;
  passes: Pass[];
  isLoading: boolean;
  listError: string | null;
  onGoToEventDetail: () => void;
};

function EventPassesContent({
  eventName,
  imageUrl,
  filter,
  passes,
  isLoading,
  listError,
  onGoToEventDetail,
}: EventPassesContentProps) {
  const { height: windowHeight } = useWindowDimensions();
  const artworkUri = resolveOrganizerArtworkUrl(imageUrl);
  const hasUploadedArtwork = Boolean(artworkUri);
  const title = getEventPassListTitle(filter);
  const cardTopInset = Math.max(56, Math.round(windowHeight * 0.1));

  return (
    <View style={styles.container}>
      {hasUploadedArtwork ? (
        <ArtworkEnvironment artworkUri={artworkUri!} isUploaded />
      ) : (
        <View style={[styles.fallbackArtLayer, { height: windowHeight }]}>
          <EventArtwork
            height={windowHeight}
            imageUrl={null}
            name={eventName}
            rounded={false}
            style={StyleSheet.absoluteFill}
          />
        </View>
      )}

      <SafeAreaView edges={['top', 'bottom']} style={styles.contentLayer}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingTop: cardTopInset }]}
          showsVerticalScrollIndicator={false}>
          <Pressable onPress={onGoToEventDetail} style={styles.backButton}>
            <ThemedText style={styles.backText}>← Event</ThemedText>
          </Pressable>

          <GlassCard style={styles.headerCard}>
            <ThemedText style={styles.title}>{title}</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.subtitle}>
              {eventName}
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.countLine}>
              {isLoading ? 'Loading…' : `${passes.length} pass${passes.length === 1 ? '' : 'es'}`}
            </ThemedText>
          </GlassCard>

          {listError ? <ThemedText style={styles.errorText}>{listError}</ThemedText> : null}

          {isLoading ? (
            <View style={styles.loadingBlock}>
              <ActivityIndicator color={fan.primary} size="large" />
            </View>
          ) : passes.length === 0 ? (
            <View style={styles.emptyCard}>
              <ThemedText themeColor="textSecondary" style={styles.emptyText}>
                {filter === 'checked_in'
                  ? 'No guests checked in yet.'
                  : 'No passes issued yet. Issue a pass from the event screen.'}
              </ThemedText>
            </View>
          ) : (
            <View style={styles.list}>
              {passes.map((pass) => (
                <EventPassListCard key={pass.id} eventName={eventName} pass={pass} />
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: surface.background,
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
  scrollContent: {
    alignSelf: 'center',
    flexGrow: 1,
    gap: Spacing.three,
    maxWidth: MaxContentWidth,
    paddingBottom: Spacing.six,
    paddingHorizontal: Spacing.three,
    width: '100%',
  },
  centered: {
    alignItems: 'center',
    backgroundColor: surface.background,
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  backButton: {
    paddingHorizontal: Spacing.one,
    paddingVertical: Spacing.one,
  },
  backText: {
    color: fan.badgeText,
    fontSize: 16,
    fontWeight: '600',
  },
  headerCard: {
    gap: Spacing.one,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  countLine: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: Spacing.half,
  },
  list: {
    gap: Spacing.three,
  },
  loadingBlock: {
    alignItems: 'center',
    paddingVertical: Spacing.six,
  },
  emptyCard: {
    backgroundColor: chrome.glass.fill,
    borderColor: chrome.glass.border,
    borderRadius: Radii.card,
    borderWidth: 1,
    padding: Spacing.five,
  },
  emptyText: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  errorText: {
    color: semantic.errorSoft,
    fontSize: 14,
    paddingHorizontal: Spacing.one,
  },
});
