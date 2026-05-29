import { StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

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
      <ThemedText type="smallBold" style={eventFormStyles.label}>
        {label}
      </ThemedText>
      {hint ? (
        <ThemedText themeColor="textSecondary" type="small">
          {hint}
        </ThemedText>
      ) : null}
      <TextInput
        editable
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor="#666"
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
    gap: Spacing.three,
    padding: Spacing.four,
    borderRadius: Spacing.three,
  },
  input: {
    backgroundColor: '#111',
    borderColor: '#333',
    borderRadius: Spacing.two,
    borderWidth: 1,
    color: '#fff',
    fontSize: 16,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  inputError: {
    borderColor: '#ff6b6b',
  },
  errorText: {
    color: '#ff6b6b',
  },
  field: {
    gap: Spacing.one,
  },
  label: {
    marginTop: Spacing.half,
  },
});
