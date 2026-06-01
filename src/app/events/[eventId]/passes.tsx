import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EventPassListRow } from '@/components/organizer/event-pass-list-row';
import { MissingProfileScreen } from '@/components/organizer/missing-profile-screen';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { chrome, fan, organizer, semantic, surface, text } from '@/theme';
import { useEventDetail } from '@/hooks/use-event-detail';
import { useOrganizerAuthGate } from '@/hooks/use-organizer-auth-gate';
import {
  DEFAULT_EVENT_PASS_SORT,
  EVENT_PASS_SORT_OPTIONS,
  prepareEventPassList,
  toggleEventPassSort,
  type EventPassSort,
} from '@/lib/event-pass-list-ui';
import {
  fetchEventPasses,
  getEventPassListTitle,
  parseEventPassFilter,
  type EventPassFilter,
} from '@/lib/event-passes';
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
      isLoading={isPassesLoading}
      listError={passesError}
      onGoToEventDetail={goToEventDetail}
      passes={passes}
    />
  );
}

type EventPassesContentProps = {
  eventName: string;
  filter: EventPassFilter;
  passes: Pass[];
  isLoading: boolean;
  listError: string | null;
  onGoToEventDetail: () => void;
};

function EventPassesContent({
  eventName,
  filter,
  passes,
  isLoading,
  listError,
  onGoToEventDetail,
}: EventPassesContentProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sort, setSort] = useState<EventPassSort>(DEFAULT_EVENT_PASS_SORT);

  const title = getEventPassListTitle(filter);
  const visiblePasses = useMemo(
    () => prepareEventPassList(passes, searchQuery, sort),
    [passes, searchQuery, sort],
  );

  const countLabel = isLoading
    ? 'Loading…'
    : searchQuery.trim()
      ? `${visiblePasses.length} of ${passes.length} pass${passes.length === 1 ? '' : 'es'}`
      : `${passes.length} pass${passes.length === 1 ? '' : 'es'}`;

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <Pressable onPress={onGoToEventDetail} style={styles.backButton}>
            <ThemedText style={styles.backText}>← Event</ThemedText>
          </Pressable>

          <View style={styles.headerBlock}>
            <ThemedText style={styles.title}>{title}</ThemedText>
            <ThemedText numberOfLines={2} themeColor="textSecondary" style={styles.subtitle}>
              {eventName}
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.countLine}>
              {countLabel}
            </ThemedText>
          </View>

          <View style={styles.toolbar}>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
              placeholder="Search name, email, phone, type, status…"
              placeholderTextColor={chrome.input.placeholder}
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />

            <ScrollView
              horizontal
              contentContainerStyle={styles.sortRow}
              showsHorizontalScrollIndicator={false}>
              {EVENT_PASS_SORT_OPTIONS.map((option) => {
                const isActive = sort.key === option.key;
                const arrow = isActive ? (sort.direction === 'asc' ? ' ↑' : ' ↓') : '';

                return (
                  <Pressable
                    key={option.key}
                    onPress={() => setSort((current) => toggleEventPassSort(current, option.key))}
                    style={({ pressed }) => [
                      styles.sortChip,
                      isActive && styles.sortChipActive,
                      pressed && styles.pressed,
                    ]}>
                    <ThemedText style={[styles.sortChipText, isActive && styles.sortChipTextActive]}>
                      {option.label}
                      {arrow}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {listError ? <ThemedText style={styles.errorText}>{listError}</ThemedText> : null}

          <View style={styles.listShell}>
            {isLoading ? (
              <View style={styles.loadingBlock}>
                <ActivityIndicator color={organizer.accent} size="large" />
              </View>
            ) : visiblePasses.length === 0 ? (
              <View style={styles.emptyBlock}>
                <ThemedText themeColor="textSecondary" style={styles.emptyText}>
                  {passes.length === 0
                    ? filter === 'checked_in'
                      ? 'No guests checked in yet.'
                      : 'No passes issued yet. Issue a pass from the event screen.'
                    : 'No passes match your search.'}
                </ThemedText>
              </View>
            ) : (
              visiblePasses.map((pass, index) => (
                <View key={pass.id}>
                  {index === 0 ? null : <View style={styles.rowDivider} />}
                  <EventPassListRow eventName={eventName} pass={pass} />
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

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
    flexGrow: 1,
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
    paddingBottom: Spacing.six,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
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
    alignSelf: 'flex-start',
    paddingVertical: Spacing.one,
  },
  backText: {
    color: fan.badgeText,
    fontSize: 15,
    fontWeight: '600',
  },
  headerBlock: {
    gap: 2,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  countLine: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: Spacing.half,
  },
  toolbar: {
    gap: Spacing.two,
  },
  searchInput: {
    backgroundColor: chrome.input.background,
    borderColor: chrome.input.border,
    borderRadius: Radii.input,
    borderWidth: 1,
    color: text.primary,
    fontSize: 15,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  sortRow: {
    gap: Spacing.two,
    paddingVertical: Spacing.half,
  },
  sortChip: {
    backgroundColor: chrome.glass.fill,
    borderColor: chrome.glass.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: Spacing.one + 2,
  },
  sortChipActive: {
    borderColor: organizer.accent,
  },
  sortChipText: {
    color: fan.badgeText,
    fontSize: 12,
    fontWeight: '600',
  },
  sortChipTextActive: {
    color: organizer.accent,
  },
  listShell: {
    backgroundColor: chrome.glass.fill,
    borderColor: chrome.glass.border,
    borderRadius: Radii.card,
    borderWidth: 1,
    overflow: 'hidden',
  },
  rowDivider: {
    backgroundColor: chrome.glass.border,
    height: StyleSheet.hairlineWidth,
  },
  loadingBlock: {
    alignItems: 'center',
    paddingVertical: Spacing.five,
  },
  emptyBlock: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.five,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  errorText: {
    color: semantic.errorSoft,
    fontSize: 14,
  },
  pressed: {
    opacity: 0.88,
  },
});
