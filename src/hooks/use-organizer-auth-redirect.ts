import { useRouter, type Href } from 'expo-router';
import { useEffect } from 'react';

import type { OrganizerAuthGateResult } from '@/hooks/use-organizer-auth-gate';

/** Public organizer sign-in route (index). */
export const ORGANIZER_AUTH_ROUTE = '/' as Href;

/**
 * Redirect unauthenticated users to the auth screen.
 * Must run in useEffect — never call router.replace during render.
 */
export function useOrganizerAuthRedirect(
  authState: OrganizerAuthGateResult['state'],
  route: Href = ORGANIZER_AUTH_ROUTE,
) {
  const router = useRouter();

  useEffect(() => {
    if (authState === 'unauthenticated') {
      router.replace(route);
    }
  }, [authState, route, router]);
}
