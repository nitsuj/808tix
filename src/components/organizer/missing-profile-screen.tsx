import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, OrganizerAccent, Spacing } from '@/constants/theme';

type MissingProfileScreenProps = {
  email?: string | null;
  onSignOut: () => Promise<void>;
};

export function MissingProfileScreen({ email, onSignOut }: MissingProfileScreenProps) {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

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
          Organizer profile missing
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.body}>
          You are signed in{email ? ` as ${email}` : ''}, but there is no matching organizer profile
          in the database. Event creation and other organizer actions are blocked until a profile
          exists.
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.body}>
          After a local Supabase reset, recreate your user in the Supabase dashboard or run a profile
          backfill for your account, then sign in again.
        </ThemedText>

        {signOutError ? <ThemedText style={styles.errorText}>{signOutError}</ThemedText> : null}

        <Pressable
          disabled={isSigningOut}
          onPress={handleSignOut}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.pressed,
            isSigningOut && styles.disabled,
          ]}>
          {isSigningOut ? (
            <ActivityIndicator color="#000" />
          ) : (
            <ThemedText style={styles.primaryButtonText}>Sign out</ThemedText>
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
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.6,
  },
});
