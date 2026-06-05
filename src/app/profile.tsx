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

import { EventFormField } from '@/components/organizer/event-form-fields';
import { MissingProfileScreen } from '@/components/organizer/missing-profile-screen';
import { ThemedText } from '@/components/themed-text';
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
import { organizer, palette, semantic, text } from '@/theme';

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
          <ActivityIndicator color={organizer.accent} size="large" />
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

  const heroName = displayName.trim() || 'Your name';
  const heroBusiness = businessName.trim() || 'Business name';
  const emailDisplay = email || '—';

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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboard}>
        <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <Pressable onPress={onBack} style={styles.backHit}>
              <Text style={styles.backText}>← Dashboard</Text>
            </Pressable>

            <ThemedText style={styles.screenTitle}>Profile</ThemedText>

            <View style={styles.profileLogoSection}>
              <ThemedText style={styles.profileLogoLabel}>Profile Logo</ThemedText>
              <View style={styles.profileLogoCircle}>
                <Text style={styles.profileLogoText}>808</Text>
              </View>
            </View>

            <View style={styles.profileHero}>
              <ThemedText style={styles.heroName} numberOfLines={2}>
                {heroName}
              </ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.heroBusiness} numberOfLines={2}>
                {heroBusiness}
              </ThemedText>
            </View>

            <ThemedText style={styles.sectionHeading}>Account Information</ThemedText>
            <View style={styles.sectionCard}>
              <EventFormField
                autoCapitalize="words"
                label="Display Name"
                placeholder="Your name"
                tone="organizer"
                value={displayName}
                error={fieldErrors.displayName}
                onChangeText={setDisplayName}
              />
              <EventFormField
                autoCapitalize="words"
                label="Business Name"
                placeholder="Venue or promoter name"
                tone="organizer"
                value={businessName}
                error={fieldErrors.businessName}
                onChangeText={setBusinessName}
              />
              <EventFormField
                autoCapitalize="none"
                keyboardType="phone-pad"
                label="Phone Number"
                placeholder="+1 808 555 0100"
                tone="organizer"
                value={phoneNumber}
                error={fieldErrors.phoneNumber}
                onChangeText={setPhoneNumber}
              />
              <View style={styles.readOnlyFieldGroup}>
                <ThemedText style={styles.readOnlyLabel}>Email Address</ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.readOnlyHint}>
                  Read-only for now — tied to your sign-in account.
                </ThemedText>
                <View style={styles.readOnlyField}>
                  <Text style={styles.readOnlyText}>{emailDisplay}</Text>
                </View>
              </View>
            </View>

            {saveError ? <ThemedText style={styles.errorText}>{saveError}</ThemedText> : null}
            {saveSuccess ? <ThemedText style={styles.successText}>{saveSuccess}</ThemedText> : null}

            <Pressable
              disabled={isSaving || isSigningOut}
              onPress={handleSave}
              accessibilityRole="button"
              accessibilityLabel="Save profile"
              style={({ pressed }) => [
                styles.saveButton,
                pressed && styles.pressed,
                (isSaving || isSigningOut) && styles.buttonDisabled,
              ]}>
              {isSaving ? (
                <ActivityIndicator color={organizer.accent} />
              ) : (
                <Text style={styles.saveButtonText}>Save Profile</Text>
              )}
            </Pressable>

            <ThemedText style={styles.sectionHeading}>Coming Soon</ThemedText>
            <View style={styles.comingSoonCard}>
              <View style={styles.comingSoonRow}>
                <ThemedText themeColor="textSecondary">Profile Photo / Logo</ThemedText>
                <ThemedText style={styles.comingSoonBadge}>Coming Soon</ThemedText>
              </View>
              <View style={styles.comingSoonDivider} />
              <View style={styles.comingSoonRow}>
                <ThemedText themeColor="textSecondary">Team Management</ThemedText>
                <ThemedText style={styles.comingSoonBadge}>Coming Soon</ThemedText>
              </View>
              <View style={styles.comingSoonDivider} />
              <View style={styles.comingSoonRow}>
                <ThemedText themeColor="textSecondary">Business Settings</ThemedText>
                <ThemedText style={styles.comingSoonBadge}>Coming Soon</ThemedText>
              </View>
            </View>

            <View style={styles.signOutSpacer} />

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
  keyboard: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    gap: Spacing.two + 2,
    paddingBottom: Spacing.six,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
  },
  centered: {
    alignItems: 'center',
    backgroundColor: palette.pureBlack,
    flex: 1,
    justifyContent: 'center',
  },
  backHit: {
    paddingVertical: Spacing.one,
  },
  backText: {
    color: organizer.accent,
    fontSize: 15,
    fontWeight: '700',
  },
  screenTitle: {
    color: text.primary,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: 0.2,
    lineHeight: 34,
  },
  profileLogoSection: {
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  profileLogoLabel: {
    color: text.secondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  profileLogoCircle: {
    alignItems: 'center',
    backgroundColor: 'rgba(57, 255, 20, 0.08)',
    borderColor: organizer.accent,
    borderRadius: 999,
    borderWidth: 2,
    height: 96,
    justifyContent: 'center',
    width: 96,
  },
  profileLogoText: {
    color: organizer.accent,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  profileHero: {
    alignItems: 'center',
    gap: 4,
    paddingBottom: Spacing.one,
    paddingTop: Spacing.half,
  },
  heroName: {
    color: text.primary,
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
    textAlign: 'center',
  },
  heroBusiness: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
    textAlign: 'center',
  },
  sectionHeading: {
    color: text.primary,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
    marginTop: Spacing.one,
  },
  sectionCard: {
    backgroundColor: '#0C0C0C',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: Radii.card,
    borderWidth: 1,
    elevation: 2,
    gap: Spacing.three,
    padding: Spacing.three,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
  },
  readOnlyFieldGroup: {
    gap: Spacing.one,
  },
  readOnlyLabel: {
    color: text.secondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  readOnlyHint: {
    fontSize: 12,
    lineHeight: 16,
  },
  readOnlyField: {
    backgroundColor: palette.pureBlack,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  readOnlyText: {
    color: text.secondary,
    fontSize: 16,
    fontWeight: '500',
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(57, 255, 20, 0.1)',
    borderColor: organizer.accent,
    borderRadius: Radii.card,
    borderWidth: 1.5,
    justifyContent: 'center',
    marginTop: Spacing.one,
    minHeight: 56,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  saveButtonText: {
    color: organizer.accent,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  comingSoonCard: {
    backgroundColor: '#0C0C0C',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: Radii.card,
    borderWidth: 1,
    gap: 0,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  comingSoonRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
  },
  comingSoonDivider: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    height: 1,
  },
  comingSoonBadge: {
    color: text.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  signOutSpacer: {
    height: Spacing.four,
  },
  signOutButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 96, 96, 0.08)',
    borderColor: 'rgba(255, 96, 96, 0.4)',
    borderRadius: Radii.card,
    borderWidth: 1,
    minHeight: 52,
    paddingVertical: Spacing.three,
  },
  signOutButtonText: {
    color: semantic.errorSoft,
    fontSize: 16,
    fontWeight: '800',
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
