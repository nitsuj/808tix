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
import {
  calculateOrderFees,
  PROCESSING_FEE_LABEL,
  SERVICE_FEE_LABEL,
} from '@/lib/ticket-fees';
import { formatTicketPriceLabel } from '@/lib/ticket-type-price';
import { fan, text } from '@/theme';

const DEFAULT_MAX_QUANTITY = 10;

type PurchasePagePhase =
  | 'loading'
  | 'ready'
  | 'submitting'
  | 'redirecting'
  | 'error';

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

function isTicketTypeSoldOut(ticketType: PublicEventPurchaseTicketType): boolean {
  return resolveMaxQuantity(ticketType.quantity_available) === 0;
}

function pickInitialTicketType(
  ticketTypes: PublicEventPurchaseTicketType[],
  preferredTicketTypeId: string,
): PublicEventPurchaseTicketType | null {
  if (preferredTicketTypeId && isUuidLike(preferredTicketTypeId)) {
    const preferred = ticketTypes.find((ticketType) =>
      ticketType.id.toLowerCase() === preferredTicketTypeId.trim().toLowerCase(),
    );

    if (preferred && !isTicketTypeSoldOut(preferred)) {
      return preferred;
    }
  }

  return ticketTypes.find((ticketType) => !isTicketTypeSoldOut(ticketType)) ?? null;
}

function remainingLabel(ticketType: PublicEventPurchaseTicketType): string | null {
  if (ticketType.quantity_available === null) {
    return null;
  }

  if (ticketType.quantity_available <= 0) {
    return 'Sold out';
  }

  return `${ticketType.quantity_available} remaining`;
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

  return <EventBuyContent key={eventId} eventId={eventId} preferredTicketTypeId={ticketTypeId} />;
}

