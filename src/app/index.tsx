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

import { MissingProfileScreen } from '@/components/organizer/missing-profile-screen';
import { OrganizerDashboard } from '@/components/organizer/organizer-dashboard';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { GlassCard } from '@/components/ui/glass-card';
import { OrganizerAmbientBackground } from '@/components/ui/organizer-ambient-background';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { formatAuthSignInError, getSupabaseTargetInfo } from '@/lib/supabase-target';
import {
  chrome,
  fan,
  organizer,
  semantic,
  spacing,
  surface,
  text,
  typeScale,
} from '@/theme';

export default function IndexScreen() {
  const {
    isLoading,
    isProfileLoading,
    isAuthenticated,
    profile,
    profileMissing,
    session,
    signInWithEmail,
    signOut,
  } = useAuth();

  if (isLoading || (isAuthenticated && isProfileLoading)) {
    return (
      <View style={styles.bootScreen}>
        <OrganizerAmbientBackground />
        <ThemedView style={styles.centered}>
          <ActivityIndicator size="large" color={fan.primary} />
          <ThemedText themeColor="textSecondary" style={styles.loadingText}>
            Loading session…
          </ThemedText>
        </ThemedView>
      </View>
    );
  }

  if (isAuthenticated && profileMissing) {
    return <MissingProfileScreen email={session?.user.email} onSignOut={signOut} />;
  }

  if (isAuthenticated && profile && session?.user.id) {
    const displayEmail = profile.email ?? session.user.email ?? 'Unknown';
    const displayName = profile.full_name?.trim() || displayEmail;

    return (
      <OrganizerDashboard
        displayEmail={displayEmail}
        displayName={displayName}
        organizerId={profile.id}
        onSignOut={signOut}
      />
    );
  }

  return <LoginForm onSignIn={signInWithEmail} />;
}

type LoginFormProps = {
  onSignIn: (email: string, password: string) => Promise<{ error: { message: string } | null }>;
};

function LoginForm({ onSignIn }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const supabaseTarget = useMemo(() => getSupabaseTargetInfo(), []);

  async function handleSignIn() {
    if (!email.trim() || !password) {
      setErrorMessage('Enter your email and password.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const { error } = await onSignIn(email, password);

    if (error) {
      setErrorMessage(formatAuthSignInError(error, supabaseTarget));
    }

    setIsSubmitting(false);
  }

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

            <ThemedText type="smallBold" style={styles.label}>
              Password
            </ThemedText>
            <TextInput
              autoCapitalize="none"
              autoComplete="password"
              editable={!isSubmitting}
              placeholder="Password"
              placeholderTextColor={chrome.input.placeholder}
              secureTextEntry
              style={styles.input}
              textContentType="password"
              value={password}
              onChangeText={setPassword}
            />

            {errorMessage ? <ThemedText style={styles.errorText}>{errorMessage}</ThemedText> : null}

            <Pressable
              disabled={isSubmitting}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.primaryButtonPressed,
                isSubmitting && styles.primaryButtonDisabled,
              ]}
              onPress={handleSignIn}>
              {isSubmitting ? (
                <ActivityIndicator color={organizer.textOn} />
              ) : (
                <Text style={styles.primaryButtonText}>Sign in</Text>
              )}
            </Pressable>
          </GlassCard>

          <View style={styles.envFooter}>
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
  bootScreen: {
    backgroundColor: surface.background,
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
    justifyContent: 'center',
    gap: spacing.two,
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
    marginTop: spacing.one,
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
    gap: spacing.one,
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
