import type { Href, Router } from 'expo-router';

/** Organizer dashboard — default fallback when web/direct entry has no nav history. */
export const ORGANIZER_DASHBOARD_ROUTE = '/' as Href;

/** Public marketing homepage. */
export const MARKETING_HOME_ROUTE = '/home' as Href;

/**
 * Avoid unhandled GO_BACK when there is no navigation stack (common on web deep links).
 * Uses history back when available; otherwise replaces with a stable fallback route.
 */
export function safeRouterBack(router: Router, fallbackRoute: Href): void {
  if (router.canGoBack()) {
    router.back();
    return;
  }

  router.replace(fallbackRoute);
}
