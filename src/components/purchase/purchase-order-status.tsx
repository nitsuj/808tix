import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { fan, text } from '@/theme';

type PurchaseOrderStatusProps = {
  title: string;
  body?: string;
  loading?: boolean;
};

export function PurchaseOrderStatus({ title, body, loading = false }: PurchaseOrderStatusProps) {
  return (
    <View style={styles.root}>
      {loading ? <ActivityIndicator color={fan.primary} size="large" /> : null}
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 48,
  },
  title: {
    color: text.primary,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  body: {
    color: text.secondary,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
});
