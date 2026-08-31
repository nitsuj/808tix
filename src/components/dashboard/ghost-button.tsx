import { Pressable, Text } from 'react-native';

import { dashboardStyles as styles } from '@/components/dashboard/dashboard-styles';

type GhostButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
};

export function GhostButton({ label, onPress, disabled }: GhostButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.ghostBtn, disabled && styles.disabled]}
    >
      <Text style={styles.ghostBtnText}>{label}</Text>
    </Pressable>
  );
}
