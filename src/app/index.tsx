import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { MarketingHomepageScreen } from '@/components/marketing/marketing-homepage';
import { MissingProfileScreen } from '@/components/organizer/missing-profile-screen';
import {
  UpdatePasswordScreen,
} from '@/components/organizer/organizer-auth-screen';
import { OrganizerDashboard } from '@/components/organizer/organizer-dashboard';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { OrganizerAmbientBackground } from '@/components/ui/organizer-ambient-background';
import { formatDashboardGreeting, organizerProfileFromSources } from '@/lib/organizer-profile';
import { useAuth } from '@/contexts/auth-context';
import { fan, spacing } from '@/theme';

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

  return <MarketingHomepageScreen />;
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
