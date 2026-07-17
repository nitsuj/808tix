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
  validatePasswordResetRequest,
  validateSignInForm,
  validateSignUpForm,
  validateUpdatePasswordForm,
  type OrganizerAuthFieldErrors,
  type UpdatePasswordFieldErrors,
} from '@/lib/organizer-auth-form';
import { formatAuthError, getSupabaseTargetInfo } from '@/lib/supabase-target';
import { chrome, fan, semantic, spacing, text, typeScale } from '@/theme';

type AuthMode = 'sign_in' | 'create_account' | 'forgot_password';

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
    passwordRecoveryPending,
    signOut,
    dismissAccountJustConfirmed,
  } = useAuth();

  if (
    isLoading ||
    isAuthCallbackProcessing ||
    (isAuthenticated && isProfileLoading && !passwordRecoveryPending)
  ) {
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

  if (passwordRecoveryPending) {
    return <UpdatePasswordScreen />;
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
            accountJustConfirmed ? 'Account confirmed. Welcome to 808Tickets.' : undefined
          }
          onDismissWelcome={dismissAccountJustConfirmed}
        />
      </View>
    );
  }

  return <OrganizerAuthScreen />;
}

function OrganizerAuthScreen() {
  const {
    signInWithEmail,
    signUpWithEmail,
    requestPasswordReset,
    authCallbackError,
    clearAuthCallbackError,
  } = useAuth();
  const [mode, setMode] = useState<AuthMode>('sign_in');
  const [pendingSignupEmail, setPendingSignupEmail] = useState<string | null>(null);
  const [resetEmailSentTo, setResetEmailSentTo] = useState<string | null>(null);
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
    setResetEmailSentTo(null);
  }

  function handleBackToSignIn() {
    setPendingSignupEmail(null);
    setResetEmailSentTo(null);
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

  async function handleRequestPasswordReset() {
    const emailError = validatePasswordResetRequest(email);

    if (emailError) {
      setFieldErrors({ email: emailError });
      return;
    }

    setIsSubmitting(true);
    setFieldErrors({});
    setErrorMessage(null);
    clearAuthCallbackError();

    const { error } = await requestPasswordReset(email);

    if (error) {
      setErrorMessage(formatAuthError(error, supabaseTarget));
      setIsSubmitting(false);
      return;
    }

    setResetEmailSentTo(email.trim());
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

  if (resetEmailSentTo) {
    return (
      <PasswordResetSentScreen email={resetEmailSentTo} onBackToSignIn={handleBackToSignIn} />
    );
  }

  const isSignIn = mode === 'sign_in';
  const isForgotPassword = mode === 'forgot_password';
  const displayError = errorMessage ?? authCallbackError;

  return (
    <View style={styles.bootScreen}>
      <OrganizerAmbientBackground />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.brandBlock}>
            <Text style={styles.wordmark}>808Tickets</Text>
            <Text style={styles.tagline}>Independent events, verified at the door.</Text>
            <Text style={styles.eyebrow}>Organizer access</Text>
          </View>

          {!isForgotPassword ? (
            <View style={styles.modeRow}>
              <Pressable
                accessibilityRole="button"
                testID="auth-mode-sign-in"
                onPress={() => switchMode('sign_in')}
                style={[styles.modeChip, isSignIn && styles.modeChipActive]}>
                <Text style={[styles.modeChipText, isSignIn && styles.modeChipTextActive]}>
                  Sign In
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                testID="auth-mode-create-account"
                onPress={() => switchMode('create_account')}
                style={[styles.modeChip, !isSignIn && styles.modeChipActive]}>
                <Text style={[styles.modeChipText, !isSignIn && styles.modeChipTextActive]}>
                  Create Account
                </Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              testID="auth-back-to-sign-in"
              onPress={handleBackToSignIn}
              style={styles.forgotBackHit}>
              <Text style={styles.forgotBackText}>← Back to Sign In</Text>
            </Pressable>
          )}

          <GlassCard style={styles.formCard} testID="auth-form-card">
            {isForgotPassword ? (
              <ThemedText
                testID="auth-forgot-password-hint"
                themeColor="textSecondary"
                style={styles.forgotHint}>
                Enter your organizer email and we will send a reset link.
              </ThemedText>
            ) : null}

            <ThemedText type="smallBold" style={styles.label}>
              Email
            </ThemedText>
            <TextInput
              accessibilityLabel="Email"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              editable={!isSubmitting}
              keyboardType="email-address"
              placeholder="you@venue.com"
              placeholderTextColor={chrome.input.placeholder}
              style={styles.input}
              testID="auth-email-input"
              textContentType="emailAddress"
              value={email}
              onChangeText={setEmail}
            />
            {fieldErrors.email ? (
              <ThemedText style={styles.errorText}>{fieldErrors.email}</ThemedText>
            ) : null}

            {!isForgotPassword ? (
              <>
                <ThemedText type="smallBold" style={styles.label}>
                  Password
                </ThemedText>
                <TextInput
                  accessibilityLabel="Password"
                  autoCapitalize="none"
                  autoComplete={isSignIn ? 'password' : 'new-password'}
                  editable={!isSubmitting}
                  placeholder={isSignIn ? 'Password' : `At least ${MIN_PASSWORD_LENGTH} characters`}
                  placeholderTextColor={chrome.input.placeholder}
                  secureTextEntry
                  style={styles.input}
                  testID="auth-password-input"
                  textContentType={isSignIn ? 'password' : 'newPassword'}
                  value={password}
                  onChangeText={setPassword}
                />
                {fieldErrors.password ? (
                  <ThemedText style={styles.errorText}>{fieldErrors.password}</ThemedText>
                ) : null}

                {isSignIn ? (
                  <Pressable
                    accessibilityLabel="Forgot password?"
                    accessibilityRole="button"
                    testID="auth-forgot-password"
                    onPress={() => switchMode('forgot_password')}
                    style={styles.forgotLinkHit}>
                    <Text style={styles.forgotLinkText}>Forgot password?</Text>
                  </Pressable>
                ) : null}

                {!isSignIn ? (
                  <>
                    <ThemedText type="smallBold" style={styles.label}>
                      Confirm Password
                    </ThemedText>
                    <TextInput
                      accessibilityLabel="Confirm Password"
                      autoCapitalize="none"
                      autoComplete="new-password"
                      editable={!isSubmitting}
                      placeholder="Re-enter password"
                      placeholderTextColor={chrome.input.placeholder}
                      secureTextEntry
                      style={styles.input}
                      testID="auth-confirm-password-input"
                      textContentType="newPassword"
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                    />
                    {fieldErrors.confirmPassword ? (
                      <ThemedText style={styles.errorText}>{fieldErrors.confirmPassword}</ThemedText>
                    ) : null}
                  </>
                ) : null}
              </>
            ) : null}

            {displayError ? <ThemedText style={styles.errorText}>{displayError}</ThemedText> : null}

            <Pressable
              accessibilityRole="button"
              disabled={isSubmitting}
              testID={
                isForgotPassword
                  ? 'auth-send-reset-link'
                  : isSignIn
                    ? 'auth-submit-sign-in'
                    : 'auth-submit-create-account'
              }
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.primaryButtonPressed,
                isSubmitting && styles.primaryButtonDisabled,
              ]}
              onPress={
                isForgotPassword
                  ? handleRequestPasswordReset
                  : isSignIn
                    ? handleSignIn
                    : handleCreateAccount
              }>
              {isSubmitting ? (
                <ActivityIndicator color={chrome.white} />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {isForgotPassword
                    ? 'Send Reset Link'
                    : isSignIn
                      ? 'Sign In'
                      : 'Create Account'}
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

function PasswordResetSentScreen({
  email,
  onBackToSignIn,
}: {
  email: string;
  onBackToSignIn: () => void;
}) {
  return (
    <View style={styles.bootScreen}>
      <OrganizerAmbientBackground />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.brandBlock}>
          <Text style={styles.wordmark}>808Tickets</Text>
          <Text style={styles.tagline}>Check your email</Text>
        </View>
        <GlassCard style={styles.formCard} testID="auth-reset-sent">
          <ThemedText style={styles.resetSentTitle} testID="auth-reset-sent-title">
            Reset link sent
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.forgotHint}>
            If an account exists for {email}, you will receive a password reset link shortly. Open
            the link on this device to choose a new password.
          </ThemedText>
          <Pressable
            accessibilityRole="button"
            testID="auth-reset-sent-back"
            onPress={onBackToSignIn}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.primaryButtonPressed,
            ]}>
            <Text style={styles.primaryButtonText}>Back to Sign In</Text>
          </Pressable>
        </GlassCard>
      </SafeAreaView>
    </View>
  );
}

