import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MissingProfileScreen } from '@/components/organizer/missing-profile-screen';
import {
  EventArtworkUploadField,
  type PendingArtworkSelection,
} from '@/components/organizer/event-artwork-upload-field';
import { EventDateFormField } from '@/components/organizer/event-date-form-field';
import { EventFormField, eventFormStyles } from '@/components/organizer/event-form-fields';
import { EventStartTimeField } from '@/components/organizer/event-start-time-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radii, Spacing } from '@/constants/theme';
import {
  chrome,
  fan,
  organizer,
  palette,
  passScreen,
  semantic,
  shadows,
  text,
} from '@/theme';
import { organizerEventTitleStyle } from '@/theme/organizer-event-title';
import { EventScreenBackground } from '@/components/ui/event-screen-background';
import { useOrganizerAuthGate } from '@/hooks/use-organizer-auth-gate';
import { useOrganizerAuthRedirect } from '@/hooks/use-organizer-auth-redirect';
import { useEventDetail } from '@/hooks/use-event-detail';
import {
  formatEventStatus,
  formatTimeForInput,
  formatVenueLine,
  shouldShowVenueLine,
} from '@/lib/event-display';
import { formatEventDateTimeLong } from '@/lib/event-datetime-display';
import {
  isEventDateTodayOrFuture,
  parseMaxPassesInput,
  validateEditEventForm,
  type EditEventFieldErrors,
} from '@/lib/event-form';
import { prepareEventFormForSubmit } from '@/lib/event-form-submit';
import type { Event } from '@/lib/database.types';
import { uploadEventArtwork } from '@/lib/event-artwork-storage';
import { validateEventArtworkFile } from '@/lib/event-artwork-validation';
import { supabase } from '@/lib/supabase';

export default function EditEventScreen() {
  const router = useRouter();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const authGate = useOrganizerAuthGate();
  const { event, issuedCount, isLoading, error, refetch } = useEventDetail(eventId);

  useOrganizerAuthRedirect(authGate.state);

  if (authGate.state === 'loading' || isLoading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" color={fan.primary} />
      </ThemedView>
    );
  }

  if (authGate.state === 'unauthenticated') {
    return null;
  }

  if (authGate.state === 'profile_missing') {
    return <MissingProfileScreen email={authGate.email} onSignOut={authGate.signOut} />;
  }

  if (error || !event || !eventId) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText style={styles.errorText}>{error ?? 'Event not found.'}</ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <EditEventForm
      event={event}
      eventId={eventId}
      issuedCount={issuedCount}
      refetch={refetch}
    />
  );
}

type EditEventFormProps = {
  event: Event;
  eventId: string;
  issuedCount: number;
  refetch: () => Promise<void>;
};

