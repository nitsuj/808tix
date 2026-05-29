import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, OrganizerAccent, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';

export default function IndexScreen() {
  const { isLoading, isAuthenticated, profile, session, signInWithEmail, signOut } = useAuth();

  if (isLoading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" color={OrganizerAccent} />
        <ThemedText themeColor="textSecondary" style={styles.loadingText}>
          Loading session…
        </ThemedText>
      </ThemedView>
    );
  }

  if (isAuthenticated) {
    return <OrganizerHome profileEmail={profile?.email} sessionEmail={session?.user.email} onSignOut={signOut} />;
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

  async function handleSignIn() {
    if (!email.trim() || !password) {
      setErrorMessage('Enter your email and password.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const { error } = await onSignIn(email, password);

    if (error) {
      setErrorMessage(error.message);
    }

    setIsSubmitting(false);
  }

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText type="subtitle" style={styles.title}>
            808Tix
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.subtitle}>
            Organizer sign in
          </ThemedText>

          <ThemedView type="backgroundElement" style={styles.form}>
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
              placeholderTextColor="#666"
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
              placeholderTextColor="#666"
              secureTextEntry
              style={styles.input}
              textContentType="password"
              value={password}
              onChangeText={setPassword}
            />

            {errorMessage ? (
              <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
            ) : null}

            <Pressable
              disabled={isSubmitting}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.primaryButtonPressed,
                isSubmitting && styles.primaryButtonDisabled,
              ]}
              onPress={handleSignIn}>
              {isSubmitting ? (
                <ActivityIndicator color="#000" />
              ) : (
                <ThemedText style={styles.primaryButtonText}>Sign in</ThemedText>
              )}
            </Pressable>
          </ThemedView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

type OrganizerHomeProps = {
  profileEmail: string | null | undefined;
  sessionEmail: string | undefined;
  onSignOut: () => Promise<void>;
};

function OrganizerHome({ profileEmail, sessionEmail, onSignOut }: OrganizerHomeProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const displayEmail = profileEmail ?? sessionEmail ?? 'Unknown';

  async function handleSignOut() {
    setIsSigningOut(true);
    setErrorMessage(null);

    try {
      await onSignOut();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign out failed.';
      setErrorMessage(message);
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="subtitle" style={styles.title}>
          Organizer
        </ThemedText>

        <ThemedView type="backgroundElement" style={styles.homeCard}>
          <ThemedView style={styles.statusRow}>
            <ThemedView style={styles.statusDot} />
            <ThemedText type="smallBold" style={styles.statusText}>
              Auth connected
            </ThemedText>
          </ThemedView>

          <ThemedText themeColor="textSecondary" style={styles.homeLabel}>
            Signed in as
          </ThemedText>
          <ThemedText style={styles.homeEmail}>{displayEmail}</ThemedText>

          {errorMessage ? (
            <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
          ) : null}

          <Pressable
            disabled={isSigningOut}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.secondaryButtonPressed,
              isSigningOut && styles.primaryButtonDisabled,
            ]}
            onPress={handleSignOut}>
            {isSigningOut ? (
              <ActivityIndicator color={OrganizerAccent} />
            ) : (
              <ThemedText style={styles.secondaryButtonText}>Sign out</ThemedText>
            )}
          </Pressable>
        </ThemedView>
      </SafeAreaView>
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
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.five,
    gap: Spacing.three,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  loadingText: {
    marginTop: Spacing.two,
  },
  title: {
    fontSize: 32,
    lineHeight: 40,
  },
  subtitle: {
    marginBottom: Spacing.two,
  },
  form: {
    gap: Spacing.two,
    padding: Spacing.four,
    borderRadius: Spacing.three,
  },
  label: {
    marginTop: Spacing.one,
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
  errorText: {
    color: '#ff6b6b',
    marginTop: Spacing.one,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: OrganizerAccent,
    borderRadius: Spacing.two,
    marginTop: Spacing.three,
    paddingVertical: Spacing.three,
  },
  primaryButtonPressed: {
    opacity: 0.85,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
  homeCard: {
    gap: Spacing.two,
    padding: Spacing.four,
    borderRadius: Spacing.three,
  },
  statusRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  statusDot: {
    backgroundColor: OrganizerAccent,
    borderRadius: 6,
    height: 12,
    width: 12,
  },
  statusText: {
    color: OrganizerAccent,
  },
  homeLabel: {
    fontSize: 14,
  },
  homeEmail: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: Spacing.two,
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: OrganizerAccent,
    borderRadius: Spacing.two,
    borderWidth: 1,
    marginTop: Spacing.two,
    paddingVertical: Spacing.three,
  },
  secondaryButtonPressed: {
    opacity: 0.85,
  },
  secondaryButtonText: {
    color: OrganizerAccent,
    fontSize: 16,
    fontWeight: '600',
  },
});
