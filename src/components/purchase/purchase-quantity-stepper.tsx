import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fan, text } from '@/theme';

type PurchaseQuantityStepperProps = {
  value: number;
  min?: number;
  max: number;
  disabled?: boolean;
  onChange: (value: number) => void;
  testID?: string;
};

export function PurchaseQuantityStepper({
  value,
  min = 1,
  max,
  disabled = false,
  onChange,
  testID,
}: PurchaseQuantityStepperProps) {
  const canDecrease = !disabled && value > min;
  const canIncrease = !disabled && value < max;

  return (
    <View style={styles.root} testID={testID}>
      <Text style={styles.label}>How many?</Text>
      <View style={styles.controls}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Decrease quantity"
          disabled={!canDecrease}
          onPress={() => onChange(Math.max(min, value - 1))}
          style={({ pressed }) => [
            styles.button,
            !canDecrease && styles.buttonDisabled,
            pressed && canDecrease && styles.buttonPressed,
          ]}>
          <Text style={styles.buttonText}>−</Text>
        </Pressable>
        <Text style={styles.value}>{value}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Increase quantity"
          disabled={!canIncrease}
          onPress={() => onChange(Math.min(max, value + 1))}
          style={({ pressed }) => [
            styles.button,
            !canIncrease && styles.buttonDisabled,
            pressed && canIncrease && styles.buttonPressed,
          ]}>
          <Text style={styles.buttonText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 12,
  },
  label: {
    color: text.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  button: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 43, 214, 0.45)',
    backgroundColor: 'rgba(255, 43, 214, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.35,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    color: fan.bright,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '600',
  },
  value: {
    minWidth: 28,
    textAlign: 'center',
    color: text.primary,
    fontSize: 22,
    fontWeight: '700',
  },
});
