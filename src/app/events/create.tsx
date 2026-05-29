import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/auth-context';
import { MaxContentWidth, OrganizerAccent, Spacing } from '@/constants/theme';
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
  const { isLoading, isAuthenticated, session } = useAuth();

  const [eventName, setEventName] = useState('');
  const [venueName, setVenueName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [maxPasses, setMaxPasses] = useState('');
  const [fieldErrors, setFieldErrors] = useState<CreateEventFieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isLoading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" color={OrganizerAccent} />
      </ThemedView>
    );
  }

  if (!isAuthenticated || !session?.user.id) {
    router.replace('/');
    return null;
  }

  const organizerId = session.user.id;

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

            <ThemedText type="subtitle" style={styles.title}>
              Create Event
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.subtitle}>
              Saved as draft until you publish.
            </ThemedText>

            <ThemedView type="backgroundElement" style={styles.form}>
              <FormField
                error={fieldErrors.eventName}
                label="Event Name"
                placeholder="Summer Rooftop Session"
                value={eventName}
                onChangeText={setEventName}
              />
              <FormField
                error={fieldErrors.venueName}
                label="Venue Name"
                placeholder="The Loft"
                value={venueName}
                onChangeText={setVenueName}
              />
              <FormField
                error={fieldErrors.eventDate}
                hint="YYYY-MM-DD"
                label="Event Date"
                placeholder="2026-06-10"
                value={eventDate}
                onChangeText={setEventDate}
              />
              <FormField
                error={fieldErrors.startTime}
                hint="24-hour HH:MM"
                label="Start Time"
                placeholder="21:00"
                value={startTime}
                onChangeText={setStartTime}
              />
              <FormField
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
                <ActivityIndicator color="#000" />
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

type FormFieldProps = {
  label: string;
  value: string;
  placeholder: string;
  hint?: string;
  error?: string;
  keyboardType?: 'default' | 'number-pad';
  onChangeText: (value: string) => void;
};

function FormField({
  label,
  value,
  placeholder,
  hint,
  error,
  keyboardType = 'default',
  onChangeText,
}: FormFieldProps) {
  return (
    <View style={styles.field}>
      <ThemedText type="smallBold" style={styles.label}>
        {label}
      </ThemedText>
      {hint ? (
        <ThemedText themeColor="textSecondary" type="small">
          {hint}
        </ThemedText>
      ) : null}
      <TextInput
        editable
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor="#666"
        style={[styles.input, error ? styles.inputError : null]}
        value={value}
        onChangeText={onChangeText}
      />
      {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}
    </View>
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
    color: OrganizerAccent,
    fontSize: 28,
    lineHeight: 34,
  },
  subtitle: {
    marginBottom: Spacing.one,
  },
  form: {
    gap: Spacing.three,
    padding: Spacing.four,
    borderRadius: Spacing.three,
  },
  field: {
    gap: Spacing.one,
  },
  label: {
    marginTop: Spacing.half,
  },
  input: {
    backgroundColor: '#111',
    borderColor: '#333',
    borderRadius: Spacing.two,
    borderWidth: 1,
    color: '#fff',
    fontSize: 16,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  inputError: {
    borderColor: '#ff6b6b',
  },
  errorText: {
    color: '#ff6b6b',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: OrganizerAccent,
    borderRadius: Spacing.two,
    marginTop: Spacing.two,
    paddingVertical: Spacing.three,
  },
  primaryButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
});
