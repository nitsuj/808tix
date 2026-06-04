import { useRouter } from 'expo-router';
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

import { EventFormField, eventFormStyles } from '@/components/organizer/event-form-fields';
import { MissingProfileScreen } from '@/components/organizer/missing-profile-screen';
import { ThemedText } from '@/components/themed-text';
import { OrganizerAmbientBackground } from '@/components/ui/organizer-ambient-background';
import { Radii, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useOrganizerAuthGate } from '@/hooks/use-organizer-auth-gate';
import { useOrganizerAuthRedirect } from '@/hooks/use-organizer-auth-redirect';
import {
  organizerProfileFromSources,
  saveOrganizerProfile,
  validateOrganizerProfileForm,
  type OrganizerProfileFieldErrors,
  type OrganizerProfileFormValues,
} from '@/lib/organizer-profile';
import { chrome, fan, organizer, semantic, spacing, surface, text } from '@/theme';

const MOBILE_VIEWPORT_WIDTH = 390;

const webViewportMinHeight =
  Platform.OS === 'web' ? ({ minHeight: '100dvh' } as const) : null;

export default function OrganizerProfileScreen() {
  const router = useRouter();
  const authGate = useOrganizerAuthGate();
  const { profile, session, signOut, reloadProfile, refreshSession } = useAuth();

  const initialValues = useMemo(() => {
    if (!profile) {
      return null;
    }

    return organizerProfileFromSources(
      profile,
      session?.user.email,
      session?.user.user_metadata,
    );
  }, [profile, session?.user.email, session?.user.user_metadata]);

  const formKey = profile
    ? `${profile.id}:${profile.updated_at}:${session?.user.updated_at ?? ''}`
    : 'loading';

  useOrganizerAuthRedirect(authGate.state);

  if (authGate.state === 'unauthenticated') {
    return null;
  }

  if (authGate.state === 'loading' || !initialValues) {
    return (
      <MobileViewport>
        <View style={styles.centered}>
          <ActivityIndicator color={fan.primary} size="large" />
        </View>
      </MobileViewport>
    );
  }

  if (authGate.state === 'profile_missing') {
    return <MissingProfileScreen email={authGate.email} onSignOut={authGate.signOut} />;
  }

  return (
    <ProfileFormBody
      key={formKey}
      initialValues={initialValues}
      organizerId={authGate.organizerId}
      onBack={() => router.back()}
      onSignOut={signOut}
      reloadProfile={reloadProfile}
      refreshSession={refreshSession}
    />
  );
}

type ProfileFormBodyProps = {
  initialValues: OrganizerProfileFormValues;
  organizerId: string;
  onBack: () => void;
  onSignOut: () => Promise<void>;
  reloadProfile: () => Promise<unknown>;
  refreshSession: () => Promise<void>;
};

