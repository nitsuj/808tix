import { Image } from 'expo-image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { AddToAppleWallet } from '@/components/pass/add-to-apple-wallet';
import { PassTicketCredentialCard } from '@/components/pass/pass-ticket-credential-card';
import { shareTicketLink } from '@/components/purchase/purchase-ticket-share';
import type { PublicOrderTicket } from '@/lib/database.types';
import { resolvePassArtworkUri } from '@/lib/event-artwork-display';
import { resolveEventArtworkPublicUrl } from '@/lib/event-artwork-storage';
import { getPublicPassUrl } from '@/lib/pass-link';
import { fan } from '@/theme';

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

type ShareActionState = 'idle' | 'copied' | 'copy_failed';

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
  const [shareState, setShareState] = useState<ShareActionState>('idle');
  const [isSharing, setIsSharing] = useState(false);
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

  const resetShareStateAfterDelay = useCallback(() => {
    if (shareResetTimer.current) {
      clearTimeout(shareResetTimer.current);
    }

    shareResetTimer.current = setTimeout(() => {
      setShareState('idle');
      shareResetTimer.current = null;
    }, 2000);
  }, []);

  useEffect(() => {
    const shareTimer = shareResetTimer;

    return () => {
      if (shareTimer.current) {
        clearTimeout(shareTimer.current);
      }
    };
  }, []);

  const handleShare = useCallback(async () => {
    setIsSharing(true);

    try {
      const result = await shareTicketLink(eventName, ticketUrl);

      if (result === 'copied') {
        setShareState('copied');
        resetShareStateAfterDelay();
      } else if (result === 'failed') {
        setShareState('copy_failed');
        resetShareStateAfterDelay();
      }
    } finally {
      setIsSharing(false);
    }
  }, [eventName, resetShareStateAfterDelay, ticketUrl]);

  const shareLabel =
    shareState === 'copied'
      ? 'Copied'
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
          <AddToAppleWallet secureToken={ticket.secure_token} />

          <View style={styles.centeredActionRow}>
            <Pressable
              accessibilityRole="button"
              disabled={isSharing}
              onPress={() => void handleShare()}
              style={({ pressed }) => [
                styles.actionButton,
                (pressed || isSharing) && styles.buttonPressed,
                isSharing && styles.actionButtonDisabled,
              ]}>
              {isSharing ? (
                <ActivityIndicator color={fan.bright} size="small" />
              ) : (
                <Text
                  style={[
                    styles.actionButtonText,
                    shareState === 'copied' && styles.actionButtonTextSuccess,
                    shareState === 'copy_failed' && styles.actionButtonTextError,
                  ]}>
                  {shareLabel}
                </Text>
              )}
            </Pressable>
          </View>
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
  centeredActionRow: {
    alignItems: 'center',
    width: '100%',
  },
  actionButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 43, 214, 0.35)',
    backgroundColor: 'rgba(5, 5, 10, 0.88)',
    paddingHorizontal: 18,
    paddingVertical: 9,
    minWidth: 148,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonDisabled: {
    opacity: 0.7,
  },
  actionButtonText: {
    color: fan.bright,
    fontSize: 13,
    fontWeight: '700',
  },
  actionButtonTextSuccess: {
    color: '#7DFFB2',
  },
  actionButtonTextError: {
    color: '#FF8FA8',
  },
  buttonPressed: {
    opacity: 0.86,
  },
});
