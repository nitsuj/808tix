import { useRouter, type Href } from 'expo-router';
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

import {
  EventArtworkUploadField,
  type PendingArtworkSelection,
} from '@/components/organizer/event-artwork-upload-field';
import { EventDateFormField } from '@/components/organizer/event-date-form-field';
import { EventFormField, eventFormStyles } from '@/components/organizer/event-form-fields';
import { EventStartTimeField } from '@/components/organizer/event-start-time-field';
import { MissingProfileScreen } from '@/components/organizer/missing-profile-screen';
import { ThemedText } from '@/components/themed-text';
import { OrganizerAmbientBackground } from '@/components/ui/organizer-ambient-background';
import { Radii, Spacing } from '@/constants/theme';
import { useOrganizerAuthGate } from '@/hooks/use-organizer-auth-gate';
import { formatEventDateTimeLong } from '@/lib/event-datetime-display';
import { persistEventArtworkUrl, uploadEventArtwork } from '@/lib/event-artwork-storage';
import { validateEventArtworkFile } from '@/lib/event-artwork-validation';
import { parseMaxPassesInput, type CreateEventFieldErrors } from '@/lib/event-form';
import { prepareEventFormForSubmit } from '@/lib/event-form-submit';
import { isEventDateTodayOrFuture } from '@/lib/event-form';
import { generateUniqueEventSlug } from '@/lib/event-slug';
import { supabase } from '@/lib/supabase';
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

const DASHBOARD_ROUTE = '/' as Href;
const MOBILE_VIEWPORT_WIDTH = 390;
const ARTWORK_UPLOAD_FAILED_PARAM = 'artworkUploadFailed';

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

