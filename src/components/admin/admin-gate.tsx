import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { dashboardStyles as styles } from '@/components/dashboard/dashboard-styles';
import { dash } from '@/components/dashboard/dashboard-tokens';
import { useAuth } from '@/contexts/auth-context';
import {
  isLocalAdminQaEnabled,
  LOCAL_QA_ADMIN_PARAM,
  LOCAL_QA_PLATFORM_ADMIN_EMAIL,
  LOCAL_QA_PLATFORM_ADMIN_PASSWORD,
} from '@/lib/local-admin-qa';

type AdminGateProps = {
  children: ReactNode;
};

function LocalAdminQaControls() {
  const params = useLocalSearchParams<{ qaAdmin?: string }>();
  const { signInWithEmail } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoStarted = useRef(false);

  const signInLocalAdmin = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const { error: signInError } = await signInWithEmail(
        LOCAL_QA_PLATFORM_ADMIN_EMAIL,
        LOCAL_QA_PLATFORM_ADMIN_PASSWORD,
      );
      if (signInError) {
        const message = signInError.message ?? 'Sign in failed';
        setError(
          /invalid login|invalid email or password/i.test(message)
            ? 'Local platform admin not found. Run: npm run qa:seed'
            : message,
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [signInWithEmail]);

  useEffect(() => {
    if (autoStarted.current) return;
    const raw = params[LOCAL_QA_ADMIN_PARAM];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (value !== '1' && value !== 'true') return;
    autoStarted.current = true;
    const timer = setTimeout(() => {
      void signInLocalAdmin();
    }, 0);
    return () => clearTimeout(timer);
  }, [params, signInLocalAdmin]);

  return (
    <View style={{ gap: 10, width: '100%', maxWidth: 360, alignItems: 'center', marginTop: 12 }}>
      <Text style={[styles.muted, { textAlign: 'center' }]}>
        Local QA mode · signs in as {LOCAL_QA_PLATFORM_ADMIN_EMAIL} against local Supabase only.
      </Text>
      <Pressable
        style={[styles.primaryBtn, busy && styles.disabled, { width: '100%' }]}
        disabled={busy}
        onPress={() => void signInLocalAdmin()}
        accessibilityLabel="Continue as local platform admin"
      >
        <Text style={styles.primaryBtnText}>
          {busy ? 'Signing in…' : 'Continue as local platform admin'}
        </Text>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

/** Shared login / unauthorized / platform-admin gate for /admin routes. */
export function AdminGate({ children }: AdminGateProps) {
  const router = useRouter();
  const { isLoading, isAuthenticated, profile, isProfileLoading } = useAuth();
  const localQa = isLocalAdminQaEnabled();

  if (isLoading || (isAuthenticated && isProfileLoading)) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator color={dash.magenta} />
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
          {localQa ? <LocalAdminQaControls /> : null}
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
          {localQa ? (
            <Text style={[styles.muted, { marginTop: 8, textAlign: 'center' }]}>
              Local QA: sign out, then use “Continue as local platform admin” or open
              /admin?qaAdmin=1 after npm run qa:seed.
            </Text>
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  return children;
}