function UpdatePasswordScreen() {
  const { updatePassword, clearPasswordRecoveryPending, signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<UpdatePasswordFieldErrors>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const supabaseTarget = useMemo(() => getSupabaseTargetInfo(), []);

  async function handleUpdatePassword() {
    const errors = validateUpdatePasswordForm({ password, confirmPassword });

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);
    setFieldErrors({});
    setErrorMessage(null);

    const { error } = await updatePassword(password);

    if (error) {
      setErrorMessage(formatAuthError(error, supabaseTarget));
      setIsSubmitting(false);
      return;
    }

    setSuccessMessage('Password updated. You are signed in.');
    setIsSubmitting(false);
  }

  async function handleContinueAfterSuccess() {
    clearPasswordRecoveryPending();
  }

  async function handleCancelRecovery() {
    clearPasswordRecoveryPending();
    await signOut();
  }

  return (
    <View style={styles.bootScreen}>
      <OrganizerAmbientBackground />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.brandBlock}>
            <Text style={styles.wordmark}>808Tickets</Text>
            <Text style={styles.tagline}>Choose a new password</Text>
            <Text style={styles.eyebrow}>Password recovery</Text>
          </View>

          <GlassCard style={styles.formCard} testID="auth-update-password">
            <ThemedText type="smallBold" style={styles.label}>
              New Password
            </ThemedText>
            <TextInput
              accessibilityLabel="New Password"
              autoCapitalize="none"
              autoComplete="new-password"
              editable={!isSubmitting && !successMessage}
              placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
              placeholderTextColor={chrome.input.placeholder}
              secureTextEntry
              style={styles.input}
              testID="auth-update-password-input"
              textContentType="newPassword"
              value={password}
              onChangeText={setPassword}
            />
            {fieldErrors.password ? (
              <ThemedText style={styles.errorText}>{fieldErrors.password}</ThemedText>
            ) : null}

            <ThemedText type="smallBold" style={styles.label}>
              Confirm Password
            </ThemedText>
            <TextInput
              accessibilityLabel="Confirm Password"
              autoCapitalize="none"
              autoComplete="new-password"
              editable={!isSubmitting && !successMessage}
              placeholder="Re-enter password"
              placeholderTextColor={chrome.input.placeholder}
              secureTextEntry
              style={styles.input}
              testID="auth-update-confirm-password-input"
              textContentType="newPassword"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
            {fieldErrors.confirmPassword ? (
              <ThemedText style={styles.errorText}>{fieldErrors.confirmPassword}</ThemedText>
            ) : null}

            {errorMessage ? <ThemedText style={styles.errorText}>{errorMessage}</ThemedText> : null}
            {successMessage ? (
              <ThemedText themeColor="textSecondary" style={styles.forgotHint}>
                {successMessage}
              </ThemedText>
            ) : null}

            {!successMessage ? (
              <Pressable
                accessibilityRole="button"
                disabled={isSubmitting}
                testID="auth-submit-update-password"
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.primaryButtonPressed,
                  isSubmitting && styles.primaryButtonDisabled,
                ]}
                onPress={handleUpdatePassword}>
                {isSubmitting ? (
                  <ActivityIndicator color={chrome.white} />
                ) : (
                  <Text style={styles.primaryButtonText}>Update Password</Text>
                )}
              </Pressable>
            ) : null}

            <Pressable
              onPress={successMessage ? handleContinueAfterSuccess : handleCancelRecovery}
              style={styles.forgotLinkHit}>
              <Text style={styles.forgotLinkText}>
                {successMessage ? 'Continue' : 'Cancel and sign out'}
              </Text>
            </Pressable>
          </GlassCard>
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
  forgotLinkHit: {
    alignSelf: 'flex-end',
    marginTop: spacing.one,
    paddingVertical: spacing.one,
  },
  forgotLinkText: {
    color: fan.badgeText,
    fontSize: 13,
    fontWeight: '600',
  },
  forgotBackHit: {
    alignSelf: 'flex-start',
  },
  forgotBackText: {
    color: fan.badgeText,
    fontSize: 14,
    fontWeight: '600',
  },
  forgotHint: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.one,
  },
  resetSentTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: spacing.one,
  },
});
