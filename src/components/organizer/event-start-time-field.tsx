import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useMemo, useRef, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { eventFormStyles } from '@/components/organizer/event-form-fields';
import {
  formatDateToHhMm,
  formatHhMmTo12HourDisplay,
  parseHhMmToLocalDate,
} from '@/lib/event-time-input';
import { formField, spacing, text as textTokens } from '@/theme';

const IOS_PICKER_SHEET = {
  background: '#F2F2F7',
  backdrop: 'rgba(0, 0, 0, 0.35)',
  doneText: '#007AFF',
  pickerText: '#000000',
} as const;

const DEFAULT_HOUR = 19;
const DEFAULT_MINUTE = 0;

type EventStartTimeFieldProps = {
  label: string;
  value: string;
  error?: string;
  hint?: string;
  disabled?: boolean;
  onChange: (hhMm: string) => void;
};

export function EventStartTimeField({
  label,
  value,
  error,
  hint = 'Tap to choose a time (12-hour)',
  disabled = false,
  onChange,
}: EventStartTimeFieldProps) {
  const [showPicker, setShowPicker] = useState(false);
  const webInputRef = useRef<HTMLInputElement | null>(null);

  const pickerDate = useMemo(() => {
    const parsed = parseHhMmToLocalDate(value);
    if (parsed) {
      return parsed;
    }

    const fallback = new Date();
    fallback.setHours(DEFAULT_HOUR, DEFAULT_MINUTE, 0, 0);
    return fallback;
  }, [value]);

  const displayValue = formatHhMmTo12HourDisplay(value) ?? 'Select start time';

  function handlePickerChange(event: DateTimePickerEvent, selectedDate?: Date) {
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }

    if (event.type === 'dismissed' || !selectedDate) {
      return;
    }

    onChange(formatDateToHhMm(selectedDate));
  }

  function openWebTimePicker() {
    if (disabled) {
      return;
    }

    const input = webInputRef.current;
    if (!input) {
      return;
    }

    if (typeof input.showPicker === 'function') {
      try {
        input.showPicker();
        return;
      } catch {
        // Fall through to click/focus.
      }
    }

    input.focus();
    input.click();
  }

  if (Platform.OS === 'web') {
    return (
      <View style={eventFormStyles.field}>
        <ThemedText style={eventFormStyles.label}>{label}</ThemedText>
        <ThemedText themeColor="textSecondary" style={eventFormStyles.hint}>
          {hint}
        </ThemedText>
        <Pressable
          accessibilityRole="button"
          disabled={disabled}
          onPress={openWebTimePicker}
          style={({ pressed }) => [
            styles.nativeTrigger,
            error ? eventFormStyles.inputError : null,
            pressed && !disabled && styles.pressed,
            disabled && styles.disabled,
          ]}>
          <ThemedText style={[styles.nativeTriggerText, !value.trim() && styles.placeholderText]}>
            {displayValue}
          </ThemedText>
          <input
            ref={webInputRef}
            aria-label={label}
            disabled={disabled}
            type="time"
            value={value}
            onChange={(event) => onChange(event.target.value.slice(0, 5))}
            style={styles.webHiddenInput as never}
          />
        </Pressable>
        {error ? <ThemedText style={eventFormStyles.errorText}>{error}</ThemedText> : null}
      </View>
    );
  }

  return (
    <View style={eventFormStyles.field}>
      <ThemedText style={eventFormStyles.label}>{label}</ThemedText>
      <ThemedText themeColor="textSecondary" style={eventFormStyles.hint}>
        {hint}
      </ThemedText>
      <Pressable
        accessibilityRole="button"
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
                is24Hour={false}
                mode="time"
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
          is24Hour={false}
          mode="time"
          value={pickerDate}
          onChange={handlePickerChange}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  webHiddenInput: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: '100%',
    height: '100%',
    opacity: 0.01,
    border: 'none',
    padding: 0,
    margin: 0,
    cursor: 'pointer',
  },
  nativeTrigger: {
    backgroundColor: formField.inputBackground,
    borderColor: formField.inputBorder,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: spacing.three,
    paddingVertical: spacing.three,
    position: 'relative',
    overflow: 'hidden',
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
