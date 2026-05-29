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

import { OrganizerDashboard } from '@/components/organizer/organizer-dashboard';
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

  if (isAuthenticated && session?.user.id) {
    const displayEmail = profile?.email ?? session.user.email ?? 'Unknown';
    const displayName = profile?.full_name?.trim() || displayEmail;

    return (
      <OrganizerDashboard
        displayEmail={displayEmail}
        displayName={displayName}
        organizerId={session.user.id}
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
});
