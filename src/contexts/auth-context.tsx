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

import type { Profile } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

type SignInResult = {
  error: AuthError | null;
};

type SignUpResult = {
  error: AuthError | null;
  needsEmailConfirmation: boolean;
};

type AuthContextValue = {
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  isProfileLoading: boolean;
  isAuthenticated: boolean;
  profileMissing: boolean;
  signInWithEmail: (email: string, password: string) => Promise<SignInResult>;
  signUpWithEmail: (email: string, password: string) => Promise<SignUpResult>;
  ensureOrganizerProfile: () => Promise<Profile | null>;
  reloadProfile: () => Promise<Profile | null>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
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

    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (!isMounted) {
        return;
      }

      setSession(initialSession);
      setIsLoading(false);
      void loadProfileForSession(initialSession);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) {
        return;
      }

      setSession(nextSession);
      setIsLoading(false);
      void loadProfileForSession(nextSession);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfileForSession]);

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
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    return { error };
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
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
    }

    return { error: null, needsEmailConfirmation };
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw error;
    }
  }, []);

  const refreshSession = useCallback(async () => {
    const { error } = await supabase.auth.refreshSession();

    if (error) {
      throw error;
    }
  }, []);

  const profileMissing = session !== null && !isProfileLoading && profile === null;

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      isLoading,
      isProfileLoading,
      isAuthenticated: session !== null,
      profileMissing,
      signInWithEmail,
      signUpWithEmail,
      ensureOrganizerProfile,
      reloadProfile,
      signOut,
      refreshSession,
    }),
    [
      session,
      profile,
      isLoading,
      isProfileLoading,
      profileMissing,
      signInWithEmail,
      signUpWithEmail,
      ensureOrganizerProfile,
      reloadProfile,
      signOut,
      refreshSession,
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
