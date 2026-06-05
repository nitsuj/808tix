import type { Session, AuthError } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { completeAuthCallbackFromUrl, readAuthCallbackSnapshot } from '@/lib/auth-callback-url';
import { resolveAuthEmailRedirectUrl } from '@/lib/auth-redirect-url';
import {
  clearStaleLocalAuthSession,
  isStaleRefreshTokenError,
} from '@/lib/auth-session-recovery';
import type { Profile } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

type SignInResult = {
  error: AuthError | null;
};

type SignUpResult = {
  error: AuthError | null;
  needsEmailConfirmation: boolean;
};

type ResendResult = {
  error: AuthError | null;
};

type AuthContextValue = {
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  isProfileLoading: boolean;
  isAuthCallbackProcessing: boolean;
  isAuthenticated: boolean;
  profileMissing: boolean;
  accountJustConfirmed: boolean;
  authCallbackError: string | null;
  signInWithEmail: (email: string, password: string) => Promise<SignInResult>;
  signUpWithEmail: (email: string, password: string) => Promise<SignUpResult>;
  resendSignUpConfirmation: (email: string) => Promise<ResendResult>;
  ensureOrganizerProfile: () => Promise<Profile | null>;
  reloadProfile: () => Promise<Profile | null>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
  dismissAccountJustConfirmed: () => void;
  clearAuthCallbackError: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const PROFILE_RETRY_DELAYS_MS = [0, 400, 900];

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.warn('[auth] Failed to load profile:', error.message);
    return null;
  }

  return data;
}

async function ensureOrganizerProfileRpc(): Promise<Profile | null> {
  const { data, error } = await supabase.rpc('ensure_organizer_profile');

  if (error) {
    console.warn('[auth] ensure_organizer_profile failed:', error.message);
    return null;
  }

  return data as Profile;
}

