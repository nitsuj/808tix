import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MissingProfileScreen } from '@/components/organizer/missing-profile-screen';
import { ThemedText } from '@/components/themed-text';
import { EventScreenBackground } from '@/components/ui/event-screen-background';
import { OrganizerAmbientBackground } from '@/components/ui/organizer-ambient-background';
import { OrganizerMobileViewport } from '@/components/ui/organizer-mobile-viewport';
import {
  fan,
  organizer,
  organizerOpsScreen,
  palette,
  semantic,
  text,
} from '@/theme';
import { organizerEventDisplayTitleStyle } from '@/theme/organizer-event-title';
import { Radii, Spacing } from '@/constants/theme';
import { useOrganizerAuthGate } from '@/hooks/use-organizer-auth-gate';
import { useOrganizerAuthRedirect } from '@/hooks/use-organizer-auth-redirect';
import { useEventDetail } from '@/hooks/use-event-detail';
import { formatEventDateTimeLong } from '@/lib/event-datetime-display';
import {
  getEventStatusPillLabel,
  isEventDraft,
  isEventLive,
  PUBLISH_BEFORE_SCAN_MESSAGE,
} from '@/lib/event-status';
import { publishEvent } from '@/lib/publish-event';
import { formatVenueLine, shouldShowVenueLine } from '@/lib/event-display';
import { formatCheckInRatePercent } from '@/lib/event-stats';
import { navigateToEventPassList } from '@/lib/event-pass-navigation';
import { ORGANIZER_DASHBOARD_ROUTE, safeRouterBack } from '@/lib/safe-router-back';
import type { Event } from '@/lib/database.types';

const MOBILE_VIEWPORT_WIDTH = 390;

const LAYOUT = {
  horizontalPadding: 24,
  contentTopInset: 12,
  panelTopInset: 72,
  panelBottomInset: 32,
  metaToStats: 28,
  statsToProgress: 16,
  progressToActions: 24,
  actionsGap: 10,
  date: { fontSize: 11, lineHeight: 14, letterSpacing: 1.2 },
  title: { fontSize: 28, lineHeight: 32, letterSpacing: 0.6 },
  subtitle: { fontSize: 14, lineHeight: 18, letterSpacing: 0.4 },
  statValue: { fontSize: 20, lineHeight: 24 },
  statLabel: { fontSize: 10, lineHeight: 12, letterSpacing: 0.7 },
} as const;

const ARTWORK_UPLOAD_FAILED_MESSAGE =
  'Your event was created, but artwork could not be uploaded. Open Edit Event to try again.';

export default function EventDetailScreen() {
  const router = useRouter();
  const { eventId, artworkUploadFailed, refreshStats } = useLocalSearchParams<{
    eventId: string;
    artworkUploadFailed?: string;
    refreshStats?: string;
  }>();
  const authGate = useOrganizerAuthGate();
  const { event, issuedCount, checkedInCount, remainingCount, isLoading, error, refetch } =
    useEventDetail(eventId);

  useEffect(() => {
    if (refreshStats) {
      void refetch();
    }
  }, [refreshStats, refetch]);

  const goToDashboard = useCallback(() => {
    safeRouterBack(router, ORGANIZER_DASHBOARD_ROUTE);
  }, [router]);

  useOrganizerAuthRedirect(authGate.state);

  if (authGate.state === 'loading' || isLoading) {
    return (
      <OrganizerMobileViewport background={<OrganizerAmbientBackground variant="subtle" />}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={fan.primary} />
        </View>
      </OrganizerMobileViewport>
    );
  }

  if (authGate.state === 'unauthenticated') {
    return null;
  }

  if (authGate.state === 'profile_missing') {
    return <MissingProfileScreen email={authGate.email} onSignOut={authGate.signOut} />;
  }

  if (error || !event) {
    return (
      <OrganizerMobileViewport background={<OrganizerAmbientBackground variant="subtle" />}>
        <View style={styles.screen}>
          <SafeAreaView style={styles.errorSafeArea}>
            <Pressable onPress={goToDashboard} style={styles.backHit}>
              <Text style={styles.backText}>← Dashboard</Text>
            </Pressable>
            <ThemedText style={styles.errorText}>{error ?? 'Event not found.'}</ThemedText>
          </SafeAreaView>
        </View>
      </OrganizerMobileViewport>
    );
  }

  const showArtworkUploadWarning = artworkUploadFailed === '1';

  return (
    <EventDetailContent
      artworkUploadWarning={
        showArtworkUploadWarning ? ARTWORK_UPLOAD_FAILED_MESSAGE : undefined
      }
      checkedInCount={checkedInCount}
      event={event}
      issuedCount={issuedCount}
      remainingCount={remainingCount}
      onGoToDashboard={goToDashboard}
      onRefetch={refetch}
      router={router}
    />
  );
}

