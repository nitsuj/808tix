import { StyleSheet, Text, View } from 'react-native';

import {
  PurchasePaidTicketCard,
  type PurchasePaidTicketEventContext,
} from '@/components/purchase/purchase-paid-ticket-card';
import type { PublicOrderTicket } from '@/lib/database.types';
import { text } from '@/theme';

type PurchasePaidTicketListProps = PurchasePaidTicketEventContext & {
  tickets: PublicOrderTicket[];
};

export function PurchasePaidTicketList({
  tickets,
  eventName,
  venueName,
  eventDate,
  startTime,
  imageUrl,
}: PurchasePaidTicketListProps) {
  const ticketTotal = tickets.length;

  return (
    <View style={styles.root}>
      {tickets.map((ticket, index) => (
        <PurchasePaidTicketCard
          key={`${ticket.secure_token}-${index}`}
          eventDate={eventDate}
          eventName={eventName}
          imageUrl={imageUrl}
          startTime={startTime}
          ticket={ticket}
          ticketNumber={index + 1}
          ticketTotal={ticketTotal}
          venueName={venueName}
        />
      ))}

      {ticketTotal > 1 ? (
        <Text style={styles.footer}>
          Buying for friends? Share the individual ticket link from each ticket.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 20,
  },
  footer: {
    color: text.secondary,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 4,
  },
});
