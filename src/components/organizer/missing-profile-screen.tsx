import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, OrganizerAccent, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';

type MissingProfileScreenProps = {
  email?: string | null;
  onSignOut: () => Promise<void>;
};

export function MissingProfileScreen({ email, onSignOut }: MissingProfileScreenProps) {
  const { ensureOrganizerProfile } = useAuth();
  const [isEnsuring, setIsEnsuring] = useState(false);
  const [ensureError, setEnsureError] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  async function handleEnsureProfile() {
    setIsEnsuring(true);
    setEnsureError(null);

    const profile = await ensureOrganizerProfile();

    if (!profile) {
      setEnsureError(
        'Could not create your organizer profile. Try again or sign out and use Create Account.',
      );
    }

    setIsEnsuring(false);
  }

  async function handleSignOut() {
    setIsSigningOut(true);
    setSignOutError(null);

    try {
      await onSignOut();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not sign out.';
      setSignOutError(message);
      setIsSigningOut(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="subtitle" style={styles.title}>
          Organizer profile not ready
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.body}>
          You are signed in{email ? ` as ${email}` : ''}, but your organizer profile is not set up
          yet. Event creation and scanning require a profile before you can continue.
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.body}>
          Tap set up profile to finish account setup. If this keeps failing, sign out and use Create
          Account on the login screen.
        </ThemedText>

        {ensureError ? <ThemedText style={styles.errorText}>{ensureError}</ThemedText> : null}
        {signOutError ? <ThemedText style={styles.errorText}>{signOutError}</ThemedText> : null}

        <Pressable
          disabled={isEnsuring}
          onPress={handleEnsureProfile}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.pressed,
            isEnsuring && styles.disabled,
          ]}>
          {isEnsuring ? (
            <ActivityIndicator color="#000" />
          ) : (
            <ThemedText style={styles.primaryButtonText}>Set up organizer profile</ThemedText>
          )}
        </Pressable>

        <Pressable
          disabled={isSigningOut}
          onPress={handleSignOut}
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && styles.pressed,
            isSigningOut && styles.disabled,
          ]}>
          {isSigningOut ? (
            <ActivityIndicator color={OrganizerAccent} />
          ) : (
            <ThemedText style={styles.secondaryButtonText}>Sign out</ThemedText>
          )}
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.five,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  title: {
    color: OrganizerAccent,
    fontSize: 24,
    lineHeight: 30,
  },
  body: {
    lineHeight: 22,
  },
  errorText: {
    color: '#ff6b6b',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: OrganizerAccent,
    borderRadius: Spacing.two,
    marginTop: Spacing.two,
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
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.6,
  },
});
