import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LegalFooterLinks } from '@/components/legal/legal-footer-links';
import { MissingProfileScreen } from '@/components/organizer/missing-profile-screen';
import { OrganizerDashboard } from '@/components/organizer/organizer-dashboard';
import { formatDashboardGreeting, organizerProfileFromSources } from '@/lib/organizer-profile';
import { SignUpCheckEmailScreen } from '@/components/organizer/signup-check-email-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { GlassCard } from '@/components/ui/glass-card';
import { OrganizerAmbientBackground } from '@/components/ui/organizer-ambient-background';
import { MaxContentWidth } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import {
  MIN_PASSWORD_LENGTH,
  validateSignInForm,
  validateSignUpForm,
  type OrganizerAuthFieldErrors,
} from '@/lib/organizer-auth-form';
import { formatAuthError, getSupabaseTargetInfo } from '@/lib/supabase-target';
import {
  chrome,
  fan,
  organizer,
  semantic,
  spacing,
  text,
  typeScale,
} from '@/theme';

type AuthMode = 'sign_in' | 'create_account';

export default function IndexScreen() {
  const {
    isLoading,
    isAuthCallbackProcessing,
    isProfileLoading,
    isAuthenticated,
    profile,
    profileMissing,
    session,
    accountJustConfirmed,
    signOut,
    dismissAccountJustConfirmed,
  } = useAuth();

  if (isLoading || isAuthCallbackProcessing || (isAuthenticated && isProfileLoading)) {
    const loadingMessage = isAuthCallbackProcessing
      ? 'Confirming your account…'
      : isAuthenticated
        ? 'Loading your profile…'
        : 'Loading session…';

    return (
      <View style={styles.bootScreen}>
        <OrganizerAmbientBackground />
        <ThemedView style={styles.centered}>
          <ActivityIndicator size="large" color={fan.primary} />
          <ThemedText themeColor="textSecondary" style={styles.loadingText}>
            {loadingMessage}
          </ThemedText>
        </ThemedView>
      </View>
    );
  }

  if (isAuthenticated && profileMissing) {
    return <MissingProfileScreen email={session?.user.email} onSignOut={signOut} />;
  }

  if (isAuthenticated && profile && session?.user.id) {
    const profileValues = organizerProfileFromSources(
      profile,
      session.user.email,
      session.user.user_metadata,
    );
    const greetingLine = formatDashboardGreeting(
      profileValues.displayName || profileValues.email,
      !accountJustConfirmed,
    );

    return (
      <View style={styles.dashboardShell}>
        <OrganizerDashboard
          greetingLine={greetingLine}
          logoUrl={profileValues.logoUrl}
          organizerId={profile.id}
          welcomeMessage={
            accountJustConfirmed ? 'Account confirmed. Welcome to 808Tix.' : undefined
          }
          onDismissWelcome={dismissAccountJustConfirmed}
        />
      </View>
    );
  }

  return <OrganizerAuthScreen />;
}

