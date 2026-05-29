import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EventFormField, eventFormStyles } from '@/components/organizer/event-form-fields';
import { MissingProfileScreen } from '@/components/organizer/missing-profile-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, OrganizerAccent, Spacing } from '@/constants/theme';
import { useEventDetail } from '@/hooks/use-event-detail';
import { useOrganizerAuthGate } from '@/hooks/use-organizer-auth-gate';
import { copyToClipboard } from '@/lib/copy-to-clipboard';
import { formatIssuedCapacity } from '@/lib/event-display';
import type { Pass } from '@/lib/database.types';
import { issuePass } from '@/lib/issue-pass';
import {
  DEFAULT_PASS_TYPE,
  validateIssuePassForm,
  type IssuePassFieldErrors,
} from '@/lib/issue-pass-form';
import { buildPassLinkUrl } from '@/lib/pass-link';

export default function IssuePassScreen() {
  const router = useRouter();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const authGate = useOrganizerAuthGate();
  const { event, issuedCount, isLoading, error, refetch } = useEventDetail(eventId);

  const [guestName, setGuestName] = useState('');
  const [passType, setPassType] = useState(DEFAULT_PASS_TYPE);
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [fieldErrors, setFieldErrors] = useState<IssuePassFieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdPass, setCreatedPass] = useState<Pass | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

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

  const activeEvent = event;

  const passUrl = createdPass ? buildPassLinkUrl(createdPass.secure_token) : null;
  const atCapacity = issuedCount >= activeEvent.capacity;

  async function handleIssuePass() {
    const values = { guestName, passType, guestEmail, guestPhone };
    const errors = validateIssuePassForm(values);

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setSubmitError(null);
    setCopyMessage(null);
    setIsSubmitting(true);

    const result = await issuePass({
      eventId,
      guestName,
      passType,
      guestEmail: guestEmail || undefined,
      guestPhone: guestPhone || undefined,
      issuedCount,
      capacity: activeEvent.capacity,
    });

    setIsSubmitting(false);

    if (!result.ok) {
      setSubmitError(result.error);
      return;
    }

    await refetch();
    setCreatedPass(result.pass);
  }

  function resetForAnother() {
    setCreatedPass(null);
    setGuestName('');
    setPassType(DEFAULT_PASS_TYPE);
    setGuestEmail('');
    setGuestPhone('');
    setFieldErrors({});
    setSubmitError(null);
    setCopyMessage(null);
  }

  async function handleCopyLink() {
    if (!passUrl) {
      return;
    }

    try {
      await copyToClipboard(passUrl);
      setCopyMessage('Link copied to clipboard.');
    } catch {
      setCopyMessage('Could not copy link.');
    }
  }

  async function handleShareLink() {
    if (!passUrl || !createdPass) {
      return;
    }

    try {
      await Share.share({
        message: `Your pass for ${activeEvent.name}: ${passUrl}`,
        url: passUrl,
        title: `${createdPass.guest_name} — ${activeEvent.name}`,
      });
    } catch {
      // User dismissed share sheet — no action needed.
    }
  }

  if (createdPass && passUrl) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <Pressable onPress={() => router.back()} style={styles.backButton}>
              <ThemedText style={styles.backText}>Back to Event</ThemedText>
            </Pressable>

            <ThemedText type="subtitle" style={styles.title}>
              Pass issued
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.subtitle}>
              Share this link with your guest.
            </ThemedText>

            <ThemedView type="backgroundElement" style={styles.summaryCard}>
              <SummaryRow label="Guest" value={createdPass.guest_name} />
              <SummaryRow label="Pass type" value={createdPass.pass_type} />
              {createdPass.guest_email ? (
                <SummaryRow label="Email" value={createdPass.guest_email} />
              ) : null}
              {createdPass.guest_phone ? (
                <SummaryRow label="Phone" value={createdPass.guest_phone} />
              ) : null}
              <SummaryRow label="Status" value={createdPass.status} />
            </ThemedView>

            <ThemedText type="smallBold" style={styles.linkLabel}>
              Pass link
            </ThemedText>
            <ThemedView type="backgroundElement" style={styles.linkBox}>
              <ThemedText selectable style={styles.linkText}>
                {passUrl}
              </ThemedText>
            </ThemedView>

            {copyMessage ? <ThemedText style={styles.copyMessage}>{copyMessage}</ThemedText> : null}

            <Pressable
              onPress={handleCopyLink}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
              <ThemedText style={styles.primaryButtonText}>Copy Link</ThemedText>
            </Pressable>

            <Pressable
              onPress={handleShareLink}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
              <ThemedText style={styles.secondaryButtonText}>Share Link</ThemedText>
            </Pressable>

            <Pressable
              disabled={atCapacity}
              onPress={resetForAnother}
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.pressed,
                atCapacity && styles.disabled,
              ]}>
              <ThemedText style={styles.secondaryButtonText}>Issue Another Pass</ThemedText>
            </Pressable>

            {atCapacity ? (
              <ThemedText themeColor="textSecondary" type="small">
                Event is now at capacity.
              </ThemedText>
            ) : null}
          </ScrollView>
        </SafeAreaView>
      </ThemedView>
    );
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
            <Pressable onPress={() => router.back()} style={styles.backButton}>
              <ThemedText style={styles.backText}>Cancel</ThemedText>
            </Pressable>

            <ThemedText type="subtitle" style={styles.title}>
              Issue Pass
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.subtitle}>
              {activeEvent.name}
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.capacityLine}>
              {formatIssuedCapacity(issuedCount, activeEvent.capacity)} issued
            </ThemedText>

            {atCapacity ? (
              <ThemedText style={styles.errorText}>
                This event is at capacity. Edit the event to raise max passes before issuing more.
              </ThemedText>
            ) : null}

            <ThemedView type="backgroundElement" style={eventFormStyles.form}>
              <EventFormField
                error={fieldErrors.guestName}
                label="Guest Name"
                placeholder="Alex Rivera"
                value={guestName}
                onChangeText={setGuestName}
              />
              <EventFormField
                error={fieldErrors.passType}
                label="Pass Type"
                placeholder={DEFAULT_PASS_TYPE}
                value={passType}
                onChangeText={setPassType}
              />
              <EventFormField
                error={fieldErrors.guestEmail}
                hint="Optional"
                keyboardType="default"
                label="Guest Email"
                placeholder="alex@example.com"
                value={guestEmail}
                onChangeText={setGuestEmail}
              />
              <EventFormField
                hint="Optional"
                label="Guest Phone"
                placeholder="808-555-0100"
                value={guestPhone}
                onChangeText={setGuestPhone}
              />
            </ThemedView>

            {submitError ? <ThemedText style={styles.errorText}>{submitError}</ThemedText> : null}

            <Pressable
              disabled={isSubmitting || atCapacity}
              onPress={handleIssuePass}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.pressed,
                (isSubmitting || atCapacity) && styles.disabled,
              ]}>
              {isSubmitting ? (
                <ActivityIndicator color="#000" />
              ) : (
                <ThemedText style={styles.primaryButtonText}>Issue Pass</ThemedText>
              )}
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <ThemedView style={styles.summaryRow}>
      <ThemedText themeColor="textSecondary" type="small">
        {label}
      </ThemedText>
      <ThemedText style={styles.summaryValue}>{value}</ThemedText>
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
    marginBottom: Spacing.half,
  },
  capacityLine: {
    marginBottom: Spacing.one,
  },
  summaryCard: {
    borderRadius: Spacing.three,
    gap: Spacing.three,
    padding: Spacing.four,
  },
  summaryRow: {
    gap: Spacing.half,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  linkLabel: {
    marginTop: Spacing.one,
  },
  linkBox: {
    borderRadius: Spacing.two,
    padding: Spacing.three,
  },
  linkText: {
    fontFamily: 'monospace',
    fontSize: 13,
    lineHeight: 20,
  },
  copyMessage: {
    color: OrganizerAccent,
    fontSize: 14,
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
  secondaryButton: {
    alignItems: 'center',
    borderColor: OrganizerAccent,
    borderRadius: Spacing.two,
    borderWidth: 1,
    paddingVertical: Spacing.three,
  },
  secondaryButtonText: {
    color: OrganizerAccent,
    fontSize: 16,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.5,
  },
  errorText: {
    color: '#ff6b6b',
  },
});
