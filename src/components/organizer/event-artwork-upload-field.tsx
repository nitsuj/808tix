import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { EventArtwork } from '@/components/ui/event-artwork';
import { ThemedText } from '@/components/themed-text';
import {
  EVENT_ARTWORK_REQUIREMENTS_LABEL,
  measureLocalFileSize,
  validateEventArtworkFile,
} from '@/lib/event-artwork-validation';
import { artworkUpload, formField, radius, spacing, text as textTokens } from '@/theme';

export type PendingArtworkSelection = {
  localUri: string;
  mimeType: string;
  fileSize: number;
};

type EventArtworkUploadFieldProps = {
  eventName: string;
  existingImageUrl: string | null;
  pendingSelection: PendingArtworkSelection | null;
  onSelectionChange: (selection: PendingArtworkSelection | null) => void;
  disabled?: boolean;
};

export function EventArtworkUploadField({
  eventName,
  existingImageUrl,
  pendingSelection,
  onSelectionChange,
  disabled = false,
}: EventArtworkUploadFieldProps) {
  const [validationError, setValidationError] = useState<string | null>(null);
  const previewUri = pendingSelection?.localUri ?? existingImageUrl ?? null;
  const hasArtwork = Boolean(previewUri);
  const actionLabel = hasArtwork ? 'Replace artwork' : 'Choose artwork';

  async function handlePickImage() {
    if (disabled) {
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setValidationError('Photo library access is required to choose artwork.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
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
      onSelectionChange(null);
      return;
    }

    setValidationError(null);
    onSelectionChange({
      localUri: asset.uri,
      mimeType,
      fileSize: fileSize!,
    });
  }

  return (
    <View style={styles.section}>
      <ThemedText style={styles.label}>Event Artwork</ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.hint}>
        {EVENT_ARTWORK_REQUIREMENTS_LABEL}
      </ThemedText>

      <View style={styles.previewWrap}>
        <EventArtwork
          height={artworkUpload.previewHeight}
          imageUrl={previewUri}
          name={eventName}
          rounded
        />
      </View>

      {validationError ? (
        <ThemedText style={styles.errorText}>{validationError}</ThemedText>
      ) : null}

      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={handlePickImage}
        style={({ pressed }) => [
          styles.actionButton,
          pressed && !disabled && styles.pressed,
          disabled && styles.disabled,
        ]}>
        <ThemedText style={styles.actionText}>{actionLabel}</ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.two,
  },
  label: {
    color: textTokens.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  hint: {
    fontSize: 13,
    lineHeight: 18,
  },
  previewWrap: {
    borderColor: artworkUpload.borderColor,
    borderRadius: radius.card,
    borderWidth: 1,
    overflow: 'hidden',
  },
  errorText: {
    color: formField.errorColor,
    fontSize: 13,
    lineHeight: 18,
  },
  actionButton: {
    alignItems: 'center',
    backgroundColor: artworkUpload.actionBackground,
    borderColor: artworkUpload.actionBorder,
    borderRadius: radius.button,
    borderWidth: 1,
    paddingVertical: spacing.two + 2,
  },
  actionText: {
    color: artworkUpload.actionText,
    fontSize: 15,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.6,
  },
});
