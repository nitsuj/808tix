import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EventPassListRow } from '@/components/organizer/event-pass-list-row';
import { MissingProfileScreen } from '@/components/organizer/missing-profile-screen';
import { ThemedText } from '@/components/themed-text';
import { EventScreenBackground } from '@/components/ui/event-screen-background';
import { Radii, Spacing } from '@/constants/theme';
import {
  chrome,
  fan,
  palette,
  passScreen,
  semantic,
  shadows,
  text,
} from '@/theme';
import { organizerEventTitleStyle } from '@/theme/organizer-event-title';
import { useEventDetail } from '@/hooks/use-event-detail';
import { useOrganizerAuthGate } from '@/hooks/use-organizer-auth-gate';
import { useOrganizerAuthRedirect } from '@/hooks/use-organizer-auth-redirect';
import { formatEventDateTimeLong } from '@/lib/event-datetime-display';
import { formatVenueLine, shouldShowVenueLine } from '@/lib/event-display';
import {
  DEFAULT_EVENT_PASS_SORT,
  getEventPassSortOptions,
  isEventPassSortKeyAllowed,
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
import { ORGANIZER_DASHBOARD_ROUTE, safeRouterBack } from '@/lib/safe-router-back';
import type { Pass } from '@/lib/database.types';

const MOBILE_VIEWPORT_WIDTH = 390;

const LAYOUT = {
  horizontalPadding: 24,
  contentTopInset: 12,
  panelTopInset: 48,
  panelBottomInset: 32,
  date: { fontSize: 11, lineHeight: 14, letterSpacing: 1.2 },
  title: { fontSize: 22, lineHeight: 28, letterSpacing: 0.4 },
  subtitle: { fontSize: 13, lineHeight: 18, letterSpacing: 0.3 },
} as const;

const webViewportMinHeight =
  Platform.OS === 'web' ? ({ minHeight: '100dvh' } as const) : null;

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
    safeRouterBack(router, ORGANIZER_DASHBOARD_ROUTE);
  }, [router]);

  useOrganizerAuthRedirect(authGate.state);

  if (authGate.state === 'loading' || isEventLoading) {
    return (
      <MobileViewport>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={fan.primary} />
        </View>
      </MobileViewport>
    );
  }

  if (authGate.state === 'unauthenticated') {
    return null;
  }

  if (authGate.state === 'profile_missing') {
    return <MissingProfileScreen email={authGate.email} onSignOut={authGate.signOut} />;
  }

  if (eventError || !event || !eventId) {
    return (
      <MobileViewport>
        <View style={styles.centered}>
          <ThemedText style={styles.errorText}>{eventError ?? 'Event not found.'}</ThemedText>
        </View>
      </MobileViewport>
    );
  }

  return (
    <EventPassesContent
      imageUrl={event.image_url}
      eventName={event.name}
      eventDate={event.event_date}
      eventStartTime={event.start_time}
      venueName={event.venue_name}
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
  eventDate: string | null;
  eventStartTime: string | null;
  venueName: string | null;
  imageUrl: string | null;
  filter: EventPassFilter;
  passes: Pass[];
  isLoading: boolean;
  listError: string | null;
  onGoToEventDetail: () => void;
};

function MobileViewport({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.viewportOuter}>
      <View style={styles.viewportInner}>{children}</View>
    </View>
  );
}