function OrganizerAuthScreen() {
  const { signInWithEmail, signUpWithEmail, authCallbackError, clearAuthCallbackError } = useAuth();
  const [mode, setMode] = useState<AuthMode>('sign_in');
  const [pendingSignupEmail, setPendingSignupEmail] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<OrganizerAuthFieldErrors>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const supabaseTarget = useMemo(() => getSupabaseTargetInfo(), []);

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setFieldErrors({});
    setErrorMessage(null);
    clearAuthCallbackError();
    setConfirmPassword('');
  }

  function handleBackToSignIn() {
    setPendingSignupEmail(null);
    switchMode('sign_in');
  }

  function handleChangeEmail() {
    setPendingSignupEmail(null);
    switchMode('create_account');
  }

  async function handleSignIn() {
    const errors = validateSignInForm({ email, password });

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);
    setFieldErrors({});
    setErrorMessage(null);
    clearAuthCallbackError();

    const { error } = await signInWithEmail(email, password);

    if (error) {
      setErrorMessage(formatAuthError(error, supabaseTarget));
    }

    setIsSubmitting(false);
  }

  async function handleCreateAccount() {
    const errors = validateSignUpForm({ email, password, confirmPassword });

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);
    setFieldErrors({});
    setErrorMessage(null);
    clearAuthCallbackError();

    const { error, needsEmailConfirmation } = await signUpWithEmail(email, password);

    if (error) {
      setErrorMessage(formatAuthError(error, supabaseTarget));
      setIsSubmitting(false);
      return;
    }

    if (needsEmailConfirmation) {
      setPendingSignupEmail(email.trim());
      setPassword('');
      setConfirmPassword('');
    }

    setIsSubmitting(false);
  }

  if (pendingSignupEmail) {
    return (
      <SignUpCheckEmailScreen
        email={pendingSignupEmail}
        onBackToSignIn={handleBackToSignIn}
        onChangeEmail={handleChangeEmail}
      />
    );
  }

  const isSignIn = mode === 'sign_in';
  const displayError = errorMessage ?? authCallbackError;

  return (
    <View style={styles.bootScreen}>
      <OrganizerAmbientBackground />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.brandBlock}>
            <Text style={styles.wordmark}>808Tix</Text>
            <Text style={styles.tagline}>Independent events, verified at the door.</Text>
            <Text style={styles.eyebrow}>Organizer access</Text>
          </View>

          <View style={styles.modeRow}>
            <Pressable
              onPress={() => switchMode('sign_in')}
              style={[styles.modeChip, isSignIn && styles.modeChipActive]}>
              <Text style={[styles.modeChipText, isSignIn && styles.modeChipTextActive]}>
                Sign In
              </Text>
            </Pressable>
            <Pressable
              onPress={() => switchMode('create_account')}
              style={[styles.modeChip, !isSignIn && styles.modeChipActive]}>
              <Text style={[styles.modeChipText, !isSignIn && styles.modeChipTextActive]}>
                Create Account
              </Text>
            </Pressable>
          </View>

          <GlassCard style={styles.formCard}>
            <ThemedText type="smallBold" style={styles.label}>
              Email
            </ThemedText>
            <TextInput
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              editable={!isSubmitting}
              keyboardType="email-address"
              placeholder="you@venue.com"
              placeholderTextColor={chrome.input.placeholder}
              style={styles.input}
              textContentType="emailAddress"
              value={email}
              onChangeText={setEmail}
            />
            {fieldErrors.email ? (
              <ThemedText style={styles.errorText}>{fieldErrors.email}</ThemedText>
            ) : null}

            <ThemedText type="smallBold" style={styles.label}>
              Password
            </ThemedText>
            <TextInput
              autoCapitalize="none"
              autoComplete={isSignIn ? 'password' : 'new-password'}
              editable={!isSubmitting}
              placeholder={isSignIn ? 'Password' : `At least ${MIN_PASSWORD_LENGTH} characters`}
              placeholderTextColor={chrome.input.placeholder}
              secureTextEntry
              style={styles.input}
              textContentType={isSignIn ? 'password' : 'newPassword'}
              value={password}
              onChangeText={setPassword}
            />
            {fieldErrors.password ? (
              <ThemedText style={styles.errorText}>{fieldErrors.password}</ThemedText>
            ) : null}

            {!isSignIn ? (
              <>
                <ThemedText type="smallBold" style={styles.label}>
                  Confirm Password
                </ThemedText>
                <TextInput
                  autoCapitalize="none"
                  autoComplete="new-password"
                  editable={!isSubmitting}
                  placeholder="Re-enter password"
                  placeholderTextColor={chrome.input.placeholder}
                  secureTextEntry
                  style={styles.input}
                  textContentType="newPassword"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />
                {fieldErrors.confirmPassword ? (
                  <ThemedText style={styles.errorText}>{fieldErrors.confirmPassword}</ThemedText>
                ) : null}
              </>
            ) : null}

            {displayError ? <ThemedText style={styles.errorText}>{displayError}</ThemedText> : null}

            <Pressable
              disabled={isSubmitting}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.primaryButtonPressed,
                isSubmitting && styles.primaryButtonDisabled,
              ]}
              onPress={isSignIn ? handleSignIn : handleCreateAccount}>
              {isSubmitting ? (
                <ActivityIndicator color={organizer.textOn} />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {isSignIn ? 'Sign In' : 'Create Account'}
                </Text>
              )}
            </Pressable>
          </GlassCard>

          <View style={styles.envFooter}>
            <LegalFooterLinks centered variant="organizer" />
            <Text style={styles.envLabel}>
              Auth: {supabaseTarget.label} · {supabaseTarget.host}
            </Text>
            {!supabaseTarget.isConfigured ? (
              <Text style={styles.envHint}>
                Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env, then restart
                the dev server.
              </Text>
            ) : null}
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  dashboardShell: {
    backgroundColor: 'transparent',
    flex: 1,
  },
  bootScreen: {
    backgroundColor: 'transparent',
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  safeArea: {
    alignSelf: 'center',
    flex: 1,
    gap: spacing.five,
    justifyContent: 'center',
    maxWidth: MaxContentWidth,
    paddingHorizontal: spacing.four,
    paddingVertical: spacing.five,
    width: '100%',
  },
  centered: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    flex: 1,
    gap: spacing.two,
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: spacing.two,
  },
  brandBlock: {
    gap: spacing.two,
  },
  wordmark: {
    color: chrome.brand.wordmark,
    fontSize: typeScale.screenTitle.fontSize + 8,
    fontWeight: '800',
    letterSpacing: -1,
    lineHeight: 48,
  },
  tagline: {
    color: chrome.brand.tagline,
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 320,
  },
  eyebrow: {
    color: chrome.brand.eyebrow,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: spacing.one,
    textTransform: 'uppercase',
  },
  modeRow: {
    flexDirection: 'row',
    gap: spacing.two,
  },
  modeChip: {
    borderColor: chrome.glass.border,
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: spacing.three,
    paddingVertical: spacing.two,
  },
  modeChipActive: {
    borderColor: fan.primary,
    backgroundColor: 'rgba(162, 91, 255, 0.12)',
  },
  modeChipText: {
    color: text.secondary,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  modeChipTextActive: {
    color: fan.badgeText,
  },
  formCard: {
    gap: spacing.two,
  },
  label: {
    marginTop: spacing.one,
  },
  input: {
    backgroundColor: chrome.input.background,
    borderColor: chrome.input.border,
    borderRadius: 12,
    borderWidth: 1,
    color: text.primary,
    fontSize: 16,
    paddingHorizontal: spacing.three,
    paddingVertical: spacing.two + 2,
  },
  errorText: {
    color: semantic.errorSoft,
    fontSize: 14,
    lineHeight: 20,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: fan.primary,
    borderRadius: 12,
    marginTop: spacing.three,
    paddingVertical: spacing.three,
  },
  primaryButtonPressed: {
    opacity: 0.88,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: chrome.white,
    fontSize: 16,
    fontWeight: '700',
  },
  envFooter: {
    alignItems: 'center',
    gap: spacing.two,
  },
  envLabel: {
    color: text.muted,
    fontSize: 11,
    letterSpacing: 0.3,
    lineHeight: 16,
  },
  envHint: {
    color: fan.badgeText,
    fontSize: 11,
    lineHeight: 16,
  },
});