function EventBuyContent({
  eventId,
  preferredTicketTypeId,
}: {
  eventId: string;
  preferredTicketTypeId: string;
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
          ticketTypeId: preferredTicketTypeId,
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
          ticketTypeId: preferredTicketTypeId,
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
          ticketTypeId: preferredTicketTypeId,
          returnedTicketTypeIds,
          unavailableReason: 'no_ticket_types',
        });
        setUnavailableReason('no_ticket_types');
        setPhase('error');
        return;
      }

      const selected = pickInitialTicketType(parsedOptions.ticket_types, preferredTicketTypeId);

      if (!selected) {
        const preferred =
          preferredTicketTypeId && isUuidLike(preferredTicketTypeId)
            ? findPurchaseTicketType(parsedOptions, preferredTicketTypeId)
            : null;

        if (preferred && isTicketTypeSoldOut(preferred)) {
          logPurchaseOptionsDiagnostics({
            eventId,
            ticketTypeId: preferredTicketTypeId,
            returnedTicketTypeIds,
            unavailableReason: 'sold_out',
          });
          setUnavailableReason('sold_out');
          setPhase('error');
          return;
        }

        logPurchaseOptionsDiagnostics({
          eventId,
          ticketTypeId: preferredTicketTypeId,
          returnedTicketTypeIds,
          unavailableReason: 'sold_out',
        });
        setUnavailableReason('sold_out');
        setPhase('error');
        return;
      }

      logPurchaseOptionsDiagnostics({
        eventId,
        ticketTypeId: selected.id,
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
  }, [eventId, preferredTicketTypeId]);

  const maxQuantity = useMemo(
    () => resolveMaxQuantity(selectedTicketType?.quantity_available ?? null),
    [selectedTicketType],
  );

  const pricing = useMemo(() => {
    if (!options || !selectedTicketType) {
      return null;
    }

    const subtotalCents = selectedTicketType.price_cents * quantity;
    const fees = calculateOrderFees({
      subtotalCents,
      quantity,
      platformFeeBps: options.event.platform_fee_bps,
      platformFeeFixedCents: options.event.platform_fee_fixed_cents,
      processingFeeBps: options.event.processing_fee_bps ?? 290,
      processingFeeFixedCents: options.event.processing_fee_fixed_cents ?? 30,
    });

    return {
      subtotalCents: fees.subtotalCents,
      platformFeeCents: fees.platformFeeCents,
      processingFeeCents: fees.processingFeeCents,
      totalCents: fees.totalCents,
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

  const handleSelectTicketType = useCallback((ticketType: PublicEventPurchaseTicketType) => {
    if (isTicketTypeSoldOut(ticketType)) {
      return;
    }

    setSelectedTicketType(ticketType);
    setQuantity(1);
    setErrorMessage(null);
    if (phase === 'error') {
      setPhase('ready');
      setUnavailableReason(null);
    }
  }, [phase]);

  const handleCheckout = useCallback(async () => {
    if (!options || !selectedTicketType || !canSubmit) {
      return;
    }

    setPhase('submitting');
    setErrorMessage(null);

    try {
      // Redirect URLs are built server-side (PUBLIC_SITE_URL allowlist). Client no longer
      // supplies success_url/cancel_url or receives order_public_access_token pre-payment.
      const result = await startCheckoutSession({
        eventId,
        ticketTypeId: selectedTicketType.id,
        quantity,
        buyerEmail,
        buyerName: buyerName.trim() || null,
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

  if (phase === 'error' && !options) {
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
      ticketTypeId: preferredTicketTypeId,
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
        <Text style={styles.sectionLabel}>Ticket type</Text>
        <View style={styles.ticketTypeList} testID="buy-ticket-type-list">
          {options.ticket_types.map((ticketType) => {
            const soldOut = isTicketTypeSoldOut(ticketType);
            const selected = selectedTicketType.id === ticketType.id;
            const remaining = remainingLabel(ticketType);
            const priceLabel = formatTicketPriceLabel(
              ticketType.price_cents,
              ticketType.currency || options.event.currency,
            );

            return (
              <Pressable
                key={ticketType.id}
                accessibilityRole="button"
                accessibilityState={{ disabled: soldOut, selected }}
                disabled={soldOut || isBusy}
                onPress={() => handleSelectTicketType(ticketType)}
                style={({ pressed }) => [
                  styles.ticketTypeRow,
                  selected && styles.ticketTypeRowSelected,
                  soldOut && styles.ticketTypeRowSoldOut,
                  pressed && !soldOut && styles.ticketTypeRowPressed,
                ]}
                testID={`buy-ticket-type-${ticketType.id}`}>
                <View style={styles.ticketTypeRowText}>
                  <Text style={styles.ticketTypeName}>{ticketType.name}</Text>
                  {remaining ? (
                    <Text style={[styles.ticketTypeMeta, soldOut && styles.soldOutText]}>
                      {remaining}
                    </Text>
                  ) : null}
                </View>
                <Text style={[styles.ticketTypePrice, soldOut && styles.soldOutText]}>
                  {priceLabel}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {selectedTicketType.description ? (
          <Text style={styles.ticketDescription}>{selectedTicketType.description}</Text>
        ) : null}

        <PurchaseQuantityStepper
          disabled={isBusy}
          max={maxQuantity}
          onChange={setQuantity}
          testID="buy-quantity-stepper"
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
            {formatTicketPriceLabel(pricing.subtotalCents, pricing.currency)}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>{SERVICE_FEE_LABEL}</Text>
          <Text style={styles.summaryValue}>
            {formatTicketPriceLabel(pricing.platformFeeCents, pricing.currency)}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>{PROCESSING_FEE_LABEL}</Text>
          <Text style={styles.summaryValue}>
            {formatTicketPriceLabel(pricing.processingFeeCents, pricing.currency)}
          </Text>
        </View>
        <View style={[styles.summaryRow, styles.summaryTotalRow]}>
          <Text style={styles.summaryTotalLabel}>Total</Text>
          <Text style={styles.summaryTotalValue}>
            {formatTicketPriceLabel(pricing.totalCents, pricing.currency)}
          </Text>
        </View>
        <Text style={styles.stripeNote}>
          Final payment is completed securely by Stripe. Fees are shown separately before you pay.
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
        ]}
        testID="buy-checkout-cta">
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
  sectionLabel: {
    color: text.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  ticketTypeList: {
    gap: 10,
  },
  ticketTypeRow: {
    alignItems: 'center',
    borderColor: 'rgba(255, 43, 214, 0.28)',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  ticketTypeRowSelected: {
    backgroundColor: 'rgba(255, 43, 214, 0.14)',
    borderColor: fan.bright,
  },
  ticketTypeRowSoldOut: {
    opacity: 0.45,
  },
  ticketTypeRowPressed: {
    opacity: 0.85,
  },
  ticketTypeRowText: {
    flex: 1,
    gap: 2,
  },
  ticketTypeName: {
    color: text.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  ticketTypeMeta: {
    color: text.secondary,
    fontSize: 12,
    lineHeight: 16,
  },
  ticketTypePrice: {
    color: fan.bright,
    fontSize: 15,
    fontWeight: '700',
  },
  soldOutText: {
    color: text.secondary,
  },
  ticketDescription: {
    color: text.secondary,
    fontSize: 14,
    lineHeight: 20,
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
