import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MissingProfileScreen } from '@/components/organizer/missing-profile-screen';
import {
  EventArtworkUploadField,
  type PendingArtworkSelection,
} from '@/components/organizer/event-artwork-upload-field';
import { EventFormField, eventFormStyles } from '@/components/organizer/event-form-fields';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, OrganizerAccent, OrganizerAccentTextOn, Radii, Spacing, Surface } from '@/constants/theme';
import { organizer, semantic } from '@/theme';
import { useOrganizerAuthGate } from '@/hooks/use-organizer-auth-gate';
import { useEventDetail } from '@/hooks/use-event-detail';
import { formatTimeForInput } from '@/lib/event-display';
import {
  formatTimeInputForDisplay,
  normalizeTimeInput,
  parseMaxPassesInput,
  validateEditEventForm,
  type EditEventFieldErrors,
} from '@/lib/event-form';
import type { Event } from '@/lib/database.types';
import { uploadEventArtwork } from '@/lib/event-artwork-storage';
import { validateEventArtworkFile } from '@/lib/event-artwork-validation';
import { supabase } from '@/lib/supabase';

export default function EditEventScreen() {
  const router = useRouter();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const authGate = useOrganizerAuthGate();
  const { event, issuedCount, isLoading, error, refetch } = useEventDetail(eventId);

  if (authGate.state === 'loading' || isLoading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" color={OrganizerAccent} />
      </ThemedView>
    );
  }

  if (authGate.state === 'unauthenticated') {
    router.replace('/');
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

  function handleStartTimeBlur() {
    setStartTime((current) => formatTimeInputForDisplay(current));
  }

  async function handleSave() {
    const formattedStartTime = formatTimeInputForDisplay(startTime);

    if (formattedStartTime !== startTime) {
      setStartTime(formattedStartTime);
    }

    const values = {
      eventName,
      venueName,
      eventDate,
      startTime: formattedStartTime,
      maxPasses,
    };
    const errors = validateEditEventForm(values, issuedCount);

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    const capacity = parseMaxPassesInput(maxPasses);

    if (capacity === null) {
      setFieldErrors({ maxPasses: 'Enter a whole number of at least 1.' });
      return;
    }

    const normalizedStart = normalizeTimeInput(formattedStartTime);

    if (!normalizedStart) {
      setFieldErrors({ startTime: 'Use 24-hour format HH:MM (e.g. 21:00).' });
      return;
    }

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
        name: eventName.trim(),
        venue_name: venueName.trim(),
        event_date: eventDate.trim(),
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

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}>
        <SafeAreaView style={styles.safeArea}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <Pressable
              disabled={isSubmitting}
              onPress={goToEventDetail}
              style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
              <ThemedText style={styles.backText}>Cancel</ThemedText>
            </Pressable>

            <ThemedText style={styles.title}>Edit Event</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.subtitle}>
              {issuedCount} pass{issuedCount === 1 ? '' : 'es'} issued · max cannot go below that
            </ThemedText>

            <EventArtworkUploadField
              disabled={isSubmitting}
              eventName={eventName}
              existingImageUrl={event.image_url}
              pendingSelection={pendingArtwork}
              onSelectionChange={setPendingArtwork}
            />

            <ThemedView style={eventFormStyles.form}>
              <EventFormField
                error={fieldErrors.eventName}
                label="Event Name"
                placeholder="Summer Rooftop Session"
                value={eventName}
                onChangeText={setEventName}
              />
              <EventFormField
                error={fieldErrors.venueName}
                label="Venue Name"
                placeholder="The Loft"
                value={venueName}
                onChangeText={setVenueName}
              />
              <EventFormField
                error={fieldErrors.eventDate}
                hint="YYYY-MM-DD"
                label="Event Date"
                placeholder="2026-06-10"
                value={eventDate}
                onChangeText={setEventDate}
              />
              <EventFormField
                error={fieldErrors.startTime}
                hint="24-hour HH:MM (e.g. 21:00 or 1900)"
                label="Start Time"
                placeholder="21:00"
                value={startTime}
                onBlur={handleStartTimeBlur}
                onChangeText={setStartTime}
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
            </ThemedView>

            {submitError ? <ThemedText style={styles.errorText}>{submitError}</ThemedText> : null}

            <Pressable
              disabled={isSubmitting}
              onPress={handleSave}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.pressed,
                isSubmitting && styles.disabled,
              ]}>
              {isSubmitting ? (
                <ActivityIndicator color={organizer.textOn} />
              ) : (
                <ThemedText style={styles.primaryButtonText}>Save Changes</ThemedText>
              )}
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Surface.background,
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    gap: Spacing.three,
    paddingBottom: Spacing.six,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButton: {
    paddingVertical: Spacing.one,
  },
  backText: {
    color: OrganizerAccent,
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    lineHeight: 40,
  },
  subtitle: {
    fontSize: 15,
    marginBottom: Spacing.one,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: OrganizerAccent,
    borderRadius: Radii.button,
    paddingVertical: Spacing.three,
  },
  primaryButtonText: {
    color: OrganizerAccentTextOn,
    fontSize: 16,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.6,
  },
  errorText: {
    color: semantic.errorSoft,
  },
});
