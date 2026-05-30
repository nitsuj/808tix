import { CameraView, useCameraPermissions } from 'expo-camera';
import { useCallback, useRef } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScannerArtworkBackground } from '@/components/scanner/scanner-artwork-background';
import { organizer, radius, scannerScreen, spacing } from '@/theme';

type EventScannerCameraProps = {
  eventName: string;
  imageUrl?: string | null;
  isProcessing: boolean;
  onBarcodeScanned: (rawData: string) => void;
  onCancel: () => void;
  overlayFooterLabel?: string;
};

const webFrameGlowStyle =
  Platform.OS === 'web'
    ? ({ boxShadow: scannerScreen.frame.webBoxShadow } as ViewStyle)
    : null;

export function EventScannerCamera({
  eventName,
  imageUrl,
  isProcessing,
  onBarcodeScanned,
  onCancel,
  overlayFooterLabel,
}: EventScannerCameraProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const lastScanAtRef = useRef(0);
  const { width: windowWidth } = useWindowDimensions();
  const frameSize = Math.min(windowWidth - spacing.six * 2, 300);

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
      <View style={styles.root}>
        <ScannerArtworkBackground eventName={eventName} imageUrl={imageUrl} />
        <View style={styles.loadingScrim}>
          <ActivityIndicator size="large" color={organizer.accent} />
        </View>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.root}>
        <ScannerArtworkBackground eventName={eventName} imageUrl={imageUrl} />
        <View style={styles.permissionScrim} />
        <SafeAreaView edges={['top', 'bottom']} style={styles.permissionSafeArea}>
          <View style={styles.permissionCard}>
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
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScannerArtworkBackground eventName={eventName} imageUrl={imageUrl} />
      <View pointerEvents="none" style={styles.cameraScrim} />

      <SafeAreaView edges={['top', 'bottom']} style={styles.uiLayer}>
        <View style={styles.topBar}>
          <Pressable hitSlop={12} onPress={onCancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>

          <View style={styles.headerCenter}>
            <Text style={styles.scanningLabel}>SCANNING</Text>
            <Text numberOfLines={2} style={styles.eventName}>
              {eventName}
            </Text>
          </View>

          <View style={styles.topSpacer} />
        </View>

        <View style={styles.frameSection}>
          <View
            style={[
              styles.frameGlowShell,
              { height: frameSize, width: frameSize },
              webFrameGlowStyle,
              Platform.OS === 'ios'
                ? {
                    shadowColor: organizer.accent,
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.45,
                    shadowRadius: 18,
                  }
                : null,
              Platform.OS === 'android' ? { elevation: 10 } : null,
            ]}>
            <View style={[styles.cameraShell, { height: frameSize, width: frameSize }]}>
              <CameraView
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                facing="back"
                style={StyleSheet.absoluteFill}
                onBarcodeScanned={isProcessing ? undefined : handleBarcodeScanned}
              />
              <View pointerEvents="none" style={styles.frameInsetGlow} />
              <View pointerEvents="none" style={styles.frameBorder} />
              <View pointerEvents="none" style={styles.cornerTL} />
              <View pointerEvents="none" style={styles.cornerTR} />
              <View pointerEvents="none" style={styles.cornerBL} />
              <View pointerEvents="none" style={styles.cornerBR} />
            </View>
          </View>

          {isProcessing ? (
            <View style={styles.processingRow}>
              <ActivityIndicator color={organizer.accent} />
              <Text style={styles.hint}>Validating…</Text>
            </View>
          ) : (
            <Text style={styles.hint}>Point at the guest pass QR code</Text>
          )}
        </View>

        {overlayFooterLabel ? (
          <View style={styles.footer}>
            <View style={styles.footerPill}>
              <Text style={styles.footerText}>{overlayFooterLabel}</Text>
            </View>
          </View>
        ) : null}
      </SafeAreaView>
    </View>
  );
}

const CORNER_SIZE = 22;
const CORNER_THICKNESS = 3;

