import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useMemo, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { eventFormStyles } from '@/components/organizer/event-form-fields';
import {
  formatDateToYyyyMmDd,
  formatEventDateForDisplay,
  getTodayYyyyMmDdLocal,
  parseYyyyMmDdToLocalDate,
} from '@/lib/event-date';
import { formField, spacing, text as textTokens } from '@/theme';

/** Light sheet so iOS spinner wheels stay readable in dark app chrome. */
const IOS_PICKER_SHEET = {
  background: '#F2F2F7',
  backdrop: 'rgba(0, 0, 0, 0.35)',
  doneText: '#007AFF',
  pickerText: '#000000',
} as const;

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
      {Platform.OS === 'ios' ? (
        <Modal
          animationType="slide"
          onRequestClose={() => setShowPicker(false)}
          presentationStyle="overFullScreen"
          statusBarTranslucent
          transparent
          visible={showPicker}>
          <View style={styles.iosModalRoot}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowPicker(false)}
              style={styles.iosModalBackdrop}
            />
            <View style={styles.iosModalSheet}>
              <ThemedText style={styles.iosDebugLabel}>iOS picker modal path active</ThemedText>
              <View style={styles.iosModalHeader}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setShowPicker(false)}
                  style={styles.iosDone}>
                  <ThemedText style={styles.iosDoneText}>Done</ThemedText>
                </Pressable>
              </View>
              <DateTimePicker
                display="spinner"
                minimumDate={parseYyyyMmDdToLocalDate(getTodayYyyyMmDdLocal()) ?? undefined}
                mode="date"
                style={styles.iosPicker}
                textColor={IOS_PICKER_SHEET.pickerText}
                themeVariant="light"
                value={pickerDate}
                onChange={handlePickerChange}
              />
            </View>
          </View>
        </Modal>
      ) : showPicker ? (
        <DateTimePicker
          display="default"
          minimumDate={parseYyyyMmDdToLocalDate(getTodayYyyyMmDdLocal()) ?? undefined}
          mode="date"
          value={pickerDate}
          onChange={handlePickerChange}
        />
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
  iosModalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  iosModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: IOS_PICKER_SHEET.backdrop,
  },
  iosModalSheet: {
    backgroundColor: IOS_PICKER_SHEET.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: spacing.four,
  },
  iosDebugLabel: {
    backgroundColor: '#FF0000',
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    paddingHorizontal: spacing.three,
    paddingVertical: spacing.one,
    textAlign: 'center',
  },
  iosModalHeader: {
    alignItems: 'flex-end',
    borderBottomColor: 'rgba(60, 60, 67, 0.18)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.three,
    paddingTop: spacing.two,
  },
  iosDone: {
    paddingVertical: spacing.one,
  },
  iosDoneText: {
    color: IOS_PICKER_SHEET.doneText,
    fontSize: 17,
    fontWeight: '600',
  },
  iosPicker: {
    backgroundColor: IOS_PICKER_SHEET.background,
    height: 216,
    width: '100%',
  },
});
