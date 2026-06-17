import { StyleSheet, Text, View } from 'react-native';

import { PurchasePaidTicketCard } from '@/components/purchase/purchase-paid-ticket-card';
import type { PublicOrderTicket } from '@/lib/database.types';
import { text } from '@/theme';

type PurchasePaidTicketListProps = {
  eventName: string;
  tickets: PublicOrderTicket[];
};

export function PurchasePaidTicketList({ eventName, tickets }: PurchasePaidTicketListProps) {
  const ticketTotal = tickets.length;

  return (
    <View style={styles.root}>
      <Text style={styles.sectionTitle}>These are your tickets</Text>

      {tickets.map((ticket, index) => (
        <PurchasePaidTicketCard
          key={`${ticket.secure_token}-${index}`}
          eventName={eventName}
          ticket={ticket}
          ticketNumber={index + 1}
          ticketTotal={ticketTotal}
        />
      ))}

      <Text style={styles.footer}>
        Buying for friends? Share each ticket link with the right person.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 14,
  },
  sectionTitle: {
    color: text.primary,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  footer: {
    color: text.secondary,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 4,
  },
});
