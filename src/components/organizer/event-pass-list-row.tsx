import { useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { chrome, fan, organizer, semantic } from '@/theme';
import type { Pass, PassStatus } from '@/lib/database.types';
import { formatPassTimestamp } from '@/lib/pass-datetime';
import { formatPassStatusLabel } from '@/lib/pass-display';
import { buildPassLinkUrl } from '@/lib/pass-link';
import { sendPassSms } from '@/lib/send-pass-sms';

type EventPassListRowProps = {
  pass: Pass;
  eventName: string;
};

/**
 * TODO: Future organizer pass detail screen may centralize resend/share/void/transfer actions.
 * For now, "View Guest Pass" opens the existing public guest pass URL.
 */
export function EventPassListRow({ pass, eventName }: EventPassListRowProps) {
  const [smsMessage, setSmsMessage] = useState<string | null>(null);
  const [smsError, setSmsError] = useState<string | null>(null);
  const [isSendingSms, setIsSendingSms] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);

  const passUrl = buildPassLinkUrl(pass.secure_token);
  const issuedAt = formatPassTimestamp(pass.created_at);
  const checkedInAt = formatPassTimestamp(pass.checked_in_at);
  const hasPhone = Boolean(pass.guest_phone?.trim());
  const hasMultipleSendActions = hasPhone;
  const contactLine = [pass.guest_email?.trim() || null, pass.guest_phone?.trim() || null]
    .filter(Boolean)
    .join(' · ');

  async function handleViewGuestPass() {
    try {
      if (Platform.OS === 'web') {
        window.open(passUrl, '_blank', 'noopener,noreferrer');
        return;
      }

      await Linking.openURL(passUrl);
    } catch {
      // Guest may dismiss — no action needed.
    }
  }

  async function handleSharePass() {
    try {
      await Share.share({
        message: `Your pass for ${eventName}: ${passUrl}`,
        url: passUrl,
        title: `${pass.guest_name} — ${eventName}`,
      });
    } catch {
      // User dismissed share sheet.
    }
  }

  async function handleResendSms() {
    if (!pass.guest_phone) {
      return;
    }

    setSmsMessage(null);
    setSmsError(null);
    setIsSendingSms(true);

    const result = await sendPassSms({
      passId: pass.id,
      eventName,
      passUrl,
      phone: pass.guest_phone,
    });

    setIsSendingSms(false);

    if (!result.ok) {
      setSmsError(result.error);
      return;
    }

    setSmsMessage(result.message);
  }

  return (
    <View style={styles.row}>
      <View style={styles.mainLine}>
        <View style={styles.identityBlock}>
          <ThemedText numberOfLines={1} style={styles.guestName}>
            {pass.guest_name}
          </ThemedText>
          <ThemedText numberOfLines={1} themeColor="textSecondary" style={styles.contactLine}>
            {contactLine || '—'}
          </ThemedText>
        </View>
        <StatusBadge status={pass.status} />
      </View>

      <View style={styles.metaLine}>
        <ThemedText numberOfLines={1} style={styles.metaText}>
          {pass.pass_type}
        </ThemedText>
        {pass.status === 'checked_in' && checkedInAt ? (
          <ThemedText numberOfLines={1} themeColor="textSecondary" style={styles.metaText}>
            Checked in {checkedInAt}
          </ThemedText>
        ) : issuedAt ? (
          <ThemedText numberOfLines={1} themeColor="textSecondary" style={styles.metaText}>
            Issued {issuedAt}
          </ThemedText>
        ) : null}
      </View>

      {smsMessage ? (
        <ThemedText numberOfLines={2} themeColor="textSecondary" style={styles.feedback}>
          {smsMessage}
        </ThemedText>
      ) : null}
      {smsError ? (
        <ThemedText numberOfLines={2} style={styles.errorText}>
          {smsError}
        </ThemedText>
      ) : null}

      <View style={styles.actionsRow}>
        <Pressable
          onPress={handleViewGuestPass}
          style={({ pressed }) => [styles.actionLink, pressed && styles.pressed]}>
          <ThemedText style={styles.actionLinkText}>View Guest Pass</ThemedText>
        </Pressable>

        {hasMultipleSendActions ? (
          <Pressable
            onPress={() => setActionsOpen((open) => !open)}
            style={({ pressed }) => [styles.actionLink, pressed && styles.pressed]}>
            <ThemedText style={styles.actionLinkText}>{actionsOpen ? 'Hide' : 'Resend'}</ThemedText>
          </Pressable>
        ) : (
          <Pressable
            onPress={handleSharePass}
            style={({ pressed }) => [styles.actionLink, pressed && styles.pressed]}>
            <ThemedText style={styles.actionLinkText}>Send Pass</ThemedText>
          </Pressable>
        )}
      </View>

      {actionsOpen && hasMultipleSendActions ? (
        <View style={styles.actionsPanel}>
          <Pressable
            onPress={handleSharePass}
            style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}>
            <ThemedText style={styles.actionButtonText}>Share Pass</ThemedText>
          </Pressable>

          {hasPhone ? (
            <Pressable
              disabled={isSendingSms}
              onPress={handleResendSms}
              style={({ pressed }) => [
                styles.actionButton,
                pressed && !isSendingSms && styles.pressed,
                isSendingSms && styles.disabled,
              ]}>
              {isSendingSms ? (
                <ActivityIndicator color={organizer.accent} size="small" />
              ) : (
                <ThemedText style={styles.actionButtonText}>Resend SMS</ThemedText>
              )}
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function StatusBadge({ status }: { status: PassStatus }) {
  const label = formatPassStatusLabel(status);
  const tone =
    status === 'checked_in'
      ? styles.statusCheckedIn
      : status === 'voided'
        ? styles.statusVoided
        : styles.statusActive;

  return (
    <View style={[styles.statusBadge, tone]}>
      <ThemedText style={styles.statusBadgeText}>{label}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: chrome.glass.fill,
    borderBottomColor: chrome.glass.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
  },
  mainLine: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: Spacing.two,
    justifyContent: 'space-between',
  },
  identityBlock: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  guestName: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  contactLine: {
    fontSize: 12,
    lineHeight: 16,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
  },
  statusActive: {
    backgroundColor: 'rgba(162, 91, 255, 0.18)',
  },
  statusCheckedIn: {
    backgroundColor: 'rgba(57, 255, 20, 0.14)',
  },
  statusVoided: {
    backgroundColor: 'rgba(255, 59, 59, 0.14)',
  },
  statusBadgeText: {
    color: fan.badgeText,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  metaLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    justifyContent: 'space-between',
  },
  metaText: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  feedback: {
    fontSize: 11,
    lineHeight: 15,
  },
  errorText: {
    color: semantic.errorSoft,
    fontSize: 11,
    lineHeight: 15,
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
    marginTop: Spacing.half,
  },
  actionLink: {
    paddingVertical: 2,
  },
  actionLinkText: {
    color: organizer.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  actionsPanel: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.half,
  },
  actionButton: {
    borderColor: chrome.glass.border,
    borderRadius: 6,
    borderWidth: 1,
    minWidth: 96,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one + 2,
  },
  actionButtonText: {
    color: fan.badgeText,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.5,
  },
});
