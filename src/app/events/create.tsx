import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EventFormField, eventFormStyles } from '@/components/organizer/event-form-fields';
import { MissingProfileScreen } from '@/components/organizer/missing-profile-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useOrganizerAuthGate } from '@/hooks/use-organizer-auth-gate';
import { MaxContentWidth, OrganizerAccent, OrganizerAccentTextOn, Radii, Spacing, Surface } from '@/constants/theme';
import { organizer, semantic } from '@/theme';
import {
  normalizeTimeInput,
  parseMaxPassesInput,
  validateCreateEventForm,
  type CreateEventFieldErrors,
} from '@/lib/event-form';
import { generateUniqueEventSlug } from '@/lib/event-slug';
import { supabase } from '@/lib/supabase';

export default function CreateEventScreen() {
  const router = useRouter();
  const authGate = useOrganizerAuthGate();

  const [eventName, setEventName] = useState('');
  const [venueName, setVenueName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [maxPasses, setMaxPasses] = useState('');
  const [fieldErrors, setFieldErrors] = useState<CreateEventFieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (authGate.state === 'loading') {
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

  const organizerId = authGate.organizerId;

  async function handleCreateEvent() {
    const values = { eventName, venueName, eventDate, startTime, maxPasses };
    const errors = validateCreateEventForm(values);

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    const capacity = parseMaxPassesInput(maxPasses);

    if (capacity === null) {
      setFieldErrors({ maxPasses: 'Enter a whole number of at least 1.' });
      return;
    }

    setFieldErrors({});
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const slug = await generateUniqueEventSlug(eventName);
      const normalizedStart = normalizeTimeInput(startTime);

      if (!normalizedStart) {
        setFieldErrors({ startTime: 'Use 24-hour format HH:MM (e.g. 21:00).' });
        setIsSubmitting(false);
        return;
      }

      const { error } = await supabase.from('events').insert({
        organizer_id: organizerId,
        slug,
        name: eventName.trim(),
        venue_name: venueName.trim(),
        event_date: eventDate.trim(),
        start_time: normalizedStart,
        capacity,
        status: 'draft',
      });

      if (error) {
        setSubmitError(error.message);
        setIsSubmitting(false);
        return;
      }

      router.back();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not create event.';
      setSubmitError(message);
      setIsSubmitting(false);
    }
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
            <View style={styles.topBar}>
              <Pressable
                disabled={isSubmitting}
                onPress={() => router.back()}
                style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
                <ThemedText style={styles.backText}>Cancel</ThemedText>
              </Pressable>
            </View>

            <ThemedText style={styles.title}>Create Event</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.subtitle}>
              Saved as draft until you publish.
            </ThemedText>

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
                hint="24-hour HH:MM"
                label="Start Time"
                placeholder="21:00"
                value={startTime}
                onChangeText={setStartTime}
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
            </ThemedView>

            {submitError ? <ThemedText style={styles.errorText}>{submitError}</ThemedText> : null}

            <Pressable
              disabled={isSubmitting}
              onPress={handleCreateEvent}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.pressed,
                isSubmitting && styles.disabled,
              ]}>
              {isSubmitting ? (
                <ActivityIndicator color={organizer.textOn} />
              ) : (
                <ThemedText style={styles.primaryButtonText}>Create Event</ThemedText>
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
  topBar: {
    flexDirection: 'row',
  },
  backButton: {
    paddingVertical: Spacing.one,
  },
  backText: {
    color: OrganizerAccent,
    fontSize: 16,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.6,
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
  errorText: {
    color: semantic.error,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: OrganizerAccent,
    borderRadius: Radii.button,
    marginTop: Spacing.two,
    paddingVertical: Spacing.three,
  },
  primaryButtonText: {
    color: OrganizerAccentTextOn,
    fontSize: 16,
    fontWeight: '800',
  },
});
