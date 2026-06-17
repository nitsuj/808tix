import { Link, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PurchaseOrderStatus } from '@/components/purchase/purchase-order-status';
import { PurchasePaidTicketList } from '@/components/purchase/purchase-paid-ticket-list';
import { PurchaseScreenShell } from '@/components/purchase/purchase-screen-shell';
import type { GetOrderByPublicTokenResult } from '@/lib/database.types';
import { getOrderByPublicToken } from '@/lib/get-order-by-public-token';
import {
  buildEventBuyPath,
  buildPurchaseSuccessPathWithToken,
} from '@/lib/purchase-urls';
import { fan, text } from '@/theme';

export default function PurchaseCancelScreen() {
  const {
    order_token: orderTokenParam,
    event_id: eventIdParam,
    ticket_type_id: ticketTypeIdParam,
  } = useLocalSearchParams<{
    order_token?: string;
    event_id?: string;
    ticket_type_id?: string;
  }>();

  const orderToken = typeof orderTokenParam === 'string' ? orderTokenParam.trim() : '';
  const eventId = typeof eventIdParam === 'string' ? eventIdParam.trim() : '';
  const ticketTypeId = typeof ticketTypeIdParam === 'string' ? ticketTypeIdParam.trim() : '';

  const [order, setOrder] = useState<GetOrderByPublicTokenResult | null>(null);
  const [lookupDone, setLookupDone] = useState(!orderToken);
  const [lookupError, setLookupError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderToken) {
      return;
    }

    let isMounted = true;

    async function loadOrder() {
      try {
        const result = await getOrderByPublicToken(orderToken);

        if (!isMounted) {
          return;
        }

        setOrder(result);
        setLookupError(null);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        const message = error instanceof Error ? error.message : 'Could not load order status.';
        setLookupError(message);
        setOrder(null);
      } finally {
        if (isMounted) {
          setLookupDone(true);
        }
      }
    }

    void loadOrder();

    return () => {
      isMounted = false;
    };
  }, [orderToken]);

  const retryHref =
    eventId && ticketTypeId ? buildEventBuyPath(eventId, ticketTypeId) : null;

  if (orderToken && !lookupDone) {
    return (
      <PurchaseScreenShell>
        <PurchaseOrderStatus title="Checking checkout status…" loading />
      </PurchaseScreenShell>
    );
  }

  if (order?.status === 'paid' && Array.isArray(order.tickets) && order.tickets.length > 0) {
    return (
      <PurchaseScreenShell>
        <View style={styles.header}>
          <Text style={styles.confirmed}>Payment confirmed</Text>
          <Text style={styles.paidTitle}>Your tickets are ready</Text>
          <Text style={styles.helper}>Show each QR code at the door.</Text>
        </View>
        <PurchasePaidTicketList
          eventDate={order.event_date}
          eventName={order.event_name}
          imageUrl={order.image_url}
          startTime={order.start_time}
          tickets={order.tickets}
          venueName={order.venue_name}
        />
        <Link href={buildPurchaseSuccessPathWithToken(orderToken)} asChild>
          <Pressable style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
            <Text style={styles.secondaryText}>Open success page</Text>
          </Pressable>
        </Link>
      </PurchaseScreenShell>
    );
  }

  return (
    <PurchaseScreenShell>
      <PurchaseOrderStatus
        title="Checkout canceled"
        body={
          lookupError
            ? lookupError
            : 'No payment was made. Your tickets were not reserved.'
        }
      />

      {retryHref ? (
        <Link href={retryHref} asChild>
          <Pressable style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </Link>
      ) : null}
    </PurchaseScreenShell>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  confirmed: {
    color: '#7DFFB2',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  paidTitle: {
    color: fan.bright,
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
  },
  helper: {
    color: text.secondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  retryButton: {
    alignSelf: 'center',
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: fan.primary,
  },
  secondaryButton: {
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pressed: {
    opacity: 0.85,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryText: {
    color: text.secondary,
    fontSize: 14,
    fontWeight: '600',
  },
});
