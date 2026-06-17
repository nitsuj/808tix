import { Link } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { shareTicketLink } from '@/components/purchase/purchase-ticket-share';
import type { PublicOrderTicket } from '@/lib/database.types';
import { copyToClipboard } from '@/lib/copy-to-clipboard';
import { getPassRoute, getPublicPassUrl } from '@/lib/pass-link';
import { fan, text } from '@/theme';

type PurchasePaidTicketCardProps = {
  ticket: PublicOrderTicket;
  eventName: string;
  ticketNumber: number;
  ticketTotal: number;
};

type SecondaryActionState = 'idle' | 'copied' | 'copy_failed' | 'share_copied';

export function PurchasePaidTicketCard({
  ticket,
  eventName,
  ticketNumber,
  ticketTotal,
}: PurchasePaidTicketCardProps) {
  const [copyState, setCopyState] = useState<SecondaryActionState>('idle');
  const [shareState, setShareState] = useState<SecondaryActionState>('idle');
  const [isSharing, setIsSharing] = useState(false);
  const copyResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shareResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const holderName = ticket.guest_name?.trim() || 'Guest ticket';
  const passType = ticket.pass_type?.trim() || 'General Admission';
  const ticketUrl = getPublicPassUrl(ticket.secure_token);

  const resetAfterDelay = useCallback(
    (setter: (value: SecondaryActionState) => void, timerRef: typeof copyResetTimer) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(() => {
        setter('idle');
        timerRef.current = null;
      }, 2000);
    },
    [],
  );

  useEffect(() => {
    return () => {
      if (copyResetTimer.current) {
        clearTimeout(copyResetTimer.current);
      }

      if (shareResetTimer.current) {
        clearTimeout(shareResetTimer.current);
      }
    };
  }, []);

  const handleCopyLink = useCallback(async () => {
    try {
      await copyToClipboard(ticketUrl);
      setCopyState('copied');
      resetAfterDelay(setCopyState, copyResetTimer);
    } catch {
      setCopyState('copy_failed');
      resetAfterDelay(setCopyState, copyResetTimer);
    }
  }, [resetAfterDelay, ticketUrl]);

  const handleShare = useCallback(async () => {
    setIsSharing(true);

    try {
      const result = await shareTicketLink(eventName, ticketUrl);

      if (result === 'copied') {
        setShareState('share_copied');
        resetAfterDelay(setShareState, shareResetTimer);
      } else if (result === 'failed') {
        setShareState('copy_failed');
        resetAfterDelay(setShareState, shareResetTimer);
      }
    } finally {
      setIsSharing(false);
    }
  }, [eventName, resetAfterDelay, ticketUrl]);

  const copyLabel =
    copyState === 'copied'
      ? 'Copied'
      : copyState === 'copy_failed'
        ? "Couldn't copy"
        : 'Copy link';

  const shareLabel =
    shareState === 'share_copied'
      ? 'Link copied'
      : shareState === 'copy_failed'
        ? "Couldn't share"
        : 'Share';

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <Text style={styles.ticketNumber}>
          Ticket {ticketNumber} of {ticketTotal}
        </Text>
      </View>

      <View style={styles.meta}>
        <Text style={styles.passType}>{passType}</Text>
        <Text style={styles.holderName}>{holderName}</Text>
        <Text style={styles.eventName}>{eventName}</Text>
      </View>

      <Link href={getPassRoute(ticket.secure_token)} asChild>
        <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}>
          <Text style={styles.primaryButtonText}>Open QR ticket</Text>
        </Pressable>
      </Link>

      <View style={styles.secondaryRow}>
        <Pressable
          accessibilityRole="button"
          onPress={() => void handleCopyLink()}
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}>
          <Text
            style={[
              styles.secondaryButtonText,
              copyState === 'copied' && styles.secondaryButtonTextSuccess,
              copyState === 'copy_failed' && styles.secondaryButtonTextError,
            ]}>
            {copyLabel}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          disabled={isSharing}
          onPress={() => void handleShare()}
          style={({ pressed }) => [
            styles.secondaryButton,
            (pressed || isSharing) && styles.buttonPressed,
            isSharing && styles.secondaryButtonDisabled,
          ]}>
          {isSharing ? (
            <ActivityIndicator color={fan.bright} size="small" />
          ) : (
            <Text
              style={[
                styles.secondaryButtonText,
                shareState === 'share_copied' && styles.secondaryButtonTextSuccess,
                shareState === 'copy_failed' && styles.secondaryButtonTextError,
              ]}>
              {shareLabel}
            </Text>
          )}
        </Pressable>
      </View>

      <Text style={styles.walletNote}>Open the ticket to add it to Apple Wallet.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: 'rgba(255, 43, 214, 0.38)',
    backgroundColor: 'rgba(5, 5, 10, 0.92)',
    borderRadius: 16,
    padding: 16,
    gap: 14,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ticketNumber: {
    color: fan.bright,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  meta: {
    gap: 6,
  },
  passType: {
    color: text.secondary,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  holderName: {
    color: text.primary,
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
  },
  eventName: {
    color: text.secondary,
    fontSize: 14,
    lineHeight: 20,
  },
  primaryButton: {
    alignSelf: 'stretch',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: fan.primary,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  secondaryButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 43, 214, 0.35)',
    backgroundColor: 'rgba(255, 43, 214, 0.08)',
    paddingHorizontal: 14,
    paddingVertical: 9,
    minWidth: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonDisabled: {
    opacity: 0.7,
  },
  secondaryButtonText: {
    color: fan.bright,
    fontSize: 13,
    fontWeight: '700',
  },
  secondaryButtonTextSuccess: {
    color: '#7DFFB2',
  },
  secondaryButtonTextError: {
    color: '#FF8FA8',
  },
  buttonPressed: {
    opacity: 0.86,
  },
  walletNote: {
    color: text.secondary,
    fontSize: 12,
    lineHeight: 17,
  },
});
