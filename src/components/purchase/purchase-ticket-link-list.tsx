import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { PublicOrderTicket } from '@/lib/database.types';
import { getPassRoute } from '@/lib/pass-link';
import { fan, text } from '@/theme';

type PurchaseTicketLinkListProps = {
  tickets: PublicOrderTicket[];
};

export function PurchaseTicketLinkList({ tickets }: PurchaseTicketLinkListProps) {
  return (
    <View style={styles.root}>
      {tickets.map((ticket, index) => (
        <View key={`${ticket.secure_token}-${index}`} style={styles.card}>
          <View style={styles.meta}>
            <Text style={styles.passType}>{ticket.pass_type}</Text>
            <Text style={styles.guestName}>{ticket.guest_name}</Text>
          </View>
          <Link href={getPassRoute(ticket.secure_token)} asChild>
            <Pressable style={({ pressed }) => [styles.linkButton, pressed && styles.linkPressed]}>
              <Text style={styles.linkText}>View ticket</Text>
            </Pressable>
          </Link>
        </View>
      ))}
      <Text style={styles.footer}>Show your QR code at the door. Save these links.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 12,
  },
  card: {
    borderWidth: 1,
    borderColor: 'rgba(255, 43, 214, 0.38)',
    backgroundColor: 'rgba(5, 5, 10, 0.92)',
    borderRadius: 14,
    padding: 16,
    gap: 14,
  },
  meta: {
    gap: 4,
  },
  passType: {
    color: fan.bright,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  guestName: {
    color: text.primary,
    fontSize: 18,
    fontWeight: '600',
  },
  linkButton: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: fan.primary,
  },
  linkPressed: {
    opacity: 0.85,
  },
  linkText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  footer: {
    color: text.secondary,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 8,
  },
});
