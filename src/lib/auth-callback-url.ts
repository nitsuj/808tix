import type { EmailOtpType } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import {
  getAuthCallbackIntent,
  hasSupabaseAuthCallbackParams,
  parseAuthCallbackParams,
  stripAuthCallbackFromUrl,
  type AuthCallbackParams,
} from '@/lib/auth-callback-url.core';
import { supabase } from '@/lib/supabase';

export {
  getAuthCallbackIntent,
  hasSupabaseAuthCallbackParams,
  parseAuthCallbackParams,
  stripAuthCallbackFromUrl,
  type AuthCallbackParams,
} from '@/lib/auth-callback-url.core';

export type AuthCallbackSnapshot = {
  params: AuthCallbackParams;
  intent: ReturnType<typeof getAuthCallbackIntent>;
};

export function readAuthCallbackSnapshot(): AuthCallbackSnapshot | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return null;
  }

  const params = parseAuthCallbackParams(window.location.href);

  if (!hasSupabaseAuthCallbackParams(params)) {
    return null;
  }

  return {
    params,
    intent: getAuthCallbackIntent(params),
  };
}

export function clearAuthCallbackFromBrowserUrl(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return;
  }

  const clean = stripAuthCallbackFromUrl(window.location.href);
  window.history.replaceState(window.history.state, '', clean);
}

/**
 * Consume email-confirmation / magic-link tokens in the current URL.
 * Relies on supabase auth `detectSessionInUrl` for hash/PKCE; handles token_hash via verifyOtp.
 */
export async function completeAuthCallbackFromUrl(): Promise<{
  sessionEstablished: boolean;
  intent: ReturnType<typeof getAuthCallbackIntent> | null;
  errorMessage: string | null;
}> {
  const snapshot = readAuthCallbackSnapshot();

  if (!snapshot) {
    return { sessionEstablished: false, intent: null, errorMessage: null };
  }

  const { params, intent } = snapshot;

  if (intent.hasError) {
    clearAuthCallbackFromBrowserUrl();
    return {
      sessionEstablished: false,
      intent,
      errorMessage: intent.errorMessage,
    };
  }

  if (params.token_hash && params.type) {
    const otpType = params.type as EmailOtpType;
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: params.token_hash,
      type: otpType,
    });

    clearAuthCallbackFromBrowserUrl();

    if (error) {
      return {
        sessionEstablished: false,
        intent,
        errorMessage: error.message,
      };
    }

    return {
      sessionEstablished: Boolean(data.session),
      intent,
      errorMessage: null,
    };
  }

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  clearAuthCallbackFromBrowserUrl();

  if (error) {
    return {
      sessionEstablished: false,
      intent,
      errorMessage: error.message,
    };
  }

  return {
    sessionEstablished: Boolean(session),
    intent,
    errorMessage: session ? null : 'Confirmation link expired or invalid. Try signing in or resend the email.',
  };
}
