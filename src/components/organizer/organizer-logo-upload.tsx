import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { ORGANIZER_AVATAR_SIZE, OrganizerAvatar } from '@/components/organizer/organizer-avatar';
import { ThemedText } from '@/components/themed-text';
import { measureLocalFileSize, validateEventArtworkFile } from '@/lib/event-artwork-validation';
import { uploadOrganizerLogo } from '@/lib/organizer-logo-storage';
import { persistOrganizerLogoUrl } from '@/lib/organizer-profile';
import { organizer, palette, spacing } from '@/theme';

type OrganizerLogoUploadProps = {
  organizerId: string;
  logoUrl: string | null;
  disabled?: boolean;
  onLogoUrlChange: (logoUrl: string) => void;
  onUploadError?: (message: string) => void;
};

export function OrganizerLogoUpload({
  organizerId,
  logoUrl,
  disabled = false,
  onLogoUrlChange,
  onUploadError,
}: OrganizerLogoUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const hasLogo = Boolean(logoUrl?.trim());
  const accessibilityLabel = hasLogo ? 'Replace logo' : 'Upload logo';

  async function handlePickLogo() {
    if (disabled || isUploading) {
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      const message = 'Photo library access is required to choose a logo.';
      setValidationError(message);
      onUploadError?.(message);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (result.canceled || result.assets.length === 0) {
      return;
    }

    const asset = result.assets[0];
    const mimeType = asset.mimeType ?? 'image/jpeg';
    const fileSize = asset.fileSize ?? (await measureLocalFileSize(asset.uri));
    const errorMessage = validateEventArtworkFile(mimeType, fileSize);

    if (errorMessage) {
      setValidationError(errorMessage);
      onUploadError?.(errorMessage);
      return;
    }

    setValidationError(null);
    setIsUploading(true);

    try {
      const publicUrl = await uploadOrganizerLogo(organizerId, asset.uri, mimeType, fileSize);
      const persistOutcome = await persistOrganizerLogoUrl(publicUrl);

      if (!persistOutcome.ok) {
        throw new Error(persistOutcome.error);
      }

      onLogoUrlChange(publicUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Logo upload failed.';
      setValidationError(message);
      onUploadError?.(message);
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <View style={styles.section}>
      <Pressable
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        disabled={disabled || isUploading}
        onPress={handlePickLogo}
        style={({ pressed }) => [
          styles.avatarButton,
          pressed && !disabled && !isUploading && styles.pressed,
          (disabled || isUploading) && styles.disabled,
        ]}>
        <OrganizerAvatar logoUrl={logoUrl} size={ORGANIZER_AVATAR_SIZE} />

        {isUploading ? (
          <View style={[styles.loadingOverlay, { borderRadius: ORGANIZER_AVATAR_SIZE / 2 }]}>
            <ActivityIndicator color={organizer.accent} size="small" />
          </View>
        ) : (
          <View style={styles.editBadge}>
            <Text style={styles.editBadgeIcon}>{hasLogo ? '↻' : '+'}</Text>
          </View>
        )}
      </Pressable>

      {validationError ? <ThemedText style={styles.errorText}>{validationError}</ThemedText> : null}
    </View>
  );
}

const BADGE_SIZE = 28;

const styles = StyleSheet.create({
  section: {
    alignItems: 'center',
    gap: spacing.two,
    marginTop: spacing.one,
  },
  avatarButton: {
    position: 'relative',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
  },
  editBadge: {
    alignItems: 'center',
    backgroundColor: organizer.accent,
    borderColor: palette.pureBlack,
    borderRadius: BADGE_SIZE / 2,
    borderWidth: 2,
    bottom: 0,
    height: BADGE_SIZE,
    justifyContent: 'center',
    position: 'absolute',
    right: 0,
    width: BADGE_SIZE,
  },
  editBadgeIcon: {
    color: palette.pureBlack,
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 18,
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.88,
  },
  disabled: {
    opacity: 0.6,
  },
});