type EventDetailContentProps = {
  event: Event;
  issuedCount: number;
  checkedInCount: number;
  remainingCount: number;
  artworkUploadWarning?: string;
  onGoToDashboard: () => void;
  onRefetch: () => Promise<void>;
  router: ReturnType<typeof useRouter>;
};

function EventDetailContent({
  event,
  issuedCount,
  checkedInCount,
  remainingCount,
  artworkUploadWarning,
  onGoToDashboard,
  onRefetch,
  router,
}: EventDetailContentProps) {
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const dateTimeLine = formatEventDateTimeLong(event.event_date, event.start_time)?.toUpperCase() ?? null;
  const checkInRate = formatCheckInRatePercent({
    issuedCount,
    checkedInCount,
    capacity: event.capacity,
    remainingCount,
  });
  const isLive = isEventLive(event.status);
  const isDraft = isEventDraft(event.status);
  const statusPillLabel = getEventStatusPillLabel(event.status);
  const showStatusPill = !isLive && !isDraft;
  const showVenue = shouldShowVenueLine(event.venue_name, event.name);
  const venueLine = formatVenueLine(event.venue_name);
  const canOperatePasses = isLive;

  async function handlePublishEvent() {
    setIsPublishing(true);
    setPublishError(null);

    const outcome = await publishEvent(event.id);

    setIsPublishing(false);

    if (!outcome.ok) {
      setPublishError(outcome.error);
      return;
    }

    await onRefetch();
  }

  return (
    <OrganizerMobileViewport
      background={
        <EventScreenBackground eventName={event.name} imageUrl={event.image_url} />
      }>
      <View style={styles.screen}>
        <SafeAreaView edges={['top', 'bottom']} style={styles.foreground}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}>
            <View style={styles.topBar}>
              <Pressable onPress={onGoToDashboard} style={styles.backHit}>
                <Text style={styles.backText}>← Dashboard</Text>
              </Pressable>
              {isLive ? (
                <View style={styles.liveBadge}>
                  <Text style={styles.liveBadgeText}>● LIVE</Text>
                </View>
              ) : isDraft ? (
                <View style={styles.draftBadge}>
                  <Text style={styles.draftBadgeText}>DRAFT</Text>
                </View>
              ) : (
                <View style={styles.topBarSpacer} />
              )}
            </View>

            <View style={styles.commandPanel}>
              {artworkUploadWarning ? (
                <View style={styles.warningBanner}>
                  <Text style={styles.warningBannerText}>{artworkUploadWarning}</Text>
                </View>
              ) : null}
              <View style={styles.metaBlock}>
                {dateTimeLine ? <Text style={styles.dateLine}>{dateTimeLine}</Text> : null}
                <Text style={styles.eventTitle}>{event.name}</Text>
                {showVenue ? <Text style={styles.venueLine}>{venueLine}</Text> : null}
                {showStatusPill ? (
                  <View
                    style={[
                      styles.statusPill,
                      isDraft && styles.statusPillDraft,
                      isLive && styles.statusPillLive,
                    ]}>
                    <Text
                      style={[
                        styles.statusPillText,
                        isDraft && styles.statusPillTextDraft,
                        isLive && styles.statusPillTextLive,
                      ]}>
                      {statusPillLabel}
                    </Text>
                  </View>
                ) : null}
              </View>

              {isDraft ? (
                <Text style={styles.draftHint}>{PUBLISH_BEFORE_SCAN_MESSAGE}</Text>
              ) : null}

              <View style={styles.statsPanel}>
                <View style={styles.statsRow}>
                  <StatChip
                    label="Issued"
                    value={String(issuedCount)}
                    onPress={
                      canOperatePasses
                        ? () => navigateToEventPassList(router, event.id, 'issued')
                        : undefined
                    }
                  />
                  <StatChip
                    label="Checked In"
                    value={String(checkedInCount)}
                    onPress={
                      canOperatePasses
                        ? () => navigateToEventPassList(router, event.id, 'checked_in')
                        : undefined
                    }
                  />
                </View>
                <View style={styles.statsRow}>
                  <StatChip label="Remaining" value={String(remainingCount)} />
                  <StatChip label="Check-In Rate" value={`${checkInRate}%`} accent={false} />
                </View>
              </View>

              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${checkInRate}%` }]} />
              </View>

              {publishError ? <Text style={styles.publishErrorText}>{publishError}</Text> : null}

              <View style={styles.actionsBlock}>
                {isDraft ? (
                  <>
                    <Pressable
                      disabled={isPublishing}
                      onPress={handlePublishEvent}
                      style={({ pressed }) => [
                        styles.actionButton,
                        styles.actionPrimary,
                        pressed && !isPublishing && styles.pressed,
                        isPublishing && styles.actionDisabled,
                      ]}>
                      {isPublishing ? (
                        <ActivityIndicator color={organizer.accent} />
                      ) : (
                        <Text style={styles.actionPrimaryText}>Publish Event</Text>
                      )}
                    </Pressable>

                    <Pressable
                      onPress={() => router.push(`/events/${event.id}/edit` as Href)}
                      style={({ pressed }) => [
                        styles.actionButton,
                        styles.actionSecondary,
                        pressed && styles.pressed,
                      ]}>
                      <Text style={styles.actionSecondaryText}>Edit Event</Text>
                    </Pressable>

                    <View style={styles.disabledActionsGroup}>
                      <View style={[styles.actionButton, styles.actionDisabledButton]}>
                        <Text style={styles.actionDisabledText}>Issue Pass</Text>
                      </View>
                      <View style={[styles.actionButton, styles.actionDisabledButton]}>
                        <Text style={styles.actionDisabledText}>Scan Passes</Text>
                      </View>
                    </View>
                  </>
                ) : (
                  <>
                    <Pressable
                      onPress={() => router.push(`/events/${event.id}/issue` as Href)}
                      style={({ pressed }) => [
                        styles.actionButton,
                        styles.actionPrimary,
                        pressed && styles.pressed,
                      ]}>
                      <Text style={styles.actionPrimaryText}>Issue Pass</Text>
                    </Pressable>

                    <Pressable
                      onPress={() => router.push(`/events/${event.id}/scan` as Href)}
                      style={({ pressed }) => [
                        styles.actionButton,
                        styles.actionSecondary,
                        pressed && styles.pressed,
                      ]}>
                      <Text style={styles.actionSecondaryText}>Scan Passes</Text>
                    </Pressable>

                    <Pressable
                      onPress={() => router.push(`/events/${event.id}/edit` as Href)}
                      style={({ pressed }) => [
                        styles.actionButton,
                        styles.actionSecondary,
                        pressed && styles.pressed,
                      ]}>
                      <Text style={styles.actionSecondaryText}>Edit Event</Text>
                    </Pressable>
                  </>
                )}
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    </OrganizerMobileViewport>
  );
}

function StatChip({
  label,
  value,
  onPress,
  accent = true,
}: {
  label: string;
  value: string;
  onPress?: () => void;
  accent?: boolean;
}) {
  const content = (
    <>
      <Text style={[styles.statValue, accent && styles.statValueAccent]}>{value}</Text>
      <Text style={styles.statLabel}>{label.toUpperCase()}</Text>
      {onPress ? <Text style={styles.statTapHint}>View list ›</Text> : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.statChip, pressed && styles.pressed]}>
        {content}
      </Pressable>
    );
  }

  return <View style={styles.statChip}>{content}</View>;
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: 'transparent',
    flex: 1,
    position: 'relative',
  },
  foreground: {
    backgroundColor: 'transparent',
    flex: 1,
    zIndex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: LAYOUT.panelBottomInset,
    paddingHorizontal: LAYOUT.horizontalPadding,
    paddingTop: LAYOUT.contentTopInset,
  },
  centered: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    flex: 1,
    justifyContent: 'center',
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
    ...organizerOpsScreen.backLink,
  },
  liveBadge: {
    backgroundColor: organizerOpsScreen.liveBadge.backgroundColor,
    borderColor: organizerOpsScreen.liveBadge.borderColor,
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  liveBadgeText: {
    color: organizerOpsScreen.liveBadge.color,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  draftBadge: {
    backgroundColor: organizerOpsScreen.draftBadge.backgroundColor,
    borderColor: organizerOpsScreen.draftBadge.borderColor,
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  draftBadgeText: {
    color: organizerOpsScreen.draftBadge.color,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  commandPanel: {
    ...organizerOpsScreen.panel,
    alignSelf: 'center',
    gap: 0,
    marginTop: LAYOUT.panelTopInset,
    maxWidth: MOBILE_VIEWPORT_WIDTH - LAYOUT.horizontalPadding * 2,
    width: '100%',
  },
  warningBanner: {
    backgroundColor: 'rgba(255, 196, 64, 0.12)',
    borderColor: 'rgba(255, 196, 64, 0.45)',
    borderRadius: Radii.input,
    borderWidth: 1,
    marginBottom: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  warningBannerText: {
    color: text.primary,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    textAlign: 'center',
  },
  metaBlock: {
    alignItems: 'center',
    gap: 0,
    marginBottom: LAYOUT.metaToStats,
  },
  dateLine: {
    ...organizerOpsScreen.meta.date,
    marginBottom: 8,
    textAlign: 'center',
  },
  eventTitle: {
    ...organizerEventDisplayTitleStyle.title,
    marginBottom: 6,
  },
  venueLine: {
    ...organizerOpsScreen.meta.venue,
    textAlign: 'center',
  },
  statusPill: {
    ...organizerOpsScreen.statusPill.base,
  },
  statusPillDraft: {
    backgroundColor: organizerOpsScreen.statusPill.draft.backgroundColor,
    borderColor: organizerOpsScreen.statusPill.draft.borderColor,
  },
  statusPillLive: {
    backgroundColor: organizerOpsScreen.statusPill.live.backgroundColor,
    borderColor: organizerOpsScreen.statusPill.live.borderColor,
  },
  statusPillText: {
    ...organizerOpsScreen.statusPill.text,
    color: text.secondary,
  },
  statusPillTextDraft: {
    color: organizerOpsScreen.statusPill.draft.color,
  },
  statusPillTextLive: {
    color: organizerOpsScreen.statusPill.live.color,
  },
  draftHint: {
    color: text.secondary,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    marginBottom: Spacing.two,
    textAlign: 'center',
  },
  publishErrorText: {
    color: semantic.errorSoft,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: Spacing.one,
    textAlign: 'center',
  },
  statsPanel: {
    gap: Spacing.two,
    marginBottom: LAYOUT.statsToProgress,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  statChip: {
    alignItems: 'center',
    backgroundColor: organizerOpsScreen.statChip.backgroundColor,
    borderColor: organizerOpsScreen.statChip.borderColor,
    borderRadius: Radii.card,
    borderWidth: 1,
    flex: 1,
    gap: 4,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two + 2,
  },
  statValue: {
    color: text.primary,
    fontSize: LAYOUT.statValue.fontSize,
    fontWeight: '700',
    lineHeight: LAYOUT.statValue.lineHeight,
  },
  statValueAccent: {
    color: organizerOpsScreen.statChip.valueAccent,
  },
  statLabel: {
    color: text.muted,
    fontSize: LAYOUT.statLabel.fontSize,
    fontWeight: '600',
    letterSpacing: LAYOUT.statLabel.letterSpacing,
    lineHeight: LAYOUT.statLabel.lineHeight,
    textAlign: 'center',
  },
  statTapHint: {
    color: organizerOpsScreen.statChip.tapHint,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  progressTrack: {
    backgroundColor: organizerOpsScreen.progress.track,
    borderRadius: 999,
    height: 6,
    marginBottom: LAYOUT.progressToActions,
    overflow: 'hidden',
    width: '100%',
  },
  progressFill: {
    backgroundColor: organizerOpsScreen.progress.fill,
    borderRadius: 999,
    height: '100%',
  },
  actionsBlock: {
    gap: LAYOUT.actionsGap,
  },
  actionButton: {
    alignItems: 'center',
    borderRadius: Radii.button,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  actionPrimary: {
    backgroundColor: organizerOpsScreen.button.primary.backgroundColor,
    borderColor: organizerOpsScreen.button.primary.borderColor,
    borderWidth: organizerOpsScreen.button.primary.borderWidth,
  },
  actionPrimaryText: {
    color: organizerOpsScreen.button.primary.text,
    ...organizerOpsScreen.button.text,
  },
  actionSecondary: {
    backgroundColor: organizerOpsScreen.button.secondary.backgroundColor,
    borderColor: organizerOpsScreen.button.secondary.borderColor,
    borderWidth: organizerOpsScreen.button.secondary.borderWidth,
  },
  actionSecondaryText: {
    color: organizerOpsScreen.button.secondary.text,
    fontSize: 15,
    fontWeight: '700',
  },
  disabledActionsGroup: {
    gap: LAYOUT.actionsGap,
    marginTop: Spacing.one,
  },
  actionDisabledButton: {
    backgroundColor: organizerOpsScreen.button.disabled.backgroundColor,
    borderColor: organizerOpsScreen.button.disabled.borderColor,
    borderWidth: 1,
    opacity: 0.55,
  },
  actionDisabledText: {
    color: organizerOpsScreen.button.disabled.text,
    fontSize: 15,
    fontWeight: '600',
  },
  actionDisabled: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.88,
  },
  errorSafeArea: {
    flex: 1,
    gap: Spacing.three,
    paddingHorizontal: LAYOUT.horizontalPadding,
  },
  errorText: {
    color: semantic.errorSoft,
    fontSize: 15,
  },
});
