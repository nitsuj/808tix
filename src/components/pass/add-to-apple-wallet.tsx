import * as Linking from 'expo-linking';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { buildWalletAppleUrl } from '@/lib/wallet-apple-url';
import { fan, spacing, text } from '@/theme';

type AddToAppleWalletProps = {
  secureToken: string;
  disabled?: boolean;
};

function isIosWalletCapable(): boolean {
  if (Platform.OS === 'ios') {
    return true;
  }

  if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
    return /iPhone|iPad|iPod/i.test(navigator.userAgent);
  }

  return false;
}

export function AddToAppleWallet({ secureToken, disabled = false }: AddToAppleWalletProps) {
  if (!isIosWalletCapable()) {
    return null;
  }

  const walletUrl = buildWalletAppleUrl(secureToken);

  if (!walletUrl) {
    return null;
  }

  function openWalletUrl() {
    if (disabled) {
      return;
    }

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.assign(walletUrl);
      return;
    }

    void Linking.openURL(walletUrl);
  }

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="link"
        disabled={disabled}
        onPress={openWalletUrl}
        style={({ pressed }) => [
          styles.link,
          disabled && styles.linkDisabled,
          pressed && !disabled && styles.linkPressed,
        ]}>
        <Text style={styles.label}>Add to Apple Wallet</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    marginTop: spacing.three,
    width: '100%',
  },
  link: {
    alignItems: 'center',
    backgroundColor: 'rgb(0, 0, 0)',
    borderColor: fan.primary,
    borderRadius: spacing.two,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.four,
    paddingVertical: spacing.two,
    width: '100%',
  },
  linkDisabled: {
    opacity: 0.45,
  },
  linkPressed: {
    opacity: 0.85,
  },
  label: {
    color: text.primary,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
});
