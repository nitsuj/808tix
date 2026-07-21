import { Image } from 'expo-image';
import { Link, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  fetchPublicUpcomingEvents,
  type PublicUpcomingEvent,
} from '@/lib/list-public-upcoming-events';
import { formatEventDateTimeLong } from '@/lib/event-datetime-display';
import { formatTicketPriceLabel } from '@/lib/ticket-type-price';
import { fan, spacing, text } from '@/theme';

function EventCard({ event }: { event: PublicUpcomingEvent }) {
  const dateLine = formatEventDateTimeLong(event.event_date, event.start_time);
  const priceLabel = formatTicketPriceLabel(event.starting_price_cents, event.currency);
  const startingLabel = priceLabel === 'Free' ? 'Free' : `From ${priceLabel}`;
  const buyHref = `/events/${event.id}/buy` as Href;

  return (
    <View style={styles.card} testID={`public-event-card-${event.id}`}>
      {event.image_url ? (
        <Image contentFit="cover" source={{ uri: event.image_url }} style={styles.artwork} />
      ) : (
        <View style={styles.artworkPlaceholder}>
          <Text style={styles.artworkPlaceholderText}>808</Text>
        </View>
      )}
      <View style={styles.cardBody}>
        <Text style={styles.eventName}>{event.name}</Text>
        {dateLine ? <Text style={styles.meta}>{dateLine}</Text> : null}
        {event.venue_name ? <Text style={styles.meta}>{event.venue_name}</Text> : null}
        <Text style={styles.price}>{startingLabel}</Text>
        <Link href={buyHref} asChild>
          <Pressable
            accessibilityRole="link"
            style={styles.cta}
            testID={`public-event-get-tickets-${event.id}`}>
            <Text style={styles.ctaText}>Get Tickets</Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}

export function PublicUpcomingEventsSection() {
  const [events, setEvents] = useState<PublicUpcomingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      const result = await fetchPublicUpcomingEvents();
      if (!mounted) {
        return;
      }
      setEvents(result.events);
      setError(result.error);
      setLoading(false);
    }

    const frame = requestAnimationFrame(() => {
      void load();
    });

    return () => {
      mounted = false;
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <View style={styles.section} testID="public-upcoming-events">
      <Text style={styles.eyebrow}>UPCOMING EVENTS</Text>
      <Text style={styles.title}>Browse Events</Text>
      <Text style={styles.subtitle}>Find a show and get tickets — no account required.</Text>

      {loading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator color={fan.primary} />
        </View>
      ) : null}

      {!loading && error ? (
        <View style={styles.emptyState} testID="public-events-error">
          <Text style={styles.emptyTitle}>Couldn’t load events</Text>
          <Text style={styles.emptyBody}>Refresh the page and try again.</Text>
        </View>
      ) : null}

      {!loading && !error && events.length === 0 ? (
        <View style={styles.emptyState} testID="public-events-empty">
          <Text style={styles.emptyTitle}>No upcoming events yet</Text>
          <Text style={styles.emptyBody}>
            Check back soon, or create an event if you’re an organizer.
          </Text>
        </View>
      ) : null}

      {!loading && !error && events.length > 0 ? (
        <View style={styles.list}>
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.three,
    width: '100%',
  },
  eyebrow: {
    color: fan.bright,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    textAlign: 'center',
  },
  title: {
    color: text.primary,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  subtitle: {
    color: text.secondary,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: spacing.two,
    textAlign: 'center',
  },
  list: {
    gap: spacing.four,
  },
  card: {
    backgroundColor: 'rgba(8, 6, 16, 0.92)',
    borderColor: 'rgba(255, 43, 214, 0.28)',
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  artwork: {
    height: 160,
    width: '100%',
  },
  artworkPlaceholder: {
    alignItems: 'center',
    backgroundColor: 'rgba(162, 91, 255, 0.18)',
    height: 120,
    justifyContent: 'center',
    width: '100%',
  },
  artworkPlaceholderText: {
    color: fan.badgeText,
    fontSize: 28,
    fontWeight: '800',
  },
  cardBody: {
    gap: spacing.two,
    padding: spacing.four,
  },
  eventName: {
    color: text.primary,
    fontSize: 20,
    fontWeight: '700',
  },
  meta: {
    color: text.secondary,
    fontSize: 14,
    lineHeight: 20,
  },
  price: {
    color: fan.bright,
    fontSize: 15,
    fontWeight: '700',
    marginTop: spacing.one,
  },
  cta: {
    alignItems: 'center',
    backgroundColor: fan.primary,
    borderRadius: 999,
    marginTop: spacing.two,
    minHeight: 48,
    justifyContent: 'center',
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    backgroundColor: 'rgba(8, 6, 16, 0.72)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 16,
    borderWidth: 1,
    gap: spacing.two,
    paddingHorizontal: spacing.four,
    paddingVertical: spacing.five,
  },
  emptyTitle: {
    color: text.primary,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyBody: {
    color: text.secondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