function EditEventForm({ event, eventId, issuedCount, refetch }: EditEventFormProps) {
  const router = useRouter();
  const goToEventDetail = () => {
    router.replace(`/events/${eventId}` as Href);
  };
  const [eventName, setEventName] = useState(event.name);
  const [venueName, setVenueName] = useState(event.venue_name ?? '');
  const [eventDate, setEventDate] = useState(event.event_date ?? '');
  const [startTime, setStartTime] = useState(() => formatTimeForInput(event.start_time));
  const [maxPasses, setMaxPasses] = useState(String(event.capacity));
  const [fieldErrors, setFieldErrors] = useState<EditEventFieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingArtwork, setPendingArtwork] = useState<PendingArtworkSelection | null>(null);

  async function handleSave() {
    const prepared = prepareEventFormForSubmit({
      eventName,
      venueName,
      eventDate,
      startTime,
      maxPasses,
    });

    if (prepared.values.startTime !== startTime) {
      setStartTime(prepared.values.startTime);
    }

    if (!isEventDateTodayOrFuture(prepared.values.eventDate)) {
      setFieldErrors({
        ...prepared.errors,
        eventDate: 'Event date must be today or in the future.',
      });
      return;
    }

    const editErrors = validateEditEventForm(prepared.values, issuedCount);

    if (Object.keys(editErrors).length > 0 || !prepared.normalizedStartTime) {
      setFieldErrors(editErrors);
      return;
    }

    const capacity = parseMaxPassesInput(prepared.values.maxPasses);

    if (capacity === null) {
      setFieldErrors({ maxPasses: 'Enter a whole number of at least 1.' });
      return;
    }
    const normalizedStart = prepared.normalizedStartTime;

    setFieldErrors({});
    setSubmitError(null);
    setIsSubmitting(true);

    let imageUrl = event.image_url;

    if (pendingArtwork) {
      const artworkValidationError = validateEventArtworkFile(
        pendingArtwork.mimeType,
        pendingArtwork.fileSize,
      );

      if (artworkValidationError) {
        setIsSubmitting(false);
        setSubmitError(artworkValidationError);
        return;
      }

      try {
        imageUrl = await uploadEventArtwork(
          eventId,
          pendingArtwork.localUri,
          pendingArtwork.mimeType,
          pendingArtwork.fileSize,
        );
      } catch (uploadError) {
        setIsSubmitting(false);
        setSubmitError(
          uploadError instanceof Error ? uploadError.message : 'Could not upload artwork.',
        );
        return;
      }
    }

    const { error: updateError } = await supabase
      .from('events')
      .update({
        name: prepared.values.eventName.trim(),
        venue_name: prepared.values.venueName.trim(),
        event_date: prepared.values.eventDate.trim(),
        start_time: normalizedStart,
        capacity,
        ...(pendingArtwork ? { image_url: imageUrl } : {}),
      })
      .eq('id', eventId);

    setIsSubmitting(false);

    if (updateError) {
      if (updateError.message.includes('issued passes')) {
        setFieldErrors({
          maxPasses: `Max passes cannot be less than ${issuedCount} issued.`,
        });
      } else {
        setSubmitError(updateError.message);
      }
      return;
    }

    await refetch();
    goToEventDetail();
  }

  const previewTitle = eventName.trim() || 'Edit event';
  const previewVenue = formatVenueLine(venueName);
  const showPreviewVenue = shouldShowVenueLine(venueName, previewTitle);

  const previewDateLine = useMemo(() => {
    if (!eventDate.trim()) {
      return 'SET DATE & TIME';
    }

    const formatted = formatEventDateTimeLong(eventDate, startTime.trim() || null);
    return formatted ? formatted.toUpperCase() : eventDate;
  }, [eventDate, startTime]);

  const statusPill = formatEventStatus(event.status).toUpperCase();

  return (
    <MobileViewport>
      <View style={styles.screen}>
        <EventScreenBackground
          eventName={previewTitle}
          imageUrl={event.image_url}
          pendingLocalUri={pendingArtwork?.localUri}
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}>
          <SafeAreaView edges={['top', 'bottom']} style={styles.foreground}>
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              <View style={styles.topBar}>
                <Pressable
                  disabled={isSubmitting}
                  onPress={goToEventDetail}
                  style={({ pressed }) => [styles.backHit, pressed && styles.pressed]}>
                  <Text style={styles.backText}>← Event</Text>
                </Pressable>
                <View style={styles.topBarSpacer} />
              </View>

              <View style={styles.commandPanel}>
                <View style={styles.metaBlock}>
                  <Text style={styles.dateLine}>{previewDateLine}</Text>
                  <Text style={styles.eventTitle}>{previewTitle}</Text>
                  {showPreviewVenue ? <Text style={styles.venueLine}>{previewVenue}</Text> : null}
                  <Text style={styles.statusPill}>{statusPill}</Text>
                </View>

                <EventArtworkUploadField
                  disabled={isSubmitting}
                  eventName={previewTitle}
                  existingImageUrl={event.image_url}
                  pendingSelection={pendingArtwork}
                  previewMode="background"
                  onSelectionChange={setPendingArtwork}
                />

                <View style={eventFormStyles.formPanel}>
                  <EventFormField
                    autoCapitalize="none"
                    autoCorrect={false}
                    error={fieldErrors.eventName}
                    label="Event Name"
                    placeholder="Summer Rooftop Session"
                    value={eventName}
                    onChangeText={setEventName}
                  />
                  <EventFormField
                    error={fieldErrors.venueName}
                    label="Venue"
                    placeholder="The Loft"
                    value={venueName}
                    onChangeText={setVenueName}
                  />
                  <EventDateFormField
                    disabled={isSubmitting}
                    error={fieldErrors.eventDate}
                    label="Date"
                    value={eventDate}
                    onChange={setEventDate}
                  />
                  <EventStartTimeField
                    error={fieldErrors.startTime}
                    hint="24-hour HH:MM (e.g. 21:00 or 1900)"
                    label="Start Time"
                    placeholder="21:00"
                    value={startTime}
                    onChange={setStartTime}
                  />
                  <EventFormField
                    error={fieldErrors.maxPasses}
                    hint={`Minimum ${issuedCount} (issued)`}
                    keyboardType="number-pad"
                    label="Max Passes"
                    placeholder="100"
                    value={maxPasses}
                    onChangeText={(text) => setMaxPasses(text.replace(/[^\d]/g, ''))}
                  />
                </View>

                {submitError ? (
                  <ThemedText style={styles.errorText}>{submitError}</ThemedText>
                ) : null}

                <Pressable
                  disabled={isSubmitting}
                  onPress={handleSave}
                  style={({ pressed }) => [
                    styles.actionButton,
                    styles.actionPrimary,
                    pressed && styles.pressed,
                    isSubmitting && styles.disabled,
                  ]}>
                  {isSubmitting ? (
                    <ActivityIndicator color={chrome.white} />
                  ) : (
                    <Text style={styles.actionPrimaryText}>Save Changes</Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </View>
    </MobileViewport>
  );
}

