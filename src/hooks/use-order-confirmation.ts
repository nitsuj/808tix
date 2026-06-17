import { useCallback, useEffect, useRef, useState } from 'react';

import type { GetOrderByPublicTokenResult } from '@/lib/database.types';
import { getOrderByPublicToken } from '@/lib/get-order-by-public-token';

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 90_000;

export type OrderConfirmationPhase =
  | 'idle'
  | 'loading'
  | 'confirming'
  | 'paid'
  | 'unavailable'
  | 'timeout'
  | 'error';

export type OrderConfirmationState = {
  phase: OrderConfirmationPhase;
  order: GetOrderByPublicTokenResult | null;
  error: string | null;
  refresh: () => void;
};

const CONFIRMING_STATUSES = new Set(['pending', 'checkout_open']);

function resolvePhase(
  order: GetOrderByPublicTokenResult | null,
  timedOut: boolean,
  error: string | null,
): OrderConfirmationPhase {
  if (error) {
    return 'error';
  }

  if (!order) {
    return timedOut ? 'timeout' : 'unavailable';
  }

  if (order.status === 'paid') {
    return 'paid';
  }

  if (CONFIRMING_STATUSES.has(order.status)) {
    return timedOut ? 'timeout' : 'confirming';
  }

  return 'unavailable';
}

export function useOrderConfirmation(
  publicAccessToken: string,
  options?: { poll?: boolean },
): OrderConfirmationState {
  const shouldPoll = options?.poll ?? true;
  const [order, setOrder] = useState<GetOrderByPublicTokenResult | null>(null);
  const [phase, setPhase] = useState<OrderConfirmationPhase>(() =>
    publicAccessToken.trim() ? 'loading' : 'unavailable',
  );
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const startedAtRef = useRef<number | null>(null);

  const refresh = useCallback(() => {
    setRefreshKey((value) => value + 1);
  }, []);

  useEffect(() => {
    const token = publicAccessToken.trim();

    if (!token) {
      return;
    }

    let isMounted = true;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    startedAtRef.current = Date.now();

    async function pollOnce(): Promise<boolean> {
      try {
        const result = await getOrderByPublicToken(token);

        if (!isMounted) {
          return true;
        }

        setOrder(result);
        setError(null);

        const timedOut = Date.now() - (startedAtRef.current ?? Date.now()) >= POLL_TIMEOUT_MS;
        const nextPhase = resolvePhase(result, timedOut, null);
        setPhase(nextPhase);

        if (nextPhase === 'paid' || nextPhase === 'unavailable' || nextPhase === 'timeout') {
          return true;
        }

        return timedOut;
      } catch (pollError) {
        if (!isMounted) {
          return true;
        }

        const message =
          pollError instanceof Error ? pollError.message : 'Could not load order status.';
        setError(message);
        setPhase('error');
        return true;
      }
    }

    async function run() {
      const doneAfterFirst = await pollOnce();

      if (!shouldPoll || doneAfterFirst || !isMounted) {
        return;
      }

      intervalId = setInterval(() => {
        void pollOnce().then((done) => {
          if (done && intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }
        });
      }, POLL_INTERVAL_MS);
    }

    void run();

    return () => {
      isMounted = false;

      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [publicAccessToken, refreshKey, shouldPoll]);

  return { phase, order, error, refresh };
}