export default function CreateEventScreen() {
  const router = useRouter();
  const authGate = useOrganizerAuthGate();

  const [eventName, setEventName] = useState('');
  const [venueName, setVenueName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [maxPasses, setMaxPasses] = useState('');
  const [pendingArtwork, setPendingArtwork] = useState<PendingArtworkSelection | null>(null);
  const [fieldErrors, setFieldErrors] = useState<CreateEventFieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const previewTitle = eventName.trim() || 'New event';
  const previewDateLine = useMemo(() => {
    if (!eventDate.trim()) {
      return 'SET DATE & TIME';
    }

    const formatted = formatEventDateTimeLong(eventDate, startTime.trim() || null);
    return formatted ? formatted.toUpperCase() : eventDate;
  }, [eventDate, startTime]);

  const previewVenue = venueName.trim().toUpperCase() || 'VENUE TBD';
  const backgroundArtworkUri = pendingArtwork?.localUri ?? null;

  if (authGate.state === 'loading') {
    return (
      <MobileViewport>
        <View style={styles.centered}>
          <ActivityIndicator color={fan.primary} size="large" />
        </View>
      </MobileViewport>
    );
  }

  if (authGate.state === 'unauthenticated') {
    router.replace('/');
    return null;
  }

  if (authGate.state === 'profile_missing') {
    return <MissingProfileScreen email={authGate.email} onSignOut={authGate.signOut} />;
  }

  const organizerId = authGate.organizerId;

  async function handleCreateEvent() {
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

    if (Object.keys(prepared.errors).length > 0 || !prepared.normalizedStartTime) {
      setFieldErrors(prepared.errors);
      return;
    }

    const capacity = parseMaxPassesInput(prepared.values.maxPasses);

    if (capacity === null) {
      setFieldErrors({ maxPasses: 'Enter a whole number of at least 1.' });
      return;
    }

    const normalizedStart = prepared.normalizedStartTime;

    if (pendingArtwork) {
      const artworkValidationError = validateEventArtworkFile(
        pendingArtwork.mimeType,
        pendingArtwork.fileSize,
      );

      if (artworkValidationError) {
        setSubmitError(artworkValidationError);
        return;
      }
    }

    setFieldErrors({});
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const slug = await generateUniqueEventSlug(eventName, organizerId);

      const { data: createdEvent, error: insertError } = await supabase
        .from('events')
        .insert({
          organizer_id: organizerId,
          slug,
          name: prepared.values.eventName.trim(),
          venue_name: prepared.values.venueName.trim(),
          event_date: prepared.values.eventDate.trim(),
          start_time: normalizedStart,
          capacity,
          status: 'draft',
        })
        .select('id')
        .single();

      if (insertError || !createdEvent?.id) {
        setSubmitError(insertError?.message ?? 'Could not create event.');
        setIsSubmitting(false);
        return;
      }

      const eventId = createdEvent.id;
      let artworkUploadFailed = false;

      if (pendingArtwork) {
        try {
          const imageUrl = await uploadEventArtwork(
            eventId,
            pendingArtwork.localUri,
            pendingArtwork.mimeType,
            pendingArtwork.fileSize,
          );
          await persistEventArtworkUrl(eventId, imageUrl);
        } catch (uploadError) {
          artworkUploadFailed = true;
          console.warn(
            '[create-event] Artwork upload failed after event was created:',
            uploadError instanceof Error ? uploadError.message : uploadError,
          );
        }
      }

      const destination = artworkUploadFailed
        ? (`/events/${eventId}?${ARTWORK_UPLOAD_FAILED_PARAM}=1` as Href)
        : (`/events/${eventId}` as Href);

      router.replace(destination);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not create event.';
      setSubmitError(message);
      setIsSubmitting(false);
    }
  }

  return (
    <MobileViewport>
      <View style={styles.screen}>
        <OrganizerAmbientBackground
          eventName={previewTitle}
          imageUrl={backgroundArtworkUri}
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
                  onPress={() => router.replace(DASHBOARD_ROUTE)}
                  style={styles.backHit}>
                  <Text style={styles.backText}>← Dashboard</Text>
                </Pressable>
                <View style={styles.topBarSpacer} />
              </View>

              <View style={styles.commandPanel}>
                <View style={styles.metaBlock}>
                  <Text style={styles.dateLine}>{previewDateLine}</Text>
                  <Text style={styles.eventTitle}>{previewTitle}</Text>
                  <Text style={styles.venueLine}>{previewVenue}</Text>
                  <Text style={styles.statusPill}>DRAFT</Text>
                </View>

                <EventArtworkUploadField
                  disabled={isSubmitting}
                  eventName={previewTitle}
                  existingImageUrl={null}
                  pendingSelection={pendingArtwork}
                  previewMode="background"
                  onSelectionChange={setPendingArtwork}
                />

                <View style={eventFormStyles.formPanel}>
                  <EventFormField
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
                    hint="Whole number, minimum 1"
                    keyboardType="number-pad"
                    label="Max Passes"
                    placeholder="100"
                    value={maxPasses}
                    onChangeText={(text) => setMaxPasses(text.replace(/[^\d]/g, ''))}
                  />
                </View>

                {submitError ? <ThemedText style={styles.errorText}>{submitError}</ThemedText> : null}

                <Pressable
                  disabled={isSubmitting}
                  onPress={handleCreateEvent}
                  style={({ pressed }) => [
                    styles.actionButton,
                    styles.actionPrimary,
                    pressed && styles.pressed,
                    isSubmitting && styles.disabled,
                  ]}>
                  {isSubmitting ? (
                    <ActivityIndicator color={chrome.white} />
                  ) : (
                    <Text style={styles.actionPrimaryText}>Create Event</Text>
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
    alignItems: 'center',
    backgroundColor: palette.pureBlack,
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
    color: fan.badgeText,
    fontSize: 15,
    fontWeight: '700',
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
    color: text.primary,
    fontSize: LAYOUT.title.fontSize,
    fontWeight: '800',
    letterSpacing: LAYOUT.title.letterSpacing,
    lineHeight: LAYOUT.title.lineHeight,
    marginBottom: 6,
    textAlign: 'center',
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
  pressed: {
    opacity: 0.88,
  },
  disabled: {
    opacity: 0.6,
  },
});
