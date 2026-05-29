import { useLocalSearchParams, useRouter } from 'expo-router';
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
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, OrganizerAccent, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useEventDetail } from '@/hooks/use-event-detail';
import { formatTimeForInput } from '@/lib/event-display';
import {
  EVENT_STATUS_OPTIONS,
  normalizeTimeInput,
  parseMaxPassesInput,
  validateEditEventForm,
  type EventFormFieldErrors,
  type EventStatus,
} from '@/lib/event-form';
import type { Event } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

export default function EditEventScreen() {
  const router = useRouter();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const { event, issuedCount, isLoading, error, refetch } = useEventDetail(eventId);

  if (authLoading || isLoading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" color={OrganizerAccent} />
      </ThemedView>
    );
  }

  if (!isAuthenticated) {
    router.replace('/');
    return null;
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
  const [eventName, setEventName] = useState(event.name);
  const [venueName, setVenueName] = useState(event.venue_name ?? '');
  const [eventDate, setEventDate] = useState(event.event_date ?? '');
  const [startTime, setStartTime] = useState(() => formatTimeForInput(event.start_time));
  const [maxPasses, setMaxPasses] = useState(String(event.capacity));
  const [status, setStatus] = useState<EventStatus>(event.status);
  const [fieldErrors, setFieldErrors] = useState<EventFormFieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSave() {
    const values = { eventName, venueName, eventDate, startTime, maxPasses, status };
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

    const normalizedStart = normalizeTimeInput(startTime);

    if (!normalizedStart) {
      setFieldErrors({ startTime: 'Use 24-hour format HH:MM (e.g. 21:00).' });
      return;
    }

    setFieldErrors({});
    setSubmitError(null);
    setIsSubmitting(true);

    const { error: updateError } = await supabase
      .from('events')
      .update({
        name: eventName.trim(),
        venue_name: venueName.trim(),
        event_date: eventDate.trim(),
        start_time: normalizedStart,
        capacity,
        status,
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
    router.back();
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
              onPress={() => router.back()}
              style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
              <ThemedText style={styles.backText}>Cancel</ThemedText>
            </Pressable>

            <ThemedText type="subtitle" style={styles.title}>
              Edit Event
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.subtitle}>
              {issuedCount} pass{issuedCount === 1 ? '' : 'es'} issued · max cannot go below that
            </ThemedText>

            <ThemedView type="backgroundElement" style={eventFormStyles.form}>
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
                hint={`Minimum ${issuedCount} (issued)`}
                keyboardType="number-pad"
                label="Max Passes"
                placeholder="100"
                value={maxPasses}
                onChangeText={(text) => setMaxPasses(text.replace(/[^\d]/g, ''))}
              />

              <View style={styles.field}>
                <ThemedText type="smallBold" style={eventFormStyles.label}>
                  Status
                </ThemedText>
                <View style={styles.statusRow}>
                  {EVENT_STATUS_OPTIONS.map((option) => {
                    const selected = status === option;

                    return (
                      <Pressable
                        key={option}
                        onPress={() => setStatus(option)}
                        style={({ pressed }) => [
                          styles.statusChip,
                          selected && styles.statusChipSelected,
                          pressed && styles.pressed,
                        ]}>
                        <ThemedText
                          style={[styles.statusChipText, selected && styles.statusChipTextSelected]}>
                          {option}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
                {fieldErrors.status ? (
                  <ThemedText style={eventFormStyles.errorText}>{fieldErrors.status}</ThemedText>
                ) : null}
              </View>
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
                <ActivityIndicator color="#000" />
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
    color: OrganizerAccent,
    fontSize: 28,
    lineHeight: 34,
  },
  subtitle: {
    marginBottom: Spacing.one,
  },
  field: {
    gap: Spacing.one,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  statusChip: {
    borderColor: '#333',
    borderRadius: Spacing.two,
    borderWidth: 1,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  statusChipSelected: {
    backgroundColor: OrganizerAccent,
    borderColor: OrganizerAccent,
  },
  statusChipText: {
    color: OrganizerAccent,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  statusChipTextSelected: {
    color: '#000',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: OrganizerAccent,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
  },
  primaryButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.6,
  },
  errorText: {
    color: '#ff6b6b',
  },
});
