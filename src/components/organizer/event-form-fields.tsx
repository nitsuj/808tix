import { StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing, Surface } from '@/constants/theme';

export type EventFormFieldProps = {
  label: string;
  value: string;
  placeholder: string;
  hint?: string;
  error?: string;
  keyboardType?: 'default' | 'number-pad';
  onChangeText: (value: string) => void;
};

export function EventFormField({
  label,
  value,
  placeholder,
  hint,
  error,
  keyboardType = 'default',
  onChangeText,
}: EventFormFieldProps) {
  return (
    <View style={eventFormStyles.field}>
      <ThemedText style={eventFormStyles.label}>{label}</ThemedText>
      {hint ? (
        <ThemedText themeColor="textSecondary" style={eventFormStyles.hint}>
          {hint}
        </ThemedText>
      ) : null}
      <TextInput
        editable
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor="#666666"
        style={[eventFormStyles.input, error ? eventFormStyles.inputError : null]}
        value={value}
        onChangeText={onChangeText}
      />
      {error ? <ThemedText style={eventFormStyles.errorText}>{error}</ThemedText> : null}
    </View>
  );
}

export const eventFormStyles = StyleSheet.create({
  form: {
    backgroundColor: Surface.card,
    borderColor: Surface.divider,
    borderRadius: Radii.card,
    borderWidth: 1,
    gap: Spacing.three,
    padding: Spacing.four,
  },
  input: {
    backgroundColor: Surface.input,
    borderColor: Surface.divider,
    borderRadius: Radii.input,
    borderWidth: 1,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  inputError: {
    borderColor: '#FF3B3B',
  },
  errorText: {
    color: '#FF3B3B',
    fontSize: 13,
  },
  field: {
    gap: Spacing.one,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  hint: {
    fontSize: 12,
    marginTop: -2,
  },
});
