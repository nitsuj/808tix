import { Link, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PurchaseOrderStatus } from '@/components/purchase/purchase-order-status';
import { PurchaseScreenShell } from '@/components/purchase/purchase-screen-shell';
import { PurchaseTicketLinkList } from '@/components/purchase/purchase-ticket-link-list';
import { useOrderConfirmation } from '@/hooks/use-order-confirmation';
import { fan, text } from '@/theme';

export default function PurchaseSuccessScreen() {
  const { order_token: orderTokenParam } = useLocalSearchParams<{ order_token?: string }>();
  const orderToken = typeof orderTokenParam === 'string' ? orderTokenParam.trim() : '';

  if (!orderToken) {
    return (
      <PurchaseScreenShell>
        <PurchaseOrderStatus
          title="Missing order reference"
          body="Return to your checkout email or ask the event organizer for help."
        />
      </PurchaseScreenShell>
    );
  }

  return <PurchaseSuccessContent orderToken={orderToken} />;
}

function PurchaseSuccessContent({ orderToken }: { orderToken: string }) {
  const { phase, order, error, refresh } = useOrderConfirmation(orderToken, { poll: true });
  if (phase === 'loading' || phase === 'confirming') {
    return (
      <PurchaseScreenShell>
        <PurchaseOrderStatus
          title="Confirming payment…"
          body="Hang tight — we’re verifying your payment. This usually takes a few seconds."
          loading
        />
      </PurchaseScreenShell>
    );
  }

  if (phase === 'error') {
    return (
      <PurchaseScreenShell>
        <PurchaseOrderStatus
          title="Could not confirm payment"
          body={error ?? 'Please refresh this page in a moment.'}
        />
        <Pressable onPress={refresh} style={({ pressed }) => [styles.retryButton, pressed && styles.retryPressed]}>
          <Text style={styles.retryText}>Refresh</Text>
        </Pressable>
      </PurchaseScreenShell>
    );
  }

  if (phase === 'timeout') {
    return (
      <PurchaseScreenShell>
        <PurchaseOrderStatus
          title="Still processing"
          body="Your payment may still be completing. Refresh this page in a moment or check your email."
        />
        <Pressable onPress={refresh} style={({ pressed }) => [styles.retryButton, pressed && styles.retryPressed]}>
          <Text style={styles.retryText}>Refresh</Text>
        </Pressable>
      </PurchaseScreenShell>
    );
  }

  if (phase === 'paid' && order?.status === 'paid' && Array.isArray(order.tickets) && order.tickets.length > 0) {
    return (
      <PurchaseScreenShell>
        <View style={styles.header}>
          <Text style={styles.title}>You&apos;re in!</Text>
          <Text style={styles.subtitle}>
            {order.ticket_count} ticket{order.ticket_count === 1 ? '' : 's'} for {order.event_name}
          </Text>
        </View>
        <PurchaseTicketLinkList tickets={order.tickets} />
      </PurchaseScreenShell>
    );
  }

  return (
    <PurchaseScreenShell>
      <PurchaseOrderStatus
        title="Payment not completed"
        body="We couldn’t find paid tickets for this order yet. If you completed payment, refresh in a moment."
      />
      <Pressable onPress={refresh} style={({ pressed }) => [styles.retryButton, pressed && styles.retryPressed]}>
        <Text style={styles.retryText}>Refresh</Text>
      </Pressable>
      <Link href="/" asChild>
        <Pressable style={({ pressed }) => [styles.secondaryButton, pressed && styles.retryPressed]}>
          <Text style={styles.secondaryText}>Back to home</Text>
        </Pressable>
      </Link>
    </PurchaseScreenShell>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    color: fan.bright,
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: text.secondary,
    fontSize: 15,
    lineHeight: 22,
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
  retryPressed: {
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
