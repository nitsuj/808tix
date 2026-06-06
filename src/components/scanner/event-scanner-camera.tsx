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
import { Radii } from '@/constants/theme';
import { chrome, fan, organizer, radius, scannerScreen, spacing, text } from '@/theme';
import { platformPointerEventsNone, platformTextShadow, platformViewShadow } from '@/theme/platform-styles';

const MOBILE_VIEWPORT_WIDTH = 390;

type EventScannerCameraProps = {
  eventName: string;
  eventDateLine?: string | null;
  venueLine?: string | null;
  imageUrl?: string | null;
  isProcessing: boolean;
  hideArtworkBackground?: boolean;
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
  eventDateLine,
  venueLine,
  imageUrl,
  isProcessing,
  hideArtworkBackground = false,
  onBarcodeScanned,
  onCancel,
  overlayFooterLabel,
}: EventScannerCameraProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const lastScanAtRef = useRef(0);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const layoutWidth = Math.min(windowWidth, MOBILE_VIEWPORT_WIDTH);
  const frameMaxByWidth = layoutWidth - spacing.six * 2;
  const frameMaxByHeight = Math.max(180, Math.floor(windowHeight * 0.4));
  const frameSize = Math.min(frameMaxByWidth, 300, frameMaxByHeight);

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
      <View style={[styles.root, hideArtworkBackground && styles.rootTransparent]}>
        {!hideArtworkBackground ? (
          <ScannerArtworkBackground eventName={eventName} imageUrl={imageUrl} />
        ) : null}
        <View style={styles.loadingScrim}>
          <ActivityIndicator size="large" color={organizer.accent} />
        </View>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.root, hideArtworkBackground && styles.rootTransparent]}>
        {!hideArtworkBackground ? (
          <ScannerArtworkBackground eventName={eventName} imageUrl={imageUrl} />
        ) : null}
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
    <View style={[styles.root, hideArtworkBackground && styles.rootTransparent]}>
      {!hideArtworkBackground ? (
        <ScannerArtworkBackground eventName={eventName} imageUrl={imageUrl} />
      ) : null}
      <View style={[styles.cameraScrim, platformPointerEventsNone()]} />

      <SafeAreaView edges={['top', 'bottom']} style={styles.uiLayer}>
        <View style={styles.topBar}>
          <Pressable hitSlop={12} onPress={onCancel}>
            <Text style={styles.cancelText}>← Event</Text>
          </Pressable>

          <View style={styles.headerCenter}>
            <Text numberOfLines={2} style={styles.eventName}>
              {eventName}
            </Text>
            {eventDateLine ? (
              <Text numberOfLines={1} style={styles.eventDateLine}>
                {eventDateLine}
              </Text>
            ) : null}
            {venueLine ? (
              <Text numberOfLines={1} style={styles.venueLine}>
                {venueLine}
              </Text>
            ) : null}
            <Text style={styles.scanningLabel}>SCANNING</Text>
          </View>

          <View style={styles.topSpacer} />
        </View>

        <View style={styles.frameSection}>
          <View
            style={[
              styles.frameGlowShell,
              { height: frameSize, width: frameSize },
              webFrameGlowStyle,
              nativeFrameGlowStyle,
            ]}>
            <View style={[styles.cameraShell, { height: frameSize, width: frameSize }]}>
              <CameraView
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                facing="back"
                style={StyleSheet.absoluteFill}
                onBarcodeScanned={isProcessing ? undefined : handleBarcodeScanned}
              />
              <View style={[styles.frameInsetGlow, platformPointerEventsNone()]} />
              <View style={[styles.frameBorder, platformPointerEventsNone()]} />
              <View style={[styles.cornerTL, platformPointerEventsNone()]} />
              <View style={[styles.cornerTR, platformPointerEventsNone()]} />
              <View style={[styles.cornerBL, platformPointerEventsNone()]} />
              <View style={[styles.cornerBR, platformPointerEventsNone()]} />
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

const overlayTextShadow = platformTextShadow({
  textShadowColor: 'rgba(0, 0, 0, 0.9)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 6,
});

const nativeFrameGlowStyle =
  Platform.OS === 'web'
    ? null
    : platformViewShadow({
        shadowColor: organizer.accent,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.45,
        shadowRadius: 18,
        elevation: 10,
      });

const styles = StyleSheet.create({
  root: {
    backgroundColor: scannerScreen.overlay.background,
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  rootTransparent: {
    backgroundColor: 'transparent',
  },
  cameraScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: scannerScreen.cameraScrim,
    zIndex: 1,
  },
  loadingScrim: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    backgroundColor: scannerScreen.cameraScrim,
    justifyContent: 'center',
    zIndex: 2,
  },
  permissionScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: scannerScreen.cameraScrim,
    zIndex: 1,
  },
  permissionSafeArea: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.four,
    zIndex: 2,
  },
  permissionCard: {
    backgroundColor: chrome.glass.fill,
    borderColor: chrome.glass.border,
    borderRadius: Radii.card,
    borderWidth: 1,
    gap: spacing.three,
    maxWidth: MOBILE_VIEWPORT_WIDTH - spacing.four * 2,
    padding: spacing.five,
    width: '100%',
  },
  uiLayer: {
    flex: 1,
    justifyContent: 'space-between',
    minHeight: 0,
    zIndex: 2,
  },
  topBar: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    flexShrink: 0,
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
    borderColor: organizer.accent,
    borderRadius: 999,
    borderWidth: 1,
    color: organizer.accent,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginTop: spacing.one,
    overflow: 'hidden',
    paddingHorizontal: spacing.two,
    paddingVertical: 4,
  },
  eventDateLine: {
    color: fan.badgeText,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    lineHeight: 14,
    textAlign: 'center',
  },
  venueLine: {
    color: scannerScreen.overlay.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.4,
    lineHeight: 16,
    textAlign: 'center',
  },
  cancelText: {
    color: fan.badgeText,
    fontSize: 15,
    fontWeight: '700',
    minWidth: 56,
    ...overlayTextShadow,
  },
  eventName: {
    color: scannerScreen.overlay.text,
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
    textAlign: 'center',
    textTransform: 'none',
    ...overlayTextShadow,
  },
  frameSection: {
    alignItems: 'center',
    flex: 1,
    flexShrink: 1,
    gap: spacing.three,
    justifyContent: 'center',
    minHeight: 0,
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
    ...overlayTextShadow,
  },
  processingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.two,
  },
  footer: {
    alignItems: 'center',
    flexShrink: 0,
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
    color: text.primary,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  permissionBody: {
    color: text.secondary,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  permissionButton: {
    alignItems: 'center',
    backgroundColor: fan.primary,
    borderRadius: Radii.button,
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
    color: fan.badgeText,
    fontSize: 15,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.85,
  },
});