async function loadProfileWithRetry(userId: string): Promise<Profile | null> {
  for (const waitMs of PROFILE_RETRY_DELAYS_MS) {
    if (waitMs > 0) {
      await delay(waitMs);
    }

    const profile = await fetchProfile(userId);

    if (profile) {
      return profile;
    }
  }

  return ensureOrganizerProfileRpc();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [isAuthCallbackProcessing, setIsAuthCallbackProcessing] = useState(false);
  const [accountJustConfirmed, setAccountJustConfirmed] = useState(false);
  const [authCallbackError, setAuthCallbackError] = useState<string | null>(null);

  const resetToSignedOutState = useCallback(() => {
    setSession(null);
    setProfile(null);
    setIsLoading(false);
    setIsProfileLoading(false);
    setIsAuthCallbackProcessing(false);
    setAccountJustConfirmed(false);
  }, []);

  const recoverFromStaleRefreshToken = useCallback(async () => {
    await clearStaleLocalAuthSession();
    resetToSignedOutState();
  }, [resetToSignedOutState]);

  const loadProfileForSession = useCallback(async (nextSession: Session | null) => {
    const userId = nextSession?.user.id;

    if (!userId) {
      setProfile(null);
      setIsProfileLoading(false);
      return;
    }

    setIsProfileLoading(true);
    const nextProfile = await loadProfileWithRetry(userId);
    setProfile(nextProfile);
    setIsProfileLoading(false);
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function bootstrap() {
      const callbackSnapshot = readAuthCallbackSnapshot();
      let callbackError: string | null = null;

      if (callbackSnapshot) {
        setIsAuthCallbackProcessing(true);

        const callbackResult = await completeAuthCallbackFromUrl();

        if (!isMounted) {
          return;
        }

        setIsAuthCallbackProcessing(false);
        callbackError = callbackResult.errorMessage;

        if (
          callbackResult.sessionEstablished &&
          callbackResult.intent?.isSignupConfirmation
        ) {
          setAccountJustConfirmed(true);
        }
      }

      const {
        data: { session: initialSession },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (!isMounted) {
        return;
      }

      if (sessionError) {
        if (isStaleRefreshTokenError(sessionError)) {
          await recoverFromStaleRefreshToken();

          if (!isMounted) {
            return;
          }

          if (callbackError) {
            setAuthCallbackError(callbackError);
          }

          return;
        }

        console.warn('[auth] getSession failed:', sessionError.message);
      }

      if (callbackError && !initialSession) {
        setAuthCallbackError(callbackError);
      }

      setSession(initialSession);
      setIsLoading(false);
      void loadProfileForSession(initialSession);
    }

    void bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!isMounted) {
        return;
      }

      setSession(nextSession);
      setIsLoading(false);

      if (event === 'SIGNED_IN' && nextSession) {
        const snapshot = readAuthCallbackSnapshot();

        if (snapshot?.intent.isSignupConfirmation) {
          setAccountJustConfirmed(true);
        }
      }

      void loadProfileForSession(nextSession);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfileForSession, recoverFromStaleRefreshToken]);

  const reloadProfile = useCallback(async () => {
    const userId = session?.user.id;

    if (!userId) {
      setProfile(null);
      return null;
    }

    setIsProfileLoading(true);
    const nextProfile = await loadProfileWithRetry(userId);
    setProfile(nextProfile);
    setIsProfileLoading(false);
    return nextProfile;
  }, [session?.user.id]);

  const ensureOrganizerProfile = useCallback(async () => {
    const userId = session?.user.id;

    if (!userId) {
      return null;
    }

    setIsProfileLoading(true);
    let nextProfile = await ensureOrganizerProfileRpc();

    if (!nextProfile) {
      nextProfile = await fetchProfile(userId);
    }

    setProfile(nextProfile);
    setIsProfileLoading(false);
    return nextProfile;
  }, [session?.user.id]);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    setAuthCallbackError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    return { error };
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string) => {
    const emailRedirectTo = resolveAuthEmailRedirectUrl();

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo,
      },
    });

    if (error) {
      return { error, needsEmailConfirmation: false };
    }

    const needsEmailConfirmation = Boolean(data.user && !data.session);

    if (data.session?.user.id) {
      setIsProfileLoading(true);
      const nextProfile = await loadProfileWithRetry(data.session.user.id);
      setProfile(nextProfile);
      setIsProfileLoading(false);
      setAccountJustConfirmed(true);
    }

    return { error: null, needsEmailConfirmation };
  }, []);

  const resendSignUpConfirmation = useCallback(async (email: string) => {
    const emailRedirectTo = resolveAuthEmailRedirectUrl();

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
      options: {
        emailRedirectTo,
      },
    });

    return { error };
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      if (isStaleRefreshTokenError(error)) {
        await clearStaleLocalAuthSession();
      } else {
        throw error;
      }
    }

    setSession(null);
    setProfile(null);
    setIsProfileLoading(false);
    setIsLoading(false);
    setAccountJustConfirmed(false);
    setAuthCallbackError(null);
  }, []);

  const refreshSession = useCallback(async () => {
    const { error } = await supabase.auth.refreshSession();

    if (!error) {
      return;
    }

    if (isStaleRefreshTokenError(error)) {
      await recoverFromStaleRefreshToken();
      return;
    }

    throw error;
  }, [recoverFromStaleRefreshToken]);

  const dismissAccountJustConfirmed = useCallback(() => {
    setAccountJustConfirmed(false);
  }, []);

  const clearAuthCallbackError = useCallback(() => {
    setAuthCallbackError(null);
  }, []);

  const profileMissing = session !== null && !isProfileLoading && profile === null;

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      isLoading,
      isProfileLoading,
      isAuthCallbackProcessing,
      isAuthenticated: session !== null,
      profileMissing,
      accountJustConfirmed,
      authCallbackError,
      signInWithEmail,
      signUpWithEmail,
      resendSignUpConfirmation,
      ensureOrganizerProfile,
      reloadProfile,
      signOut,
      refreshSession,
      dismissAccountJustConfirmed,
      clearAuthCallbackError,
    }),
    [
      session,
      profile,
      isLoading,
      isProfileLoading,
      isAuthCallbackProcessing,
      profileMissing,
      accountJustConfirmed,
      authCallbackError,
      signInWithEmail,
      signUpWithEmail,
      resendSignUpConfirmation,
      ensureOrganizerProfile,
      reloadProfile,
      signOut,
      refreshSession,
      dismissAccountJustConfirmed,
      clearAuthCallbackError,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
