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
