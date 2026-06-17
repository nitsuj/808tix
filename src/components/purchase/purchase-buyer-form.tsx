import { StyleSheet, Text, TextInput, View } from 'react-native';

import { text } from '@/theme';

type PurchaseBuyerFormProps = {
  email: string;
  name: string;
  disabled?: boolean;
  onEmailChange: (value: string) => void;
  onNameChange: (value: string) => void;
};

export function PurchaseBuyerForm({
  email,
  name,
  disabled = false,
  onEmailChange,
  onNameChange,
}: PurchaseBuyerFormProps) {
  return (
    <View style={styles.root}>
      <View style={styles.field}>
        <Text style={styles.label}>Email for your tickets</Text>
        <TextInput
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          editable={!disabled}
          keyboardType="email-address"
          onChangeText={onEmailChange}
          placeholder="you@example.com"
          placeholderTextColor={text.muted}
          style={styles.input}
          value={email}
        />
        <Text style={styles.hint}>We&apos;ll send your ticket links here.</Text>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Name on ticket (optional)</Text>
        <TextInput
          autoCapitalize="words"
          autoComplete="name"
          editable={!disabled}
          onChangeText={onNameChange}
          placeholder="Your name"
          placeholderTextColor={text.muted}
          style={styles.input}
          value={name}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 16,
  },
  field: {
    gap: 8,
  },
  label: {
    color: text.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  hint: {
    color: text.secondary,
    fontSize: 12,
    lineHeight: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(255, 43, 214, 0.35)',
    backgroundColor: 'rgba(5, 5, 10, 0.92)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: text.primary,
    fontSize: 16,
  },
});
