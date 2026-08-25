import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { adminStyles as styles } from '@/components/admin/admin-styles';
import { useAuth } from '@/contexts/auth-context';
import { organizer } from '@/theme/colors';

type AdminGateProps = {
  children: ReactNode;
};

/** Shared login / unauthorized / platform-admin gate for /admin routes. */
export function AdminGate({ children }: AdminGateProps) {
  const router = useRouter();
  const { isLoading, isAuthenticated, profile, isProfileLoading } = useAuth();

  if (isLoading || (isAuthenticated && isProfileLoading)) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator color={organizer.accent} />
          <Text style={styles.muted}>Checking session…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <Text style={styles.h1}>Admin</Text>
          <Text style={styles.muted}>Sign in required to access the platform admin cockpit.</Text>
          <Pressable style={styles.primaryBtn} onPress={() => router.push('/login')}>
            <Text style={styles.primaryBtnText}>Go to login</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!profile?.is_platform_admin) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <Text style={styles.h1}>Not authorized</Text>
          <Text style={styles.muted}>
            This account is signed in but is not a platform admin. Contact an 808Tickets operator if
            you need access.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return <SafeAreaView style={styles.safe}>{children}</SafeAreaView>;
}
