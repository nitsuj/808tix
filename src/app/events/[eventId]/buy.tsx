import * as Linking from 'expo-linking';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { PurchaseBuyerForm } from '@/components/purchase/purchase-buyer-form';
import { PurchaseOrderStatus } from '@/components/purchase/purchase-order-status';
import { PurchaseQuantityStepper } from '@/components/purchase/purchase-quantity-stepper';
import { PurchaseScreenShell } from '@/components/purchase/purchase-screen-shell';
import type {
  GetPublicEventPurchaseOptionsResult,
  PublicEventPurchaseTicketType,
} from '@/lib/database.types';
import { startCheckoutSession } from '@/lib/create-checkout-session';
import { formatEventDateTimeLong } from '@/lib/event-datetime-display';
import {
  fetchPublicEventPurchaseOptions,
  findPurchaseTicketType,
  logPurchaseOptionsDiagnostics,
  normalizeRouteParam,
  type PurchaseUnavailableReason,
} from '@/lib/get-public-purchase-options';
import { buildPurchaseCancelUrl, buildPurchaseSuccessUrl } from '@/lib/purchase-urls';
import { fan, text } from '@/theme';

const DEFAULT_MAX_QUANTITY = 10;

type PurchasePagePhase =
  | 'loading'
  | 'ready'
  | 'submitting'
  | 'redirecting'
  | 'error';

function formatMoneyFromCents(cents: number, currency = 'usd'): string {
  const amount = cents / 100;

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

function estimatePlatformFeeCents(
  subtotalCents: number,
  platformFeeBps: number,
  platformFeeFixedCents: number,
): number {
  return Math.round((subtotalCents * platformFeeBps) / 10000) + platformFeeFixedCents;
}

function isValidEmail(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length > 3 && trimmed.includes('@') && trimmed.includes('.');
}

function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim());
}

function resolveMaxQuantity(quantityAvailable: number | null): number {
  if (quantityAvailable === null) {
    return DEFAULT_MAX_QUANTITY;
  }

  if (quantityAvailable <= 0) {
    return 0;
  }

  return quantityAvailable;
}

function unavailableCopy(reason: PurchaseUnavailableReason): { title: string; body: string } {
  switch (reason) {
    case 'invalid_event_id':
    case 'invalid_ticket_type_id':
      return {
        title: 'Invalid ticket link.',
        body: 'Check the link from the event organizer.',
      };
    case 'rpc_null':
      return {
        title: 'Tickets aren’t available right now.',
        body: 'Ticket sales may be closed for this event.',
      };
    case 'rpc_error':
      return {
        title: 'Could not load tickets.',
        body: 'Please refresh and try again.',
      };
    case 'no_ticket_types':
      return {
        title: 'No tickets are available for this event.',
        body: 'Check back later or contact the organizer.',
      };
    case 'ticket_type_not_found':
      return {
        title: 'This ticket link is no longer available.',
        body: 'The ticket type may have sold out or been removed.',
      };
    case 'sold_out':
      return {
        title: 'This ticket type is sold out.',
        body: 'There are no tickets available for this option right now.',
      };
  }
}

function redirectToCheckout(checkoutUrl: string): void {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.location.assign(checkoutUrl);
    return;
  }

  void Linking.openURL(checkoutUrl);
}

