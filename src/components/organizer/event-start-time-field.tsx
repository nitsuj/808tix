import { EventFormField, type EventFormFieldProps } from '@/components/organizer/event-form-fields';
import {
  normalizeTimeFieldOnBlur,
  stripTimeInputDigits,
} from '@/lib/event-time-input';

type EventStartTimeFieldProps = Omit<EventFormFieldProps, 'onChangeText' | 'onBlur' | 'keyboardType'> & {
  onChange: (value: string) => void;
};

export function EventStartTimeField({
  value,
  onChange,
  ...rest
}: EventStartTimeFieldProps) {
  function handleChangeText(text: string) {
    onChange(stripTimeInputDigits(text));
  }

  function handleBlur() {
    onChange(normalizeTimeFieldOnBlur(value));
  }

  return (
    <EventFormField
      {...rest}
      autoCapitalize="none"
      keyboardType="number-pad"
      value={value}
      onBlur={handleBlur}
      onChangeText={handleChangeText}
      onEndEditing={handleBlur}
    />
  );
}
