import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EventFormField, eventFormStyles } from '@/components/organizer/event-form-fields';
import { MissingProfileScreen } from '@/components/organizer/missing-profile-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ArtworkEnvironment } from '@/components/ui/artwork-environment';
import { EventArtwork } from '@/components/ui/event-artwork';
import { MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { chrome, fan, organizer, organizerScreen, semantic, shadows, surface } from '@/theme';
import { useEventDetail } from '@/hooks/use-event-detail';
import { useOrganizerAuthGate } from '@/hooks/use-organizer-auth-gate';
import { formatIssuedCapacity } from '@/lib/event-display';
import { resolveOrganizerArtworkUrl } from '@/lib/event-artwork-display';
import type { Pass } from '@/lib/database.types';
import { issuePass } from '@/lib/issue-pass';
import {
  DEFAULT_PASS_TYPE,
  validateIssuePassForm,
  type IssuePassFieldErrors,
} from '@/lib/issue-pass-form';
import { buildPassLinkUrl } from '@/lib/pass-link';
import { sendPassSms } from '@/lib/send-pass-sms';

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
  const [smsMessage, setSmsMessage] = useState<string | null>(null);
  const [smsError, setSmsError] = useState<string | null>(null);
  const [isSendingSms, setIsSendingSms] = useState(false);

  if (authGate.state === 'loading' || isLoading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" color={fan.primary} />
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

  const goToEventDetail = () => {
    router.replace(`/events/${eventId}` as Href);
  };

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
    setSmsMessage(null);
    setSmsError(null);
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
    setSmsMessage(null);
    setSmsError(null);
  }

  async function handleSharePass() {
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

  async function handleSendSms() {
    if (!createdPass || !passUrl || !createdPass.guest_phone) {
      return;
    }

    setSmsMessage(null);
    setSmsError(null);
    setIsSendingSms(true);

    const result = await sendPassSms({
      passId: createdPass.id,
      eventName: activeEvent.name,
      passUrl,
      phone: createdPass.guest_phone,
    });

    setIsSendingSms(false);

    if (!result.ok) {
      setSmsError(result.error);
      return;
    }

    setSmsMessage(result.message);
  }

  const canSendSms = Boolean(createdPass?.guest_phone?.trim());

  if (createdPass && passUrl) {
    return (
      <IssuePassSuccessView
        activeEvent={activeEvent}
        atCapacity={atCapacity}
        canSendSms={canSendSms}
        createdPass={createdPass}
        isSendingSms={isSendingSms}
        onGoToEventDetail={goToEventDetail}
        onIssueAnother={resetForAnother}
        onSendSms={handleSendSms}
        onSharePass={handleSharePass}
        passUrl={passUrl}
        smsError={smsError}
        smsMessage={smsMessage}
      />
    );
  }

  return (
    <IssuePassFormView
      activeEvent={activeEvent}
      atCapacity={atCapacity}
      fieldErrors={fieldErrors}
      guestEmail={guestEmail}
      guestName={guestName}
      guestPhone={guestPhone}
      isSubmitting={isSubmitting}
      issuedCount={issuedCount}
      passType={passType}
      submitError={submitError}
      onGoToEventDetail={goToEventDetail}
      onGuestEmailChange={setGuestEmail}
      onGuestNameChange={setGuestName}
      onGuestPhoneChange={setGuestPhone}
      onPassTypeChange={setPassType}
      onSubmit={handleIssuePass}
    />
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

type IssuePassFormViewProps = {
  activeEvent: { name: string; image_url: string | null; capacity: number };
  atCapacity: boolean;
  issuedCount: number;
  guestName: string;
  passType: string;
  guestEmail: string;
  guestPhone: string;
  fieldErrors: IssuePassFieldErrors;
  submitError: string | null;
  isSubmitting: boolean;
  onGoToEventDetail: () => void;
  onGuestNameChange: (value: string) => void;
  onPassTypeChange: (value: string) => void;
  onGuestEmailChange: (value: string) => void;
  onGuestPhoneChange: (value: string) => void;
  onSubmit: () => void;
};

function IssuePassFormView({
  activeEvent,
  atCapacity,
  issuedCount,
  guestName,
  passType,
  guestEmail,
  guestPhone,
  fieldErrors,
  submitError,
  isSubmitting,
  onGoToEventDetail,
  onGuestNameChange,
  onPassTypeChange,
  onGuestEmailChange,
  onGuestPhoneChange,
  onSubmit,
}: IssuePassFormViewProps) {
  const { height: windowHeight } = useWindowDimensions();
  const artworkUri = resolveOrganizerArtworkUrl(activeEvent.image_url);
  const hasUploadedArtwork = Boolean(artworkUri);
  const cardTopInset = Math.max(56, Math.round(windowHeight * 0.12));

  return (
    <View style={styles.artworkScreen}>
      {hasUploadedArtwork ? (
        <ArtworkEnvironment artworkUri={artworkUri!} isUploaded />
      ) : (
        <View style={[styles.fallbackArtLayer, { height: windowHeight }]}>
          <EventArtwork
            height={windowHeight}
            imageUrl={null}
            name={activeEvent.name}
            rounded={false}
            style={StyleSheet.absoluteFill}
          />
        </View>
      )}

      <SafeAreaView edges={['top', 'bottom']} style={styles.artworkContentLayer}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}>
          <ScrollView
            contentContainerStyle={[styles.artworkScrollContent, { paddingTop: cardTopInset }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <Pressable onPress={onGoToEventDetail} style={styles.artworkBackButton}>
              <ThemedText style={styles.backText}>Cancel</ThemedText>
            </Pressable>

            <ThemedView style={styles.floatingCard}>
              <ThemedText style={styles.cardTitle}>Issue Pass</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.cardSubtitle}>
                {activeEvent.name}
              </ThemedText>

              <View style={styles.capacityBadge}>
                <ThemedText style={styles.capacityBadgeText}>
                  {formatIssuedCapacity(issuedCount, activeEvent.capacity)}
                </ThemedText>
              </View>

              {atCapacity ? (
                <ThemedText style={styles.errorText}>
                  At capacity — raise max passes on the event to issue more.
                </ThemedText>
              ) : null}

              <ThemedView style={eventFormStyles.form}>
                <EventFormField
                  error={fieldErrors.guestName}
                  label="Guest Name"
                  placeholder="Alex Rivera"
                  value={guestName}
                  onChangeText={onGuestNameChange}
                />
                <EventFormField
                  error={fieldErrors.passType}
                  label="Pass Type"
                  placeholder={DEFAULT_PASS_TYPE}
                  value={passType}
                  onChangeText={onPassTypeChange}
                />
                <EventFormField
                  error={fieldErrors.guestEmail}
                  hint="Optional"
                  keyboardType="default"
                  label="Guest Email"
                  placeholder="alex@example.com"
                  value={guestEmail}
                  onChangeText={onGuestEmailChange}
                />
                <EventFormField
                  error={fieldErrors.guestPhone}
                  hint="Optional — enables Send SMS after issue"
                  keyboardType="phone-pad"
                  label="Guest Phone"
                  placeholder="808-555-0100"
                  value={guestPhone}
                  onChangeText={onGuestPhoneChange}
                />
              </ThemedView>

              {submitError ? <ThemedText style={styles.errorText}>{submitError}</ThemedText> : null}

              <Pressable
                disabled={isSubmitting || atCapacity}
                onPress={onSubmit}
                style={({ pressed }) => [
                  styles.primaryButton,
                  styles.cardPrimaryButton,
                  pressed && styles.pressed,
                  (isSubmitting || atCapacity) && styles.disabled,
                ]}>
                {isSubmitting ? (
                  <ActivityIndicator color={chrome.white} />
                ) : (
                  <ThemedText style={styles.primaryButtonText}>Issue Pass</ThemedText>
                )}
              </Pressable>
            </ThemedView>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

type IssuePassSuccessViewProps = {
  activeEvent: { name: string; image_url: string | null };
  createdPass: Pass;
  passUrl: string;
  canSendSms: boolean;
  atCapacity: boolean;
  isSendingSms: boolean;
  smsMessage: string | null;
  smsError: string | null;
  onGoToEventDetail: () => void;
  onSendSms: () => void;
  onSharePass: () => void;
  onIssueAnother: () => void;
};

function IssuePassSuccessView({
  activeEvent,
  createdPass,
  passUrl,
  canSendSms,
  atCapacity,
  isSendingSms,
  smsMessage,
  smsError,
  onGoToEventDetail,
  onSendSms,
  onSharePass,
  onIssueAnother,
}: IssuePassSuccessViewProps) {
  const { height: windowHeight } = useWindowDimensions();
  const artworkUri = resolveOrganizerArtworkUrl(activeEvent.image_url);
  const hasUploadedArtwork = Boolean(artworkUri);
  const cardTopInset = Math.max(56, Math.round(windowHeight * 0.14));

  return (
    <View style={styles.artworkScreen}>
      {hasUploadedArtwork ? (
        <ArtworkEnvironment artworkUri={artworkUri!} isUploaded />
      ) : (
        <View style={[styles.fallbackArtLayer, { height: windowHeight }]}>
          <EventArtwork
            height={windowHeight}
            imageUrl={null}
            name={activeEvent.name}
            rounded={false}
            style={StyleSheet.absoluteFill}
          />
        </View>
      )}

      <SafeAreaView edges={['top', 'bottom']} style={styles.artworkContentLayer}>
        <ScrollView
          contentContainerStyle={[styles.artworkScrollContent, { paddingTop: cardTopInset }]}
          showsVerticalScrollIndicator={false}>
          <Pressable onPress={onGoToEventDetail} style={styles.artworkBackButton}>
            <ThemedText style={styles.backText}>Back to Event</ThemedText>
          </Pressable>

          <ThemedView style={styles.floatingCard}>
            <ThemedText style={styles.cardTitle}>Pass issued</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.cardSubtitle}>
              {canSendSms ? 'Send the pass to your guest by SMS.' : 'Share the pass link with your guest.'}
            </ThemedText>

            <ThemedView style={styles.summaryBlock}>
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

            <ThemedText selectable themeColor="textSecondary" numberOfLines={2} style={styles.passLinkText}>
              {passUrl}
            </ThemedText>

            {smsMessage ? (
              <ThemedText themeColor="textSecondary" style={styles.statusHint}>
                {smsMessage}
              </ThemedText>
            ) : null}
            {smsError ? <ThemedText style={styles.errorText}>{smsError}</ThemedText> : null}

            {canSendSms ? (
              <Pressable
                disabled={isSendingSms}
                onPress={onSendSms}
                style={({ pressed }) => [
                  styles.primaryButton,
                  styles.cardPrimaryButton,
                  pressed && !isSendingSms && styles.pressed,
                  isSendingSms && styles.disabled,
                ]}>
                {isSendingSms ? (
                  <ActivityIndicator color={chrome.white} />
                ) : (
                  <ThemedText style={styles.primaryButtonText}>Send SMS</ThemedText>
                )}
              </Pressable>
            ) : (
              <Pressable
                onPress={onSharePass}
                style={({ pressed }) => [
                  styles.primaryButton,
                  styles.cardPrimaryButton,
                  pressed && styles.pressed,
                ]}>
                <ThemedText style={styles.primaryButtonText}>Share Pass</ThemedText>
              </Pressable>
            )}

            {canSendSms ? (
              <Pressable
                onPress={onSharePass}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  styles.cardSecondaryButton,
                  pressed && styles.pressed,
                ]}>
                <ThemedText style={styles.secondaryButtonText}>Share Pass</ThemedText>
              </Pressable>
            ) : null}

            <Pressable
              disabled={atCapacity}
              onPress={onIssueAnother}
              style={({ pressed }) => [
                styles.secondaryButton,
                styles.cardSecondaryButton,
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
          </ThemedView>
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
  keyboardView: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    color: fan.badgeText,
    fontSize: 16,
    fontWeight: '600',
  },
  summaryRow: {
    gap: Spacing.half,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  passLinkText: {
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 18,
  },
  statusHint: {
    fontSize: 13,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: fan.primary,
    borderRadius: Radii.button,
    paddingVertical: Spacing.three,
  },
  primaryButtonText: {
    color: chrome.white,
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: chrome.glass.border,
    borderRadius: Radii.button,
    borderWidth: 1,
    paddingVertical: Spacing.three,
  },
  secondaryButtonText: {
    color: fan.badgeText,
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
    color: semantic.errorSoft,
    fontSize: 14,
    lineHeight: 20,
  },
  artworkScreen: {
    backgroundColor: surface.background,
    flex: 1,
    position: 'relative',
  },
  fallbackArtLayer: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
  },
  artworkContentLayer: {
    flex: 1,
    zIndex: 1,
  },
  artworkScrollContent: {
    alignSelf: 'center',
    flexGrow: 1,
    maxWidth: MaxContentWidth,
    paddingBottom: Spacing.six,
    paddingHorizontal: Spacing.three,
    width: '100%',
  },
  artworkBackButton: {
    marginBottom: Spacing.two,
    paddingHorizontal: Spacing.one,
    paddingVertical: Spacing.one,
  },
  floatingCard: {
    backgroundColor: chrome.glass.fill,
    borderColor: chrome.glass.border,
    borderRadius: Radii.card,
    borderWidth: 1,
    gap: Spacing.three,
    padding: Spacing.four,
    shadowColor: shadows.walletCard.shadowColor,
    shadowOffset: shadows.walletCard.shadowOffset,
    shadowOpacity: shadows.walletCard.shadowOpacity,
    shadowRadius: shadows.walletCard.shadowRadius,
  },
  cardTitle: {
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
  },
  cardSubtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  capacityBadge: {
    alignSelf: 'flex-start',
    backgroundColor: organizerScreen.liveBadge.backgroundColor,
    borderColor: fan.muted,
    borderRadius: Radii.input,
    borderWidth: 1,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  capacityBadgeText: {
    color: fan.primary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  summaryBlock: {
    gap: Spacing.two,
  },
  cardPrimaryButton: {
    marginHorizontal: 0,
  },
  cardSecondaryButton: {
    marginHorizontal: 0,
  },
});