export default function EventBuyScreen() {
  const params = useLocalSearchParams<{
    eventId?: string | string[];
    ticket_type_id?: string | string[];
  }>();

  const eventId = normalizeRouteParam(params.eventId);
  const ticketTypeId = normalizeRouteParam(params.ticket_type_id);

  if (!eventId || !isUuidLike(eventId)) {
    logPurchaseOptionsDiagnostics({
      eventId,
      ticketTypeId,
      unavailableReason: 'invalid_event_id',
    });

    const copy = unavailableCopy('invalid_event_id');
    return (
      <PurchaseScreenShell>
        <PurchaseOrderStatus title={copy.title} body={copy.body} />
      </PurchaseScreenShell>
    );
  }

  if (!ticketTypeId || !isUuidLike(ticketTypeId)) {
    logPurchaseOptionsDiagnostics({
      eventId,
      ticketTypeId,
      unavailableReason: 'invalid_ticket_type_id',
    });

    const copy = unavailableCopy('invalid_ticket_type_id');
    return (
      <PurchaseScreenShell>
        <PurchaseOrderStatus title={copy.title} body={copy.body} />
      </PurchaseScreenShell>
    );
  }

  return (
    <EventBuyContent
      key={`${eventId}:${ticketTypeId}`}
      eventId={eventId}
      ticketTypeId={ticketTypeId}
    />
  );
}

