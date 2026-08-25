import { StyleSheet, Text, View } from 'react-native';

import { formatTicketPriceLabel } from '@/lib/ticket-type-price';
import { PROCESSING_FEE_LABEL, SERVICE_FEE_LABEL } from '@/lib/ticket-fees';
import { fan, text } from '@/theme';

type PurchaseFeeSummaryProps = {
  currency: string;
  subtotalCents: number;
  platformFeeCents: number;
  processingFeeCents: number;
  totalCents: number;
};

export function PurchaseFeeSummary({
  currency,
  subtotalCents,
  platformFeeCents,
  processingFeeCents,
  totalCents,
}: PurchaseFeeSummaryProps) {
  return (
    <View style={styles.card} testID="purchase-fee-summary">
      <View style={styles.row}>
        <Text style={styles.label}>Subtotal</Text>
        <Text style={styles.value}>{formatTicketPriceLabel(subtotalCents, currency)}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>{SERVICE_FEE_LABEL}</Text>
        <Text style={styles.value}>{formatTicketPriceLabel(platformFeeCents, currency)}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>{PROCESSING_FEE_LABEL}</Text>
        <Text style={styles.value}>{formatTicketPriceLabel(processingFeeCents, currency)}</Text>
      </View>
      <View style={[styles.row, styles.totalRow]}>
        <Text style={styles.totalLabel}>Total paid</Text>
        <Text style={styles.totalValue}>{formatTicketPriceLabel(totalCents, currency)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  label: {
    color: text.secondary,
    fontSize: 13,
    flex: 1,
  },
  value: {
    color: text.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  totalRow: {
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.14)',
  },
  totalLabel: {
    color: fan.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  totalValue: {
    color: fan.primary,
    fontSize: 14,
    fontWeight: '700',
  },
});
