import { CameraView, useCameraPermissions } from 'expo-camera';
import { useCallback, useRef } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { organizer, scannerScreen, spacing } from '@/theme';

type EventScannerCameraProps = {
  eventName: string;
  isProcessing: boolean;
  onBarcodeScanned: (rawData: string) => void;
  onCancel: () => void;
  overlayFooterLabel?: string;
};

export function EventScannerCamera({
  eventName,
  isProcessing,
  onBarcodeScanned,
  onCancel,
}: EventScannerCameraProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const lastScanAtRef = useRef(0);

  const handleBarcodeScanned = useCallback(
    ({ data }: { data: string }) => {
      if (isProcessing) {
        return;
      }

      const now = Date.now();

      if (now - lastScanAtRef.current < 1500) {
        return;
      }

      lastScanAtRef.current = now;
      onBarcodeScanned(data);
    },
    [isProcessing, onBarcodeScanned],
  );

  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={organizer.accent} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionTitle}>Camera access needed</Text>
        <Text style={styles.permissionBody}>
          Allow camera access to scan pass QR codes for {eventName}.
        </Text>
        <Pressable
          onPress={requestPermission}
          style={({ pressed }) => [styles.permissionButton, pressed && styles.pressed]}>
          <Text style={styles.permissionButtonText}>Allow Camera</Text>
        </Pressable>
        <Pressable onPress={onCancel} style={styles.cancelLink}>
          <Text style={styles.cancelLinkText}>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        facing="back"
        style={styles.camera}
        onBarcodeScanned={isProcessing ? undefined : handleBarcodeScanned}
      />

      <View style={styles.overlay}>
        <View style={styles.topBar}>
          <Pressable onPress={onCancel} hitSlop={12}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Text style={styles.eventName} numberOfLines={2}>
            {eventName}
          </Text>
          <View style={styles.topSpacer} />
        </View>

        <View style={styles.frameWrap}>
          <View style={styles.scanFrame} />
        </View>

        <View style={styles.bottomBar}>
          {isProcessing ? (
            <View style={styles.processingRow}>
              <ActivityIndicator color={organizer.accent} />
              <Text style={styles.hint}>Validating…</Text>
            </View>
          ) : (
            <Text style={styles.hint}>Point at the guest pass QR code</Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: scannerScreen.overlay.background,
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'space-between',
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.four,
    paddingTop: spacing.five,
  },
  topSpacer: {
    width: 56,
  },
  cancelText: {
    color: organizer.accent,
    fontSize: 16,
    fontWeight: '600',
    width: 56,
  },
  eventName: {
    color: scannerScreen.overlay.text,
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  frameWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanFrame: {
    borderColor: organizer.accent,
    borderRadius: spacing.two,
    borderWidth: 3,
    height: 260,
    width: 260,
  },
  bottomBar: {
    alignItems: 'center',
    paddingBottom: spacing.six,
    paddingHorizontal: spacing.four,
  },
  hint: {
    color: scannerScreen.overlay.text,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  processingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.two,
  },
  centered: {
    alignItems: 'center',
    backgroundColor: scannerScreen.overlay.background,
    flex: 1,
    justifyContent: 'center',
  },
  permissionContainer: {
    backgroundColor: scannerScreen.overlay.background,
    flex: 1,
    gap: spacing.three,
    justifyContent: 'center',
    paddingHorizontal: spacing.five,
  },
  permissionTitle: {
    color: scannerScreen.overlay.text,
    fontSize: 24,
    fontWeight: '700',
  },
  permissionBody: {
    color: scannerScreen.overlay.textSecondary,
    fontSize: 16,
    lineHeight: 22,
  },
  permissionButton: {
    alignItems: 'center',
    backgroundColor: organizer.accent,
    borderRadius: spacing.two,
    marginTop: spacing.two,
    paddingVertical: spacing.three,
  },
  permissionButtonText: {
    color: scannerScreen.overlay.textOnAccent,
    fontSize: 16,
    fontWeight: '700',
  },
  cancelLink: {
    alignItems: 'center',
    paddingVertical: spacing.two,
  },
  cancelLinkText: {
    color: organizer.accent,
    fontSize: 16,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.85,
  },
});