function ProfileFormBody({
  initialValues,
  organizerId,
  onBack,
  onSignOut,
  reloadProfile,
  refreshSession,
}: ProfileFormBodyProps) {
  const [displayName, setDisplayName] = useState(initialValues.displayName);
  const [businessName, setBusinessName] = useState(initialValues.businessName);
  const [phoneNumber, setPhoneNumber] = useState(initialValues.phoneNumber);
  const email = initialValues.email;
  const [fieldErrors, setFieldErrors] = useState<OrganizerProfileFieldErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSave() {
    const errors = validateOrganizerProfileForm({
      displayName,
      businessName,
      phoneNumber,
      email,
    });

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setSaveSuccess(null);
      return;
    }

    setIsSaving(true);
    setFieldErrors({});
    setSaveError(null);
    setSaveSuccess(null);

    const outcome = await saveOrganizerProfile({
      organizerId,
      displayName,
      businessName,
      phoneNumber,
    });

    if (!outcome.ok) {
      setSaveError(outcome.error);
      setIsSaving(false);
      return;
    }

    await reloadProfile();
    await refreshSession();
    setSaveSuccess('Profile saved.');
    setIsSaving(false);
  }

  async function handleSignOut() {
    setIsSigningOut(true);
    setSaveError(null);

    try {
      await onSignOut();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign out failed.';
      setSaveError(message);
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <MobileViewport>
      <View style={styles.screen}>
        <OrganizerAmbientBackground />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboard}>
          <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              <View style={styles.topBar}>
                <Pressable onPress={onBack} style={styles.backHit}>
                  <Text style={styles.backText}>← Command Center</Text>
                </Pressable>
              </View>

              <ThemedText style={styles.screenTitle}>Organizer Profile</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.screenSubtitle}>
                Your organizer identity for Command Center and door operations.
              </ThemedText>

              <View style={styles.photoPlaceholder}>
                <ThemedText style={styles.photoPlaceholderTitle}>Profile Photo / Logo</ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.photoPlaceholderHint}>
                  Coming Soon
                </ThemedText>
              </View>

              <View style={eventFormStyles.formPanel}>
                <EventFormField
                  autoCapitalize="words"
                  label="Display Name"
                  placeholder="Your name"
                  value={displayName}
                  error={fieldErrors.displayName}
                  onChangeText={setDisplayName}
                />
                <EventFormField
                  autoCapitalize="words"
                  label="Business Name"
                  placeholder="Venue or promoter name"
                  value={businessName}
                  error={fieldErrors.businessName}
                  onChangeText={setBusinessName}
                />
                <EventFormField
                  autoCapitalize="none"
                  keyboardType="phone-pad"
                  label="Phone Number"
                  placeholder="+1 808 555 0100"
                  value={phoneNumber}
                  error={fieldErrors.phoneNumber}
                  onChangeText={setPhoneNumber}
                />
                <View style={eventFormStyles.field}>
                  <ThemedText style={eventFormStyles.label}>Email Address</ThemedText>
                  <ThemedText themeColor="textSecondary" style={eventFormStyles.hint}>
                    Read-only for now — tied to your sign-in account.
                  </ThemedText>
                  <View style={styles.readOnlyField}>
                    <Text style={styles.readOnlyText}>{email || '—'}</Text>
                  </View>
                </View>
              </View>

              {saveError ? <ThemedText style={styles.errorText}>{saveError}</ThemedText> : null}
              {saveSuccess ? <ThemedText style={styles.successText}>{saveSuccess}</ThemedText> : null}

              <Pressable
                disabled={isSaving || isSigningOut}
                onPress={handleSave}
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.pressed,
                  isSaving && styles.buttonDisabled,
                ]}>
                {isSaving ? (
                  <ActivityIndicator color={chrome.white} />
                ) : (
                  <Text style={styles.primaryButtonText}>Save Profile</Text>
                )}
              </Pressable>

              <View style={styles.comingSoonSection}>
                <ThemedText style={styles.comingSoonTitle}>Coming Soon</ThemedText>
                <View style={styles.comingSoonRow}>
                  <ThemedText themeColor="textSecondary">Team Management</ThemedText>
                </View>
                <View style={styles.comingSoonRow}>
                  <ThemedText themeColor="textSecondary">Business Settings</ThemedText>
                </View>
              </View>

              <Pressable
                accessibilityLabel="Sign out"
                accessibilityRole="button"
                disabled={isSaving || isSigningOut}
                onPress={handleSignOut}
                style={({ pressed }) => [
                  styles.signOutButton,
                  pressed && styles.pressed,
                  (isSaving || isSigningOut) && styles.buttonDisabled,
                ]}>
                {isSigningOut ? (
                  <ActivityIndicator color={semantic.errorSoft} />
                ) : (
                  <Text style={styles.signOutButtonText}>Sign Out</Text>
                )}
              </Pressable>
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
    backgroundColor: surface.background,
    flex: 1,
  },
  viewportInner: {
    backgroundColor: surface.background,
    flex: 1,
    maxWidth: MOBILE_VIEWPORT_WIDTH,
    width: '100%',
    ...webViewportMinHeight,
  },
  screen: {
    flex: 1,
    position: 'relative',
  },
  keyboard: {
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
  },
  centered: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  topBar: {
    marginBottom: Spacing.one,
  },
  backHit: {
    paddingVertical: Spacing.one,
  },
  backText: {
    color: fan.badgeText,
    fontSize: 15,
    fontWeight: '700',
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.6,
    lineHeight: 32,
  },
  screenSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: Spacing.one,
  },
  photoPlaceholder: {
    alignItems: 'center',
    backgroundColor: chrome.glass.fill,
    borderColor: chrome.glass.border,
    borderRadius: Radii.card,
    borderWidth: 1,
    gap: Spacing.one,
    paddingVertical: Spacing.five,
  },
  photoPlaceholderTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  photoPlaceholderHint: {
    fontSize: 13,
    fontWeight: '600',
  },
  readOnlyField: {
    backgroundColor: chrome.glass.fill,
    borderColor: chrome.glass.border,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: spacing.three,
    paddingVertical: spacing.three,
  },
  readOnlyText: {
    color: text.secondary,
    fontSize: 16,
    fontWeight: '500',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: fan.primary,
    borderRadius: Radii.button,
    minHeight: 48,
    paddingVertical: Spacing.three,
  },
  primaryButtonText: {
    color: chrome.white,
    fontSize: 16,
    fontWeight: '800',
  },
  signOutButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 96, 96, 0.12)',
    borderColor: 'rgba(255, 96, 96, 0.45)',
    borderRadius: Radii.button,
    borderWidth: 1,
    marginTop: Spacing.four,
    minHeight: 48,
    paddingVertical: Spacing.three,
  },
  signOutButtonText: {
    color: semantic.errorSoft,
    fontSize: 16,
    fontWeight: '800',
  },
  comingSoonSection: {
    backgroundColor: chrome.glass.fill,
    borderColor: chrome.glass.border,
    borderRadius: Radii.card,
    borderWidth: 1,
    gap: Spacing.two,
    marginTop: Spacing.two,
    padding: Spacing.three,
  },
  comingSoonTitle: {
    color: organizer.accent,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  comingSoonRow: {
    paddingVertical: Spacing.half,
  },
  errorText: {
    color: semantic.errorSoft,
    fontSize: 14,
    lineHeight: 20,
  },
  successText: {
    color: organizer.accent,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  pressed: {
    opacity: 0.88,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
