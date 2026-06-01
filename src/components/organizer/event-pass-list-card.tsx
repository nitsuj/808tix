import { useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, Share, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radii, Spacing } from '@/constants/theme';
import { chrome, fan, semantic } from '@/theme';
import type { Pass } from '@/lib/database.types';
import { formatPassTimestamp } from '@/lib/pass-datetime';
import { formatPassStatusLabel } from '@/lib/pass-display';
import { buildPassLinkUrl } from '@/lib/pass-link';
import { sendPassSms } from '@/lib/send-pass-sms';

type EventPassListCardProps = {
  pass: Pass;
  eventName: string;
};

export function EventPassListCard({ pass, eventName }: EventPassListCardProps) {
  const [smsMessage, setSmsMessage] = useState<string | null>(null);
  const [smsError, setSmsError] = useState<string | null>(null);
  const [isSendingSms, setIsSendingSms] = useState(false);

  const passUrl = buildPassLinkUrl(pass.secure_token);
  const issuedAt = formatPassTimestamp(pass.created_at);
  const checkedInAt = formatPassTimestamp(pass.checked_in_at);
  const hasPhone = Boolean(pass.guest_phone?.trim());

  async function handleViewPass() {
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
    <ThemedView style={styles.card}>
      <ThemedText style={styles.guestName}>{pass.guest_name}</ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.passType}>
        {pass.pass_type}
      </ThemedText>

      <View style={styles.metaBlock}>
        <MetaRow label="Email" value={pass.guest_email || '—'} />
        <MetaRow label="Phone" value={pass.guest_phone || '—'} />
        <MetaRow label="Status" value={formatPassStatusLabel(pass.status)} />
        <MetaRow label="Issued" value={issuedAt ?? '—'} />
        {pass.status === 'checked_in' ? (
          <MetaRow label="Checked in" value={checkedInAt ?? '—'} />
        ) : null}
      </View>

      {smsMessage ? (
        <ThemedText themeColor="textSecondary" style={styles.feedback}>
          {smsMessage}
        </ThemedText>
      ) : null}
      {smsError ? <ThemedText style={styles.errorText}>{smsError}</ThemedText> : null}

      <View style={styles.actions}>
        <Pressable
          onPress={handleViewPass}
          style={({ pressed }) => [styles.actionButton, styles.actionPrimary, pressed && styles.pressed]}>
          <ThemedText style={styles.actionPrimaryText}>View Pass</ThemedText>
        </Pressable>

        <Pressable
          onPress={handleSharePass}
          style={({ pressed }) => [styles.actionButton, styles.actionSecondary, pressed && styles.pressed]}>
          <ThemedText style={styles.actionSecondaryText}>Share Pass</ThemedText>
        </Pressable>

        {hasPhone ? (
          <Pressable
            disabled={isSendingSms}
            onPress={handleResendSms}
            style={({ pressed }) => [
              styles.actionButton,
              styles.actionSecondary,
              pressed && !isSendingSms && styles.pressed,
              isSendingSms && styles.disabled,
            ]}>
            {isSendingSms ? (
              <ActivityIndicator color={fan.primary} size="small" />
            ) : (
              <ThemedText style={styles.actionSecondaryText}>Resend SMS</ThemedText>
            )}
          </Pressable>
        ) : null}
      </View>
    </ThemedView>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaRow}>
      <ThemedText themeColor="textSecondary" style={styles.metaLabel}>
        {label}
      </ThemedText>
      <ThemedText style={styles.metaValue}>{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: chrome.glass.fill,
    borderColor: chrome.glass.border,
    borderRadius: Radii.card,
    borderWidth: 1,
    gap: Spacing.two,
    padding: Spacing.four,
  },
  guestName: {
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 26,
  },
  passType: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: -Spacing.one,
  },
  metaBlock: {
    gap: Spacing.one,
    marginTop: Spacing.one,
  },
  metaRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    justifyContent: 'space-between',
  },
  metaLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    width: 88,
  },
  metaValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'right',
  },
  feedback: {
    fontSize: 13,
  },
  errorText: {
    color: semantic.errorSoft,
    fontSize: 13,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  actionButton: {
    alignItems: 'center',
    borderRadius: Radii.button,
    minWidth: 100,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  actionPrimary: {
    backgroundColor: fan.primary,
  },
  actionPrimaryText: {
    color: chrome.white,
    fontSize: 14,
    fontWeight: '800',
  },
  actionSecondary: {
    borderColor: chrome.glass.border,
    borderWidth: 1,
  },
  actionSecondaryText: {
    color: fan.badgeText,
    fontSize: 14,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.88,
  },
  disabled: {
    opacity: 0.5,
  },
});
