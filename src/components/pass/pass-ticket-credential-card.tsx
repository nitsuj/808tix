import { StyleSheet, Text, View } from 'react-native';

import { PassQrCode } from '@/components/pass/pass-qr-code';
import { formatEventDateTimeTicketUpper } from '@/lib/event-datetime-display';
import { fan, organizer, palette, spacing, text } from '@/theme';

const QR_SIZE = 220;

const ELECTRIC = {
  magenta: '#FF2BD6',
} as const;

const CREDENTIAL = {
  surface: 'rgba(5, 5, 10, 0.92)',
  border: 'rgba(255, 43, 214, 0.38)',
  header: 'rgba(255, 43, 214, 0.12)',
  divider: 'rgba(255, 43, 214, 0.42)',
  chipBackground: 'rgba(255, 43, 214, 0.14)',
  chipBorder: 'rgba(255, 43, 214, 0.45)',
} as const;

const LAYOUT = {
  qrBorderRadius: 12,
  qrPad: 14,
  lanyardSlotWidth: 56,
  lanyardSlotHeight: 10,
} as const;

function formatPassTypeLabel(value: string): string {
  const trimmed = value.trim();
  return (trimmed || 'General Admission').toUpperCase();
}

export type PassTicketCredentialCardProps = {
  secureToken: string;
  eventName: string;
  venueName?: string | null;
  eventDate?: string | null;
  startTime?: string | null;
  passType: string;
  holderLabel: string;
  ticketNumberLabel?: string;
  entryInstruction?: string;
};

export function PassTicketCredentialCard({
  secureToken,
  eventName,
  venueName,
  eventDate,
  startTime,
  passType,
  holderLabel,
  ticketNumberLabel,
  entryInstruction = 'Show this QR code at the door.',
}: PassTicketCredentialCardProps) {
  const passTypeLabel = formatPassTypeLabel(passType);
  const dateTimeLine = formatEventDateTimeTicketUpper(eventDate, startTime);
  const venueLine = venueName?.trim().toUpperCase() ?? null;
  const eventTitle = eventName.trim().toUpperCase();
  const qrToken = secureToken.trim();

  return (
    <View style={styles.credentialCard}>
      <View style={styles.lanyardSlot} />

      <View style={styles.credentialHeader}>
        <Text style={styles.ticketBrandLabel}>808TICKETS</Text>
        {ticketNumberLabel ? (
          <Text style={styles.ticketNumberLabel}>{ticketNumberLabel}</Text>
        ) : null}
      </View>

      <View style={styles.eventBlock}>
        <Text style={styles.eventTitle}>{eventTitle}</Text>
        {dateTimeLine ? <Text style={styles.eventDateLine}>{dateTimeLine}</Text> : null}
        {venueLine ? <Text style={styles.eventVenueLine}>{venueLine}</Text> : null}
      </View>

      <View style={styles.credentialDivider} />

      <View style={styles.holderBlock}>
        <Text style={styles.fieldLabel}>Ticket holder</Text>
        <Text style={styles.holderName}>{holderLabel}</Text>
      </View>

      <View style={styles.ticketTypeRow}>
        <Text style={styles.ticketTypeLabel}>Ticket type</Text>
        <Text style={styles.ticketTypeValue}>{passTypeLabel}</Text>
      </View>

      <View style={styles.qrBlock}>
        {qrToken ? (
          <View style={styles.qrShell}>
            <View style={styles.qrContent}>
              <PassQrCode bare secureToken={qrToken} size={QR_SIZE} />
            </View>
          </View>
        ) : null}

        <Text style={styles.entryHelpText}>{entryInstruction}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  credentialCard: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: CREDENTIAL.surface,
    borderColor: CREDENTIAL.border,
    borderRadius: 24,
    borderWidth: 1,
    gap: spacing.three,
    overflow: 'visible',
    paddingBottom: spacing.four,
    paddingHorizontal: spacing.three,
    paddingTop: spacing.two,
    width: '100%',
  },
  lanyardSlot: {
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    borderColor: 'rgba(255, 43, 214, 0.35)',
    borderRadius: 6,
    borderWidth: 1,
    height: LAYOUT.lanyardSlotHeight,
    marginBottom: spacing.one,
    width: LAYOUT.lanyardSlotWidth,
  },
  credentialHeader: {
    alignItems: 'center',
    backgroundColor: CREDENTIAL.header,
    borderRadius: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.two,
    justifyContent: 'center',
    paddingHorizontal: spacing.two,
    paddingVertical: spacing.two,
    width: '100%',
  },
  ticketBrandLabel: {
    color: ELECTRIC.magenta,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
  },
  ticketNumberLabel: {
    color: fan.badgeText,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  eventBlock: {
    alignItems: 'center',
    gap: spacing.one,
    width: '100%',
  },
  eventTitle: {
    color: text.primary,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0.4,
    lineHeight: 28,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  eventDateLine: {
    color: fan.badgeText,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.1,
    lineHeight: 16,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  eventVenueLine: {
    color: text.secondary,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.6,
    lineHeight: 18,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  credentialDivider: {
    alignSelf: 'stretch',
    backgroundColor: CREDENTIAL.divider,
    height: 1,
    marginVertical: spacing.one,
  },
  holderBlock: {
    alignItems: 'center',
    gap: 4,
    width: '100%',
  },
  fieldLabel: {
    color: fan.badgeText,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  holderName: {
    color: text.primary,
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 26,
    textAlign: 'center',
  },
  ticketTypeRow: {
    alignItems: 'center',
    backgroundColor: CREDENTIAL.chipBackground,
    borderColor: CREDENTIAL.chipBorder,
    borderRadius: 12,
    borderWidth: 1,
    gap: 2,
    paddingHorizontal: spacing.three,
    paddingVertical: spacing.one + 2,
    width: '100%',
  },
  ticketTypeLabel: {
    color: fan.badgeText,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  ticketTypeValue: {
    color: ELECTRIC.magenta,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  qrBlock: {
    alignItems: 'center',
    gap: spacing.two,
    width: '100%',
  },
  qrShell: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderRadius: LAYOUT.qrBorderRadius,
    height: QR_SIZE + LAYOUT.qrPad * 2,
    justifyContent: 'center',
    overflow: 'hidden',
    width: QR_SIZE + LAYOUT.qrPad * 2,
  },
  qrContent: {
    alignItems: 'center',
    backgroundColor: palette.white,
    height: QR_SIZE,
    justifyContent: 'center',
    width: QR_SIZE,
  },
  entryHelpText: {
    color: organizer.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
});
