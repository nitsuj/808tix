import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import {
  OrganizerAuthScreen,
  UpdatePasswordScreen,
} from '@/components/organizer/organizer-auth-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { OrganizerAmbientBackground } from '@/components/ui/organizer-ambient-background';
import { useAuth } from '@/contexts/auth-context';
import { fan, spacing } from '@/theme';

export default function LoginScreen() {
  const {
    isLoading,
    isAuthCallbackProcessing,
    isAuthenticated,
    passwordRecoveryPending,
  } = useAuth();

  if (isLoading || isAuthCallbackProcessing) {
    return (
      <View style={styles.bootScreen}>
        <OrganizerAmbientBackground />
        <ThemedView style={styles.centered}>
          <ActivityIndicator size="large" color={fan.primary} />
          <ThemedText themeColor="textSecondary" style={styles.loadingText}>
            {isAuthCallbackProcessing ? 'Confirming your account…' : 'Loading session…'}
          </ThemedText>
        </ThemedView>
      </View>
    );
  }

  if (passwordRecoveryPending) {
    return <UpdatePasswordScreen />;
  }

  if (isAuthenticated) {
    return <Redirect href="/" />;
  }

  return <OrganizerAuthScreen />;
}

const styles = StyleSheet.create({
  bootScreen: {
    backgroundColor: 'transparent',
    flex: 1,
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
});
