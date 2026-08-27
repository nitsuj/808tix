import { useState } from 'react';
import { Linking, Platform, Pressable, Text, View } from 'react-native';

import { adminStyles as styles } from '@/components/admin/admin-styles';

export function asAdminArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export async function copyAdminText(value: string): Promise<void> {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
    await navigator.clipboard.writeText(value);
  }
}

export function AdminLinkButton({ label, href }: { label: string; href: string }) {
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => {
        void Linking.openURL(href);
      }}
      style={styles.linkBtn}
    >
      <Text style={styles.linkBtnText}>{label}</Text>
    </Pressable>
  );
}

export function AdminCopyButton({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Pressable
      onPress={async () => {
        await copyAdminText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      style={styles.linkBtn}
    >
      <Text style={styles.linkBtnText}>{copied ? 'Copied' : label}</Text>
    </Pressable>
  );
}

export function AdminSummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>{label}</Text>
      <Text style={styles.cardValue}>{value}</Text>
    </View>
  );
}

type BadgeTone = 'neutral' | 'positive' | 'warn';

export function AdminBadge({ label, tone = 'neutral' }: { label: string; tone?: BadgeTone }) {
  const badgeStyle =
    tone === 'positive' ? styles.badgePositive : tone === 'warn' ? styles.badgeWarn : styles.badgeNeutral;
  const textStyle = tone === 'positive' ? styles.badgeTextAccent : styles.badgeText;
  return (
    <View style={[styles.badge, badgeStyle]}>
      <Text style={textStyle}>{label}</Text>
    </View>
  );
}

export function AdminMetricCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricCell}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

export function AdminField({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}