const MOBILE_VIEWPORT_WIDTH = 390;

const LAYOUT = {
  horizontalPadding: 24,
  contentTopInset: 12,
  panelTopInset: 56,
  panelBottomInset: 32,
  formToActions: 20,
  date: { fontSize: 11, lineHeight: 14, letterSpacing: 1.2 },
  title: { fontSize: 28, lineHeight: 32, letterSpacing: 0.6 },
  subtitle: { fontSize: 14, lineHeight: 18, letterSpacing: 0.4 },
} as const;

const webViewportMinHeight =
  Platform.OS === 'web' ? ({ minHeight: '100dvh' } as const) : null;

function MobileViewport({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.viewportOuter}>
      <View style={styles.viewportInner}>{children}</View>
    </View>
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
  // Used by EditEventScreen error/loading fallback UI.
  container: {
    backgroundColor: palette.pureBlack,
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  screen: {
    backgroundColor: palette.pureBlack,
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  keyboardView: {
    flex: 1,
  },
  foreground: {
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
    flex: 1,
    alignItems: 'center',
    backgroundColor: palette.pureBlack,
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
    color: fan.badgeText,
    fontSize: 15,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.88,
  },
  disabled: {
    opacity: 0.6,
  },
  commandPanel: {
    alignSelf: 'center',
    backgroundColor: passScreen.credential.cardBackground,
    borderColor: passScreen.credential.cardBorder,
    borderRadius: passScreen.credential.borderRadius,
    borderWidth: 1,
    gap: Spacing.three,
    marginTop: LAYOUT.panelTopInset,
    maxWidth: MOBILE_VIEWPORT_WIDTH - LAYOUT.horizontalPadding * 2,
    paddingBottom: passScreen.credential.paddingBottom,
    paddingHorizontal: passScreen.credential.paddingHorizontal,
    paddingTop: passScreen.credential.paddingTop,
    shadowColor: shadows.walletCard.shadowColor,
    shadowOffset: shadows.walletCard.shadowOffset,
    shadowOpacity: shadows.walletCard.shadowOpacity,
    shadowRadius: shadows.walletCard.shadowRadius,
    width: '100%',
  },
  metaBlock: {
    alignItems: 'center',
    gap: 0,
    marginBottom: Spacing.one,
  },
  dateLine: {
    color: fan.badgeText,
    fontSize: LAYOUT.date.fontSize,
    fontWeight: '600',
    letterSpacing: LAYOUT.date.letterSpacing,
    lineHeight: LAYOUT.date.lineHeight,
    marginBottom: 8,
    textAlign: 'center',
  },
  eventTitle: {
    ...organizerEventTitleStyle.title,
    marginBottom: 6,
  },
  venueLine: {
    color: text.secondary,
    fontSize: LAYOUT.subtitle.fontSize,
    fontWeight: '600',
    letterSpacing: LAYOUT.subtitle.letterSpacing,
    lineHeight: LAYOUT.subtitle.lineHeight,
    textAlign: 'center',
  },
  statusPill: {
    borderColor: organizer.accent,
    borderRadius: 999,
    borderWidth: 1,
    color: organizer.accent,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: Spacing.two,
    overflow: 'hidden',
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    textAlign: 'center',
  },
  errorText: {
    color: semantic.errorSoft,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  actionButton: {
    alignItems: 'center',
    borderRadius: Radii.button,
    justifyContent: 'center',
    marginTop: LAYOUT.formToActions,
    minHeight: 48,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  actionPrimary: {
    backgroundColor: fan.primary,
  },
  actionPrimaryText: {
    color: chrome.white,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