function EventPassesContent({
  eventName,
  eventDate,
  eventStartTime,
  venueName,
  imageUrl,
  filter,
  passes,
  isLoading,
  listError,
  onGoToEventDetail,
}: EventPassesContentProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sort, setSort] = useState<EventPassSort>(DEFAULT_EVENT_PASS_SORT);
  const sortOptions = useMemo(() => getEventPassSortOptions(filter), [filter]);
  const activeSort = useMemo(
    () => (isEventPassSortKeyAllowed(filter, sort.key) ? sort : DEFAULT_EVENT_PASS_SORT),
    [filter, sort],
  );

  const listTitle = getEventPassListTitle(filter);
  const eventDateLine = useMemo(() => {
    const formatted = formatEventDateTimeLong(eventDate, eventStartTime);
    return formatted ? formatted.toUpperCase() : null;
  }, [eventDate, eventStartTime]);
  const venueLine = formatVenueLine(venueName);
  const showVenue = shouldShowVenueLine(venueName, eventName);

  const visiblePasses = useMemo(
    () => prepareEventPassList(passes, searchQuery, activeSort),
    [passes, searchQuery, activeSort],
  );

  const countLabel = isLoading
    ? 'Loading…'
    : searchQuery.trim()
      ? `${visiblePasses.length} of ${passes.length} ticket${passes.length === 1 ? '' : 's'}`
      : `${passes.length} ticket${passes.length === 1 ? '' : 's'}`;

  return (
    <MobileViewport>
      <View style={styles.screen}>
        <EventScreenBackground eventName={eventName} imageUrl={imageUrl} />

        <SafeAreaView edges={['top', 'bottom']} style={styles.foreground}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <View style={styles.topBar}>
              <Pressable onPress={onGoToEventDetail} style={styles.backHit}>
                <Text style={styles.backText}>← Event</Text>
              </Pressable>
              <View style={styles.topBarSpacer} />
            </View>

            <View style={styles.commandPanel}>
              <View style={styles.metaBlock}>
                {eventDateLine ? <Text style={styles.dateLine}>{eventDateLine}</Text> : null}
                <Text numberOfLines={2} style={styles.eventTitle}>
                  {eventName}
                </Text>
                {showVenue ? <Text style={styles.venueLine}>{venueLine}</Text> : null}
                <Text style={styles.listEyebrow}>{listTitle.toUpperCase()}</Text>
                <Text style={styles.countLine}>{countLabel}</Text>
              </View>

              <View style={styles.toolbar}>
                <Text style={styles.toolbarLabel}>Search</Text>
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  clearButtonMode="while-editing"
                  placeholder="Name, email, phone, type, status…"
                  placeholderTextColor={chrome.input.placeholder}
                  style={styles.searchInput}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />

                <Text style={styles.toolbarLabel}>Sort</Text>
                <ScrollView
                  horizontal
                  contentContainerStyle={styles.sortRow}
                  showsHorizontalScrollIndicator={false}>
                  {sortOptions.map((option) => {
                    const isActive = activeSort.key === option.key;
                    const arrow = isActive ? (activeSort.direction === 'asc' ? ' ↑' : ' ↓') : '';

                    return (
                      <Pressable
                        key={option.key}
                        onPress={() => setSort((current) => toggleEventPassSort(current, option.key))}
                        style={({ pressed }) => [
                          styles.sortChip,
                          isActive && styles.sortChipActive,
                          pressed && styles.pressed,
                        ]}>
                        <Text style={[styles.sortChipText, isActive && styles.sortChipTextActive]}>
                          {option.label}
                          {arrow}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            </View>

            {listError ? <ThemedText style={styles.errorText}>{listError}</ThemedText> : null}

            {isLoading ? (
              <View style={styles.listShell}>
                <View style={styles.loadingBlock}>
                  <ActivityIndicator color={fan.primary} size="large" />
                </View>
              </View>
            ) : visiblePasses.length === 0 ? (
              <View style={styles.listShell}>
                <View style={styles.emptyBlock}>
                  <ThemedText themeColor="textSecondary" style={styles.emptyText}>
                    {passes.length === 0
                      ? filter === 'checked_in'
                        ? 'No guests checked in yet.'
                        : 'No tickets issued yet. Issue a ticket from the event screen.'
                      : 'No tickets match your search.'}
                  </ThemedText>
                </View>
              </View>
            ) : (
              <View style={styles.passList}>
                {visiblePasses.map((pass) => (
                  <View key={pass.id} style={styles.passRow}>
                    <EventPassListRow eventName={eventName} pass={pass} />
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </View>
    </MobileViewport>
  );
}

const styles = StyleSheet.create({
  viewportOuter: {
    alignItems: 'center',
    backgroundColor: palette.pureBlack,
    flex: 1,
  },
  viewportInner: {
    backgroundColor: palette.pureBlack,
    flex: 1,
    maxWidth: MOBILE_VIEWPORT_WIDTH,
    width: '100%',
    ...webViewportMinHeight,
  },
  screen: {
    backgroundColor: palette.pureBlack,
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  foreground: {
    flex: 1,
    zIndex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    gap: Spacing.three,
    paddingBottom: LAYOUT.panelBottomInset,
    paddingHorizontal: LAYOUT.horizontalPadding,
    paddingTop: LAYOUT.contentTopInset,
  },
  centered: {
    alignItems: 'center',
    backgroundColor: palette.pureBlack,
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: LAYOUT.horizontalPadding,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.two,
  },
  topBarSpacer: {
    width: 48,
  },
  backHit: {
    paddingVertical: Spacing.one,
  },
  backText: {
    color: fan.badgeText,
    fontSize: 15,
    fontWeight: '700',
  },
  commandPanel: {
    backgroundColor: passScreen.credential.cardBackground,
    borderColor: passScreen.credential.cardBorder,
    borderRadius: passScreen.credential.borderRadius,
    borderWidth: 1,
    gap: Spacing.three,
    marginTop: LAYOUT.panelTopInset,
    paddingBottom: passScreen.credential.paddingBottom,
    paddingHorizontal: passScreen.credential.paddingHorizontal,
    paddingTop: passScreen.credential.paddingTop,
    ...shadows.walletCardStyle,
  },
  metaBlock: {
    alignItems: 'center',
    gap: 4,
  },
  dateLine: {
    color: fan.badgeText,
    fontSize: LAYOUT.date.fontSize,
    fontWeight: '600',
    letterSpacing: LAYOUT.date.letterSpacing,
    lineHeight: LAYOUT.date.lineHeight,
    textAlign: 'center',
  },
  eventTitle: {
    ...organizerEventTitleStyle.title,
  },
  venueLine: {
    color: text.secondary,
    fontSize: LAYOUT.subtitle.fontSize,
    fontWeight: '600',
    letterSpacing: LAYOUT.subtitle.letterSpacing,
    lineHeight: LAYOUT.subtitle.lineHeight,
    textAlign: 'center',
  },
  listEyebrow: {
    borderColor: fan.muted,
    borderRadius: 999,
    borderWidth: 1,
    color: fan.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    textAlign: 'center',
  },
  countLine: {
    color: text.secondary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: Spacing.half,
    textAlign: 'center',
  },
  toolbar: {
    gap: Spacing.two,
    width: '100%',
  },
  toolbarLabel: {
    color: fan.badgeText,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
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
    backgroundColor: 'rgba(162, 91, 255, 0.14)',
    borderColor: fan.primary,
  },
  sortChipText: {
    color: text.secondary,
    fontSize: 12,
    fontWeight: '700',
  },
  sortChipTextActive: {
    color: fan.badgeText,
  },
  listShell: {
    backgroundColor: passScreen.credential.cardBackground,
    borderColor: passScreen.credential.cardBorder,
    borderRadius: passScreen.credential.borderRadius,
    borderWidth: 1,
    overflow: 'hidden',
    ...shadows.walletCardStyle,
  },
  passList: {
    gap: Spacing.four,
  },
  passRow: {
    backgroundColor: passScreen.credential.cardBackground,
    borderColor: passScreen.credential.cardBorder,
    borderRadius: passScreen.credential.borderRadius,
    borderWidth: 1,
    overflow: 'hidden',
    ...shadows.walletCardStyle,
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
    marginTop: Spacing.two,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.88,
  },
});
