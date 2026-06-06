import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EventFormField, eventFormStyles } from '@/components/organizer/event-form-fields';
import { MissingProfileScreen } from '@/components/organizer/missing-profile-screen';
import { ThemedText } from '@/components/themed-text';
import { EventScreenBackground } from '@/components/ui/event-screen-background';
import {
  ORGANIZER_MOBILE_VIEWPORT_WIDTH,
  OrganizerMobileViewport,
} from '@/components/ui/organizer-mobile-viewport';
import { Radii, Spacing } from '@/constants/theme';
import {
  chrome,
  fan,
  organizerScreen,
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
import { formatIssuedCapacity, formatVenueLine, shouldShowVenueLine } from '@/lib/event-display';
import type { Event, Pass } from '@/lib/database.types';
import { issuePass } from '@/lib/issue-pass';
import {
  combineGuestName,
  DEFAULT_PASS_TYPE,
  validateIssuePassForm,
  type IssuePassFieldErrors,
} from '@/lib/issue-pass-form';
import { canIssuePassesForEvent, PUBLISH_BEFORE_ISSUE_MESSAGE } from '@/lib/event-status';
import { ORGANIZER_DASHBOARD_ROUTE, safeRouterBack } from '@/lib/safe-router-back';
import { buildPassLinkUrl } from '@/lib/pass-link';
import {
  formatPhoneNumberForDisplay,
  formatPhoneNumberInput,
  normalizePhoneNumber,
} from '@/lib/phone-validation';
import { sendPassSms } from '@/lib/send-pass-sms';

const MOBILE_VIEWPORT_WIDTH = ORGANIZER_MOBILE_VIEWPORT_WIDTH;

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

type IssuePassEventContext = Pick<
  Event,
  'name' | 'image_url' | 'capacity' | 'event_date' | 'start_time' | 'venue_name'
>;

export default function IssuePassScreen() {
  const router = useRouter();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const authGate = useOrganizerAuthGate();
  const { event, issuedCount, isLoading, error, refetch } = useEventDetail(eventId);

  const [guestFirstName, setGuestFirstName] = useState('');
  const [guestLastName, setGuestLastName] = useState('');
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

  useOrganizerAuthRedirect(authGate.state);

  if (authGate.state === 'loading' || isLoading) {
    return (
      <OrganizerMobileViewport>
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

  if (error || !event || !eventId) {
    return (
      <OrganizerMobileViewport>
        <View style={styles.screen}>
          <SafeAreaView style={styles.errorSafeArea}>
            <ThemedText style={styles.errorText}>{error ?? 'Event not found.'}</ThemedText>
          </SafeAreaView>
        </View>
      </OrganizerMobileViewport>
    );
  }

  const activeEvent = event;

  if (!canIssuePassesForEvent(activeEvent.status)) {
    return (
      <OrganizerMobileViewport>
        <View style={styles.screen}>
          <SafeAreaView style={styles.errorSafeArea}>
            <Pressable onPress={() => router.replace(`/events/${eventId}` as Href)} style={styles.backHit}>
              <Text style={styles.backText}>← Event</Text>
            </Pressable>
            <View style={styles.blockedState}>
              <Text style={styles.blockedTitle}>Event is still a draft</Text>
              <Text style={styles.blockedBody}>{PUBLISH_BEFORE_ISSUE_MESSAGE}</Text>
              <Pressable
                onPress={() => router.replace(`/events/${eventId}` as Href)}
                style={({ pressed }) => [styles.actionButton, styles.actionPrimary, pressed && styles.pressed]}>
                <Text style={styles.actionPrimaryText}>Back to Event</Text>
              </Pressable>
            </View>
          </SafeAreaView>
        </View>
      </OrganizerMobileViewport>
    );
  }

  const handleIssueBack = () => {
    safeRouterBack(router, ORGANIZER_DASHBOARD_ROUTE);
  };

  const goToEventDetail = () => {
    router.replace(`/events/${eventId}?refreshStats=1` as Href);
  };

  const passUrl = createdPass ? buildPassLinkUrl(createdPass.secure_token) : null;
  const atCapacity = issuedCount >= activeEvent.capacity;

  async function handleIssuePass() {
    const values = { guestFirstName, guestLastName, passType, guestEmail, guestPhone };
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
      guestName: combineGuestName(guestFirstName, guestLastName),
      passType,
      guestEmail: guestEmail || undefined,
      guestPhone: guestPhone ? normalizePhoneNumber(guestPhone) : undefined,
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
    setGuestFirstName('');
    setGuestLastName('');
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
      guestFirstName={guestFirstName}
      guestLastName={guestLastName}
      guestPhone={guestPhone}
      isSubmitting={isSubmitting}
      issuedCount={issuedCount}
      passType={passType}
      submitError={submitError}
      onIssueBack={handleIssueBack}
      onGuestEmailChange={setGuestEmail}
      onGuestFirstNameChange={setGuestFirstName}
      onGuestLastNameChange={setGuestLastName}
      onGuestPhoneChange={(value) => setGuestPhone(formatPhoneNumberInput(value))}
      onPassTypeChange={setPassType}
      onSubmit={handleIssuePass}
    />
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <ThemedText themeColor="textSecondary" type="small">
        {label}
      </ThemedText>
      <ThemedText style={styles.summaryValue}>{value}</ThemedText>
    </View>
  );
}

function EventContextMeta({ event }: { event: IssuePassEventContext }) {
  const dateLine = useMemo(() => {
    const formatted = formatEventDateTimeLong(event.event_date, event.start_time);
    return formatted ? formatted.toUpperCase() : null;
  }, [event.event_date, event.start_time]);

  const venueLine = formatVenueLine(event.venue_name);
  const showVenue = shouldShowVenueLine(event.venue_name, event.name);

  return (
    <View style={styles.metaBlock}>
      {dateLine ? <Text style={styles.dateLine}>{dateLine}</Text> : null}
      <Text style={styles.eventTitle}>{event.name}</Text>
      {showVenue ? <Text style={styles.venueLine}>{venueLine}</Text> : null}
    </View>
  );
}

type IssuePassFormViewProps = {
  activeEvent: IssuePassEventContext;
  atCapacity: boolean;
  issuedCount: number;
  guestFirstName: string;
  guestLastName: string;
  passType: string;
  guestEmail: string;
  guestPhone: string;
  fieldErrors: IssuePassFieldErrors;
  submitError: string | null;
  isSubmitting: boolean;
  onIssueBack: () => void;
  onGuestFirstNameChange: (value: string) => void;
  onGuestLastNameChange: (value: string) => void;
  onPassTypeChange: (value: string) => void;
  onGuestEmailChange: (value: string) => void;
  onGuestPhoneChange: (value: string) => void;
  onSubmit: () => void;
};

function IssuePassFormView({
  activeEvent,
  atCapacity,
  issuedCount,
  guestFirstName,
  guestLastName,
  passType,
  guestEmail,
  guestPhone,
  fieldErrors,
  submitError,
  isSubmitting,
  onIssueBack,
  onGuestFirstNameChange,
  onGuestLastNameChange,
  onPassTypeChange,
  onGuestEmailChange,
  onGuestPhoneChange,
  onSubmit,
}: IssuePassFormViewProps) {
  return (
    <OrganizerMobileViewport
      background={
        <EventScreenBackground eventName={activeEvent.name} imageUrl={activeEvent.image_url} />
      }>
      <View style={styles.screen}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}>
          <SafeAreaView edges={['top', 'bottom']} style={styles.foreground}>
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              <View style={styles.topBar}>
                <Pressable onPress={onIssueBack} style={styles.backHit}>
                  <Text style={styles.backText}>← Event</Text>
                </Pressable>
                <View style={styles.topBarSpacer} />
              </View>

              <View style={styles.commandPanel}>
                <EventContextMeta event={activeEvent} />
                <Text style={styles.screenEyebrow}>ISSUE PASS</Text>

                <View style={styles.capacityBadge}>
                  <Text style={styles.capacityBadgeText}>
                    {formatIssuedCapacity(issuedCount, activeEvent.capacity)}
                  </Text>
                </View>

                {atCapacity ? (
                  <ThemedText style={styles.errorText}>
                    At capacity — raise max passes on the event to issue more.
                  </ThemedText>
                ) : null}

                <View style={eventFormStyles.formPanel}>
                  <EventFormField
                    autoCapitalize="words"
                    error={fieldErrors.guestFirstName}
                    label="First Name"
                    placeholder="Alex"
                    value={guestFirstName}
                    onChangeText={onGuestFirstNameChange}
                  />
                  <EventFormField
                    autoCapitalize="words"
                    error={fieldErrors.guestLastName}
                    label="Last Name"
                    placeholder="Rivera"
                    value={guestLastName}
                    onChangeText={onGuestLastNameChange}
                  />
                  <EventFormField
                    error={fieldErrors.passType}
                    label="Pass Type"
                    placeholder={DEFAULT_PASS_TYPE}
                    value={passType}
                    onChangeText={onPassTypeChange}
                  />
                  <ThemedText themeColor="textSecondary" style={styles.contactSectionHint}>
                    Delivery contact — phone or email required.
                  </ThemedText>
                  <EventFormField
                    error={fieldErrors.guestPhone}
                    hint="Preferred for Send SMS after issue"
                    keyboardType="phone-pad"
                    label="Guest Phone"
                    placeholder="808-555-0100"
                    value={guestPhone}
                    onChangeText={onGuestPhoneChange}
                  />
                  <EventFormField
                    error={fieldErrors.guestEmail}
                    hint="Share pass link by email if no phone"
                    keyboardType="default"
                    label="Guest Email"
                    placeholder="alex@example.com"
                    value={guestEmail}
                    onChangeText={onGuestEmailChange}
                  />
                </View>

                {submitError ? <ThemedText style={styles.errorText}>{submitError}</ThemedText> : null}

                <Pressable
                  disabled={isSubmitting || atCapacity}
                  onPress={onSubmit}
                  style={({ pressed }) => [
                    styles.actionButton,
                    styles.actionPrimary,
                    pressed && styles.pressed,
                    (isSubmitting || atCapacity) && styles.disabled,
                  ]}>
                  {isSubmitting ? (
                    <ActivityIndicator color={chrome.white} />
                  ) : (
                    <Text style={styles.actionPrimaryText}>Issue Pass</Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </View>
    </OrganizerMobileViewport>
  );
}

type IssuePassSuccessViewProps = {
  activeEvent: IssuePassEventContext;
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
  return (
    <OrganizerMobileViewport
      background={
        <EventScreenBackground eventName={activeEvent.name} imageUrl={activeEvent.image_url} />
      }>
      <View style={styles.screen}>
        <SafeAreaView edges={['top', 'bottom']} style={styles.foreground}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}>
            <View style={styles.topBar}>
              <Pressable onPress={onGoToEventDetail} style={styles.backHit}>
                <Text style={styles.backText}>← Event</Text>
              </Pressable>
              <View style={styles.topBarSpacer} />
            </View>

            <View style={styles.commandPanel}>
              <EventContextMeta event={activeEvent} />
              <Text style={styles.screenEyebrow}>PASS ISSUED</Text>
              <ThemedText themeColor="textSecondary" style={styles.successHint}>
                {canSendSms ? 'Send the pass to your guest by SMS.' : 'Share the pass link with your guest.'}
              </ThemedText>

              <View style={styles.summaryBlock}>
                <SummaryRow label="Guest" value={createdPass.guest_name} />
                <SummaryRow label="Pass type" value={createdPass.pass_type} />
                {createdPass.guest_email ? (
                  <SummaryRow label="Email" value={createdPass.guest_email} />
                ) : null}
                {createdPass.guest_phone ? (
                  <SummaryRow
                    label="Phone"
                    value={formatPhoneNumberForDisplay(createdPass.guest_phone)}
                  />
                ) : null}
                <SummaryRow label="Status" value={createdPass.status} />
              </View>

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
                    styles.actionButton,
                    styles.actionPrimary,
                    pressed && !isSendingSms && styles.pressed,
                    isSendingSms && styles.disabled,
                  ]}>
                  {isSendingSms ? (
                    <ActivityIndicator color={chrome.white} />
                  ) : (
                    <Text style={styles.actionPrimaryText}>Send SMS</Text>
                  )}
                </Pressable>
              ) : (
                <Pressable
                  onPress={onSharePass}
                  style={({ pressed }) => [
                    styles.actionButton,
                    styles.actionPrimary,
                    pressed && styles.pressed,
                  ]}>
                  <Text style={styles.actionPrimaryText}>Share Pass</Text>
                </Pressable>
              )}

              {canSendSms ? (
                <Pressable
                  onPress={onSharePass}
                  style={({ pressed }) => [
                    styles.actionButton,
                    styles.actionSecondary,
                    pressed && styles.pressed,
                  ]}>
                  <Text style={styles.actionSecondaryText}>Share Pass</Text>
                </Pressable>
              ) : null}

              <Pressable
                disabled={atCapacity}
                onPress={onIssueAnother}
                style={({ pressed }) => [
                  styles.actionButton,
                  styles.actionSecondary,
                  pressed && styles.pressed,
                  atCapacity && styles.disabled,
                ]}>
                <Text style={styles.actionSecondaryText}>Issue Another Pass</Text>
              </Pressable>

              {atCapacity ? (
                <ThemedText themeColor="textSecondary" type="small">
                  Event is now at capacity.
                </ThemedText>
              ) : null}
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    </OrganizerMobileViewport>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: 'transparent',
    flex: 1,
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
  errorSafeArea: {
    flex: 1,
    paddingHorizontal: LAYOUT.horizontalPadding,
    paddingTop: LAYOUT.contentTopInset,
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
  fallbackArtLayer: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
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
    ...shadows.walletCardStyle,
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
  screenEyebrow: {
    alignSelf: 'center',
    borderColor: fan.muted,
    borderRadius: 999,
    borderWidth: 1,
    color: fan.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    overflow: 'hidden',
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    textAlign: 'center',
  },
  capacityBadge: {
    alignSelf: 'center',
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
  blockedState: {
    flex: 1,
    gap: Spacing.three,
    justifyContent: 'center',
    paddingBottom: Spacing.six,
  },
  blockedTitle: {
    color: text.primary,
    fontSize: 22,
    fontWeight: '800',
  },
  blockedBody: {
    color: text.secondary,
    fontSize: 15,
    lineHeight: 22,
  },
  summaryRow: {
    gap: Spacing.half,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  summaryBlock: {
    gap: Spacing.two,
  },
  successHint: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  passLinkText: {
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  statusHint: {
    fontSize: 13,
    textAlign: 'center',
  },
  contactSectionHint: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: Spacing.half,
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
    minHeight: 48,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  actionPrimary: {
    backgroundColor: fan.primary,
    marginTop: LAYOUT.formToActions,
  },
  actionSecondary: {
    borderColor: chrome.glass.border,
    borderWidth: 1,
  },
  actionPrimaryText: {
    color: chrome.white,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  actionSecondaryText: {
    color: fan.badgeText,
    fontSize: 16,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.88,
  },
  disabled: {
    opacity: 0.6,
  },
});
