import { StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { formField, palette, radius, spacing, surface, text } from '@/theme';

export type EventFormFieldProps = {
  label: string;
  value: string;
  placeholder: string;
  hint?: string;
  error?: string;
  keyboardType?: 'default' | 'number-pad' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  onChangeText: (value: string) => void;
  onBlur?: () => void;
  onEndEditing?: () => void;
  /** Organizer Profile / Dashboard-aligned field styling. */
  tone?: 'default' | 'organizer';
};

export function EventFormField({
  label,
  value,
  placeholder,
  hint,
  error,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  autoCorrect = true,
  onChangeText,
  onBlur,
  onEndEditing,
  tone = 'default',
}: EventFormFieldProps) {
  const isOrganizerTone = tone === 'organizer';

  return (
    <View style={eventFormStyles.field}>
      <ThemedText style={[eventFormStyles.label, isOrganizerTone && organizerFieldStyles.label]}>
        {label}
      </ThemedText>
      {hint ? (
        <ThemedText themeColor="textSecondary" style={eventFormStyles.hint}>
          {hint}
        </ThemedText>
      ) : null}
      <TextInput
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        editable
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor={isOrganizerTone ? text.muted : formField.placeholderColor}
        style={[
          eventFormStyles.input,
          isOrganizerTone && organizerFieldStyles.input,
          error ? eventFormStyles.inputError : null,
          error && isOrganizerTone ? organizerFieldStyles.inputError : null,
        ]}
        value={value}
        onBlur={onBlur}
        onChangeText={onChangeText}
        onEndEditing={onEndEditing}
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
  /** Form fields inside Event Detail–style floating panels (no nested card). */
  formPanel: {
    gap: spacing.three,
    width: '100%',
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

const organizerFieldStyles = StyleSheet.create({
  label: {
    color: text.secondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: palette.pureBlack,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    color: text.primary,
  },
  inputError: {
    borderColor: formField.errorColor,
  },
});
