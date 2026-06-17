import { Platform, Share } from 'react-native';

import { copyToClipboard } from '@/lib/copy-to-clipboard';

export type ShareTicketResult = 'shared' | 'copied' | 'cancelled' | 'failed';

export function buildTicketShareText(eventName: string): string {
  return `Here's your ticket for ${eventName}.`;
}

export async function shareTicketLink(
  eventName: string,
  ticketUrl: string,
): Promise<ShareTicketResult> {
  const text = buildTicketShareText(eventName);

  if (Platform.OS === 'web') {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: eventName,
          text,
          url: ticketUrl,
        });
        return 'shared';
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return 'cancelled';
        }
      }
    }
  } else {
    try {
      const result = await Share.share({
        message: `${text}\n${ticketUrl}`,
        url: ticketUrl,
      });

      if (result.action === Share.sharedAction) {
        return 'shared';
      }

      if (result.action === Share.dismissedAction) {
        return 'cancelled';
      }
    } catch {
      // Fall through to clipboard copy.
    }
  }

  try {
    await copyToClipboard(ticketUrl);
    return 'copied';
  } catch {
    return 'failed';
  }
}
