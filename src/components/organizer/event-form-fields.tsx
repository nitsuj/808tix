import { StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { formField, radius, spacing, surface } from '@/theme';

export type EventFormFieldProps = {
  label: string;
  value: string;
  placeholder: string;
  hint?: string;
  error?: string;
  keyboardType?: 'default' | 'number-pad' | 'phone-pad';
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
        placeholderTextColor={formField.placeholderColor}
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
    backgroundColor: surface.card,
    borderColor: surface.divider,
    borderRadius: radius.card,
    borderWidth: 1,
    gap: spacing.three,
    padding: spacing.four,
  },
  input: {
    backgroundColor: formField.inputBackground,
    borderColor: formField.inputBorder,
    borderRadius: radius.input,
    borderWidth: 1,
    color: formField.labelColor,
    fontSize: 16,
    fontWeight: '500',
    paddingHorizontal: spacing.three,
    paddingVertical: spacing.three,
  },
  inputError: {
    borderColor: formField.errorColor,
  },
  errorText: {
    color: formField.errorColor,
    fontSize: 13,
  },
  field: {
    gap: spacing.one,
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
