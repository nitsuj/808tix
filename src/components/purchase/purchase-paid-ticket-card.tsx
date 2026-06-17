import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { PassTicketCredentialCard } from '@/components/pass/pass-ticket-credential-card';
import { shareTicketLink } from '@/components/purchase/purchase-ticket-share';
import type { PublicOrderTicket } from '@/lib/database.types';
import { copyToClipboard } from '@/lib/copy-to-clipboard';
import { resolvePassArtworkUri } from '@/lib/event-artwork-display';
import { resolveEventArtworkPublicUrl } from '@/lib/event-artwork-storage';
import { getPassRoute, getPublicPassUrl } from '@/lib/pass-link';
import { fan, text } from '@/theme';

export type PurchasePaidTicketEventContext = {
  eventName: string;
  venueName?: string | null;
  eventDate?: string | null;
  startTime?: string | null;
  imageUrl?: string | null;
};

type PurchasePaidTicketCardProps = PurchasePaidTicketEventContext & {
  ticket: PublicOrderTicket;
  ticketNumber: number;
  ticketTotal: number;
};

type SecondaryActionState = 'idle' | 'copied' | 'copy_failed' | 'share_copied';

export function PurchasePaidTicketCard({
  ticket,
  eventName,
  venueName,
  eventDate,
  startTime,
  imageUrl,
  ticketNumber,
  ticketTotal,
}: PurchasePaidTicketCardProps) {
  const [copyState, setCopyState] = useState<SecondaryActionState>('idle');
  const [shareState, setShareState] = useState<SecondaryActionState>('idle');
  const [isSharing, setIsSharing] = useState(false);
  const copyResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shareResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const holderLabel = ticket.guest_name?.trim() || 'Guest ticket';
  const passType = ticket.pass_type?.trim() || 'General Admission';
  const ticketUrl = getPublicPassUrl(ticket.secure_token);
  const hasUploadedArtwork = Boolean(imageUrl?.trim());
  const artworkUri = resolvePassArtworkUri(imageUrl, eventName);
  const resolvedArtworkUri =
    artworkUri && hasUploadedArtwork
      ? resolveEventArtworkPublicUrl(artworkUri) ?? artworkUri
      : artworkUri;
  const uploadedCachePolicy = Platform.OS === 'web' ? 'none' : 'memory-disk';

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
    <View style={styles.panel}>
      <View style={styles.artworkLayer}>
        {resolvedArtworkUri ? (
          <Image
            cachePolicy={hasUploadedArtwork ? uploadedCachePolicy : 'memory-disk'}
            contentFit="cover"
            recyclingKey={resolvedArtworkUri}
            source={{ uri: resolvedArtworkUri }}
            style={styles.artworkImage}
          />
        ) : null}
        <View style={styles.artworkScrim} />
      </View>

      <View style={styles.panelContent}>
        <PassTicketCredentialCard
          entryInstruction="Show this QR code at the door."
          eventDate={eventDate}
          eventName={eventName}
          holderLabel={holderLabel}
          passType={passType}
          secureToken={ticket.secure_token}
          startTime={startTime}
          ticketNumberLabel={`Ticket ${ticketNumber} of ${ticketTotal}`}
          venueName={venueName}
        />

        <View style={styles.actions}>
          <Link href={getPassRoute(ticket.secure_token)} asChild>
            <Pressable
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}>
              <Text style={styles.secondaryButtonText}>Open full ticket</Text>
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

          <Text style={styles.walletNote}>Open the full ticket to add it to Apple Wallet.</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },
  artworkLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  artworkImage: {
    ...StyleSheet.absoluteFillObject,
  },
  artworkScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.34)',
  },
  panelContent: {
    gap: 14,
    padding: 12,
    position: 'relative',
    zIndex: 1,
  },
  actions: {
    gap: 10,
  },
  secondaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  secondaryButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 43, 214, 0.35)',
    backgroundColor: 'rgba(5, 5, 10, 0.88)',
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
    textAlign: 'center',
  },
});
