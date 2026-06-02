import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { eventFormStyles } from '@/components/organizer/event-form-fields';
import {
  formatDateToYyyyMmDd,
  formatEventDateForDisplay,
  getTodayYyyyMmDdLocal,
  parseYyyyMmDdToLocalDate,
} from '@/lib/event-date';
import { formField, spacing, text as textTokens } from '@/theme';

type EventDateFormFieldProps = {
  label: string;
  value: string;
  error?: string;
  disabled?: boolean;
  onChange: (yyyyMmDd: string) => void;
};

export function EventDateFormField({
  label,
  value,
  error,
  disabled = false,
  onChange,
}: EventDateFormFieldProps) {
  const [showPicker, setShowPicker] = useState(false);

  const pickerDate = useMemo(() => {
    return parseYyyyMmDdToLocalDate(value) ?? new Date();
  }, [value]);

  const displayValue = value.trim() ? formatEventDateForDisplay(value) : 'Select event date';

  function handlePickerChange(event: DateTimePickerEvent, selectedDate?: Date) {
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }

    if (event.type === 'dismissed' || !selectedDate) {
      return;
    }

    onChange(formatDateToYyyyMmDd(selectedDate));
  }

  if (Platform.OS === 'web') {
    return (
      <View style={eventFormStyles.field}>
        <ThemedText style={eventFormStyles.label}>{label}</ThemedText>
        <ThemedText themeColor="textSecondary" style={eventFormStyles.hint}>
          Tap to choose a date
        </ThemedText>
        <View
          style={[
            styles.webInputWrap,
            error ? eventFormStyles.inputError : null,
            disabled && styles.disabled,
          ]}>
          <input
            disabled={disabled}
            min={getTodayYyyyMmDdLocal()}
            type="date"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            style={styles.webInput as never}
          />
        </View>
        {error ? <ThemedText style={eventFormStyles.errorText}>{error}</ThemedText> : null}
      </View>
    );
  }

  return (
    <View style={eventFormStyles.field}>
      <ThemedText style={eventFormStyles.label}>{label}</ThemedText>
      <ThemedText themeColor="textSecondary" style={eventFormStyles.hint}>
        Stored as YYYY-MM-DD
      </ThemedText>
      <Pressable
        disabled={disabled}
        onPress={() => setShowPicker(true)}
        style={({ pressed }) => [
          styles.nativeTrigger,
          error ? eventFormStyles.inputError : null,
          pressed && !disabled && styles.pressed,
          disabled && styles.disabled,
        ]}>
        <ThemedText style={[styles.nativeTriggerText, !value.trim() && styles.placeholderText]}>
          {displayValue}
        </ThemedText>
      </Pressable>
      {error ? <ThemedText style={eventFormStyles.errorText}>{error}</ThemedText> : null}
      {showPicker ? (
        <DateTimePicker
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          minimumDate={parseYyyyMmDdToLocalDate(getTodayYyyyMmDdLocal()) ?? undefined}
          mode="date"
          value={pickerDate}
          onChange={handlePickerChange}
        />
      ) : null}
      {Platform.OS === 'ios' && showPicker ? (
        <Pressable onPress={() => setShowPicker(false)} style={styles.iosDone}>
          <ThemedText style={styles.iosDoneText}>Done</ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  webInputWrap: {
    backgroundColor: formField.inputBackground,
    borderColor: formField.inputBorder,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  webInput: {
    backgroundColor: 'transparent',
    border: 'none',
    color: textTokens.primary,
    fontSize: 16,
    fontWeight: '500',
    outline: 'none',
    padding: spacing.three,
    width: '100%',
  },
  nativeTrigger: {
    backgroundColor: formField.inputBackground,
    borderColor: formField.inputBorder,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: spacing.three,
    paddingVertical: spacing.three,
  },
  nativeTriggerText: {
    color: textTokens.primary,
    fontSize: 16,
    fontWeight: '500',
  },
  placeholderText: {
    color: formField.placeholderColor,
  },
  pressed: {
    opacity: 0.88,
  },
  disabled: {
    opacity: 0.6,
  },
  iosDone: {
    alignSelf: 'flex-end',
    paddingVertical: spacing.one,
  },
  iosDoneText: {
    color: formField.labelColor,
    fontSize: 16,
    fontWeight: '700',
  },
});
