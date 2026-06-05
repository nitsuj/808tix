import { Image } from 'expo-image';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { organizer } from '@/theme';

/** Shared organizer logo diameter — Profile and Dashboard. */
export const ORGANIZER_AVATAR_SIZE = 96;

type OrganizerAvatarProps = {
  logoUrl?: string | null;
  size?: number;
  loading?: boolean;
};

/** Circular organizer logo or 808 placeholder. */
export function OrganizerAvatar({
  logoUrl,
  size = ORGANIZER_AVATAR_SIZE,
  loading = false,
}: OrganizerAvatarProps) {
  const trimmedLogo = logoUrl?.trim();

  return (
    <View
      style={[
        styles.root,
        {
          borderRadius: size / 2,
          height: size,
          width: size,
        },
      ]}>
      {loading ? (
        <ActivityIndicator color={organizer.accent} size="small" />
      ) : trimmedLogo ? (
        <Image
          cachePolicy="none"
          contentFit="cover"
          recyclingKey={trimmedLogo}
          source={{ uri: trimmedLogo }}
          style={[StyleSheet.absoluteFill, { borderRadius: size / 2 }]}
        />
      ) : (
        <Text style={[styles.placeholderText, { fontSize: size * 0.28 }]}>808</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    backgroundColor: 'rgba(57, 255, 20, 0.08)',
    borderColor: organizer.accent,
    borderWidth: 1.5,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  placeholderText: {
    color: organizer.accent,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
});