const styles = StyleSheet.create({
  root: {
    backgroundColor: scannerScreen.overlay.background,
    flex: 1,
    position: 'relative',
  },
  cameraScrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: scannerScreen.cameraScrim,
  },
  loadingScrim: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    backgroundColor: scannerScreen.cameraScrim,
    justifyContent: 'center',
    zIndex: 1,
  },
  permissionScrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: scannerScreen.cameraScrim,
  },
  permissionSafeArea: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.four,
    zIndex: 1,
  },
  permissionCard: {
    backgroundColor: scannerScreen.footer.pillBackground,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: radius.card,
    borderWidth: 1,
    gap: spacing.three,
    padding: spacing.five,
  },
  uiLayer: {
    flex: 1,
    justifyContent: 'space-between',
    zIndex: 1,
  },
  topBar: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.four,
    paddingTop: spacing.two,
  },
  topSpacer: {
    width: 56,
  },
  headerCenter: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.half,
    paddingHorizontal: spacing.two,
  },
  scanningLabel: {
    color: organizer.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2.4,
  },
  cancelText: {
    color: organizer.accent,
    fontSize: 16,
    fontWeight: '600',
    width: 56,
    ...(Platform.OS === 'web'
      ? ({ textShadow: scannerScreen.frame.webTextShadow } as ViewStyle)
      : null),
  },
  eventName: {
    color: scannerScreen.overlay.text,
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
    textAlign: 'center',
    ...(Platform.OS === 'web'
      ? ({ textShadow: scannerScreen.frame.webTextShadow } as ViewStyle)
      : null),
  },
  frameSection: {
    alignItems: 'center',
    gap: spacing.three,
    justifyContent: 'center',
    paddingHorizontal: spacing.four,
  },
  frameGlowShell: {
    borderRadius: radius.card + 2,
  },
  cameraShell: {
    borderRadius: radius.card,
    overflow: 'hidden',
    position: 'relative',
  },
  frameBorder: {
    ...StyleSheet.absoluteFill,
    borderColor: organizer.accent,
    borderRadius: radius.card,
    borderWidth: 2,
  },
  frameInsetGlow: {
    ...StyleSheet.absoluteFill,
    backgroundColor: scannerScreen.frame.inset,
    borderRadius: radius.card,
  },
  cornerTL: {
    borderColor: organizer.accent,
    borderLeftWidth: CORNER_THICKNESS,
    borderTopLeftRadius: radius.card,
    borderTopWidth: CORNER_THICKNESS,
    height: CORNER_SIZE,
    left: -1,
    position: 'absolute',
    top: -1,
    width: CORNER_SIZE,
  },
  cornerTR: {
    borderColor: organizer.accent,
    borderRightWidth: CORNER_THICKNESS,
    borderTopRightRadius: radius.card,
    borderTopWidth: CORNER_THICKNESS,
    height: CORNER_SIZE,
    position: 'absolute',
    right: -1,
    top: -1,
    width: CORNER_SIZE,
  },
  cornerBL: {
    borderBottomLeftRadius: radius.card,
    borderBottomWidth: CORNER_THICKNESS,
    borderColor: organizer.accent,
    borderLeftWidth: CORNER_THICKNESS,
    bottom: -1,
    height: CORNER_SIZE,
    left: -1,
    position: 'absolute',
    width: CORNER_SIZE,
  },
  cornerBR: {
    borderBottomRightRadius: radius.card,
    borderBottomWidth: CORNER_THICKNESS,
    borderColor: organizer.accent,
    borderRightWidth: CORNER_THICKNESS,
    bottom: -1,
    height: CORNER_SIZE,
    position: 'absolute',
    right: -1,
    width: CORNER_SIZE,
  },
  hint: {
    color: scannerScreen.overlay.text,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    ...(Platform.OS === 'web'
      ? ({ textShadow: scannerScreen.frame.webTextShadow } as ViewStyle)
      : null),
  },
  processingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.two,
  },
  footer: {
    alignItems: 'center',
    paddingBottom: spacing.two,
    paddingHorizontal: spacing.four,
  },
  footerPill: {
    backgroundColor: scannerScreen.footer.pillBackground,
    borderColor: organizer.accent,
    borderRadius: radius.input,
    borderWidth: 1,
    paddingHorizontal: spacing.four,
    paddingVertical: spacing.two,
  },
  footerText: {
    color: scannerScreen.overlay.text,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
    ...(Platform.OS === 'web'
      ? ({ textShadow: scannerScreen.frame.webTextShadow } as ViewStyle)
      : null),
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
    borderRadius: radius.button,
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