function EventBuyContent({
  eventId,
  ticketTypeId,
}: {
  eventId: string;
  ticketTypeId: string;
}) {
  const [options, setOptions] = useState<GetPublicEventPurchaseOptionsResult | null>(null);
  const [selectedTicketType, setSelectedTicketType] =
    useState<PublicEventPurchaseTicketType | null>(null);
  const [phase, setPhase] = useState<PurchasePagePhase>('loading');
  const [unavailableReason, setUnavailableReason] = useState<PurchaseUnavailableReason | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [buyerEmail, setBuyerEmail] = useState('');
  const [buyerName, setBuyerName] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadOptions() {
      setErrorMessage(null);
      setUnavailableReason(null);
      setSelectedTicketType(null);
      setPhase('loading');

      const { options: parsedOptions, error } = await fetchPublicEventPurchaseOptions(eventId);

      if (!isMounted) {
        return;
      }

      if (error) {
        logPurchaseOptionsDiagnostics({
          eventId,
          ticketTypeId,
          rpcError: error,
          unavailableReason: 'rpc_error',
        });
        setOptions(null);
        setUnavailableReason('rpc_error');
        setErrorMessage(error);
        setPhase('error');
        return;
      }

      if (!parsedOptions) {
        logPurchaseOptionsDiagnostics({
          eventId,
          ticketTypeId,
          dataIsNull: true,
          unavailableReason: 'rpc_null',
        });
        setOptions(null);
        setUnavailableReason('rpc_null');
        setPhase('error');
        return;
      }

      setOptions(parsedOptions);

      const returnedTicketTypeIds = parsedOptions.ticket_types.map((ticketType) => ticketType.id);

      if (parsedOptions.ticket_types.length === 0) {
        logPurchaseOptionsDiagnostics({
          eventId,
          ticketTypeId,
          returnedTicketTypeIds,
          unavailableReason: 'no_ticket_types',
        });
        setUnavailableReason('no_ticket_types');
        setPhase('error');
        return;
      }

      const selected = findPurchaseTicketType(parsedOptions, ticketTypeId);

      if (!selected) {
        logPurchaseOptionsDiagnostics({
          eventId,
          ticketTypeId,
          returnedTicketTypeIds,
          unavailableReason: 'ticket_type_not_found',
        });
        setUnavailableReason('ticket_type_not_found');
        setPhase('error');
        return;
      }

      const maxQuantity = resolveMaxQuantity(selected.quantity_available);

      if (maxQuantity === 0) {
        logPurchaseOptionsDiagnostics({
          eventId,
          ticketTypeId,
          returnedTicketTypeIds,
          unavailableReason: 'sold_out',
        });
        setUnavailableReason('sold_out');
        setPhase('error');
        return;
      }

      logPurchaseOptionsDiagnostics({
        eventId,
        ticketTypeId,
        returnedTicketTypeIds,
        unavailableReason: 'ready',
      });

      setSelectedTicketType(selected);
      setQuantity(1);
      setPhase('ready');
    }

    void loadOptions();

    return () => {
      isMounted = false;
    };
  }, [eventId, ticketTypeId]);

  const maxQuantity = useMemo(
    () => resolveMaxQuantity(selectedTicketType?.quantity_available ?? null),
    [selectedTicketType],
  );

  const pricing = useMemo(() => {
    if (!options || !selectedTicketType) {
      return null;
    }

    const subtotalCents = selectedTicketType.price_cents * quantity;
    const platformFeeCents = estimatePlatformFeeCents(
      subtotalCents,
      options.event.platform_fee_bps,
      options.event.platform_fee_fixed_cents,
    );

    return {
      subtotalCents,
      platformFeeCents,
      totalCents: subtotalCents + platformFeeCents,
      currency: selectedTicketType.currency || options.event.currency,
    };
  }, [options, quantity, selectedTicketType]);

  const dateTimeLine = useMemo(() => {
    if (!options) {
      return null;
    }

    return formatEventDateTimeLong(options.event.event_date, options.event.start_time);
  }, [options]);

  const canSubmit =
    phase === 'ready' &&
    isValidEmail(buyerEmail) &&
    quantity >= 1 &&
    quantity <= maxQuantity &&
    maxQuantity > 0 &&
    Boolean(options && selectedTicketType && pricing);

  const handleCheckout = useCallback(async () => {
    if (!options || !selectedTicketType || !canSubmit) {
      return;
    }

    setPhase('submitting');
    setErrorMessage(null);

    try {
      const cancelUrl = new URL(buildPurchaseCancelUrl());
      cancelUrl.searchParams.set('event_id', eventId);
      cancelUrl.searchParams.set('ticket_type_id', selectedTicketType.id);

      const result = await startCheckoutSession({
        eventId,
        ticketTypeId: selectedTicketType.id,
        quantity,
        buyerEmail,
        buyerName: buyerName.trim() || null,
        successUrl: buildPurchaseSuccessUrl(),
        cancelUrl: cancelUrl.toString(),
      });

      setPhase('redirecting');
      redirectToCheckout(result.checkoutUrl);
    } catch (checkoutError) {
      const message =
        checkoutError instanceof Error
          ? checkoutError.message
          : 'Checkout could not be started. Please try again.';
      setErrorMessage(message);
      setPhase('error');
      setUnavailableReason(null);
    }
  }, [
    buyerEmail,
    buyerName,
    canSubmit,
    eventId,
    options,
    quantity,
    selectedTicketType,
  ]);

  if (phase === 'loading') {
    return (
      <PurchaseScreenShell>
        <PurchaseOrderStatus title="Loading tickets…" loading />
      </PurchaseScreenShell>
    );
  }

  if (phase === 'error' && unavailableReason) {
    const copy = unavailableCopy(unavailableReason);
    return (
      <PurchaseScreenShell>
        <PurchaseOrderStatus
          title={copy.title}
          body={errorMessage && unavailableReason === 'rpc_error' ? errorMessage : copy.body}
        />
      </PurchaseScreenShell>
    );
  }

  if (phase === 'error') {
    return (
      <PurchaseScreenShell>
        <PurchaseOrderStatus
          title="Could not load tickets."
          body={errorMessage ?? 'Please refresh and try again.'}
        />
      </PurchaseScreenShell>
    );
  }

  if (!options || !selectedTicketType || !pricing) {
    logPurchaseOptionsDiagnostics({
      eventId,
      ticketTypeId,
      unavailableReason: 'rpc_error',
      returnedTicketTypeIds: options?.ticket_types.map((ticketType) => ticketType.id),
    });

    return (
      <PurchaseScreenShell>
        <PurchaseOrderStatus
          title="Could not load tickets."
          body="Please refresh and try again."
        />
      </PurchaseScreenShell>
    );
  }

  const isBusy = phase === 'submitting' || phase === 'redirecting';

  return (
    <PurchaseScreenShell>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Get tickets</Text>
        <Text style={styles.eventName}>{options.event.name}</Text>
        {options.event.venue_name ? (
          <Text style={styles.metaLine}>{options.event.venue_name}</Text>
        ) : null}
        {dateTimeLine ? <Text style={styles.metaLine}>{dateTimeLine}</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.ticketType}>{selectedTicketType.name}</Text>
        {selectedTicketType.description ? (
          <Text style={styles.ticketDescription}>{selectedTicketType.description}</Text>
        ) : null}
        <Text style={styles.unitPrice}>
          {formatMoneyFromCents(selectedTicketType.price_cents, pricing.currency)} each
        </Text>

        <PurchaseQuantityStepper
          disabled={isBusy}
          max={maxQuantity}
          onChange={setQuantity}
          value={quantity}
        />

        <PurchaseBuyerForm
          disabled={isBusy}
          email={buyerEmail}
          name={buyerName}
          onEmailChange={setBuyerEmail}
          onNameChange={setBuyerName}
        />
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Subtotal</Text>
          <Text style={styles.summaryValue}>
            {formatMoneyFromCents(pricing.subtotalCents, pricing.currency)}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Service fee (est.)</Text>
          <Text style={styles.summaryValue}>
            {formatMoneyFromCents(pricing.platformFeeCents, pricing.currency)}
          </Text>
        </View>
        <View style={[styles.summaryRow, styles.summaryTotalRow]}>
          <Text style={styles.summaryTotalLabel}>Total (est.)</Text>
          <Text style={styles.summaryTotalValue}>
            {formatMoneyFromCents(pricing.totalCents, pricing.currency)}
          </Text>
        </View>
        <Text style={styles.stripeNote}>
          Final payment is completed securely by Stripe. Your total is confirmed at checkout.
        </Text>
      </View>

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      <Pressable
        accessibilityRole="button"
        disabled={!canSubmit || isBusy}
        onPress={() => void handleCheckout()}
        style={({ pressed }) => [
          styles.cta,
          (!canSubmit || isBusy) && styles.ctaDisabled,
          pressed && canSubmit && !isBusy && styles.ctaPressed,
        ]}>
        {isBusy ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.ctaText}>
            {phase === 'redirecting' ? 'Redirecting to secure payment…' : 'Continue to payment'}
          </Text>
        )}
      </Pressable>
    </PurchaseScreenShell>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 8,
  },
  eyebrow: {
    color: fan.bright,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  eventName: {
    color: text.primary,
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 32,
  },
  metaLine: {
    color: text.secondary,
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    borderWidth: 1,
    borderColor: 'rgba(255, 43, 214, 0.38)',
    backgroundColor: 'rgba(5, 5, 10, 0.92)',
    borderRadius: 16,
    padding: 18,
    gap: 18,
  },
  ticketType: {
    color: text.primary,
    fontSize: 20,
    fontWeight: '700',
  },
  ticketDescription: {
    color: text.secondary,
    fontSize: 14,
    lineHeight: 20,
  },
  unitPrice: {
    color: fan.bright,
    fontSize: 16,
    fontWeight: '600',
  },
  summaryCard: {
    borderWidth: 1,
    borderColor: 'rgba(255, 43, 214, 0.22)',
    borderRadius: 14,
    padding: 16,
    gap: 10,
    backgroundColor: 'rgba(42, 16, 64, 0.18)',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  summaryLabel: {
    color: text.secondary,
    fontSize: 14,
  },
  summaryValue: {
    color: text.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  summaryTotalRow: {
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 43, 214, 0.22)',
  },
  summaryTotalLabel: {
    color: text.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  summaryTotalValue: {
    color: fan.bright,
    fontSize: 18,
    fontWeight: '700',
  },
  stripeNote: {
    color: text.secondary,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  errorText: {
    color: '#FF6B8A',
    fontSize: 14,
    lineHeight: 20,
  },
  cta: {
    minHeight: 52,
    borderRadius: 999,
    backgroundColor: fan.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  ctaDisabled: {
    opacity: 0.45,
  },
  ctaPressed: {
    opacity: 0.88,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
