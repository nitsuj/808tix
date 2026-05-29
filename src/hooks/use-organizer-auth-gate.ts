import { useAuth } from '@/contexts/auth-context';

export type OrganizerAuthGateResult =
  | { state: 'loading' }
  | { state: 'unauthenticated' }
  | { state: 'profile_missing'; email: string | null; signOut: () => Promise<void> }
  | { state: 'ready'; organizerId: string };

export function useOrganizerAuthGate(): OrganizerAuthGateResult {
  const {
    isLoading,
    isProfileLoading,
    isAuthenticated,
    profileMissing,
    profile,
    session,
    signOut,
  } = useAuth();

  if (isLoading || (isAuthenticated && isProfileLoading)) {
    return { state: 'loading' };
  }

  if (!isAuthenticated || !session?.user.id) {
    return { state: 'unauthenticated' };
  }

  if (profileMissing) {
    return {
      state: 'profile_missing',
      email: session.user.email ?? null,
      signOut,
    };
  }

  if (!profile) {
    return { state: 'loading' };
  }

  return {
    state: 'ready',
    organizerId: profile.id,
  };
}
