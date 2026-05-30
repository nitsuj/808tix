import { Html5Qrcode } from 'html5-qrcode';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { OrganizerAccent, Spacing } from '@/constants/theme';

type EventScannerCameraProps = {
  eventName: string;
  isProcessing: boolean;
  onBarcodeScanned: (rawData: string) => void;
  onCancel: () => void;
};

type ScannerStatus = 'loading' | 'permission' | 'scanning' | 'error';

const SCAN_DEBOUNCE_MS = 1500;

export function EventScannerCamera({
  eventName,
  isProcessing,
  onBarcodeScanned,
  onCancel,
}: EventScannerCameraProps) {
  const reactId = useId();
  const scannerElementId = `event-scanner-${reactId.replace(/:/g, '')}`;
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScanAtRef = useRef(0);
  const isProcessingRef = useRef(isProcessing);
  const onBarcodeScannedRef = useRef(onBarcodeScanned);

  const [status, setStatus] = useState<ScannerStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [startAttempt, setStartAttempt] = useState(0);

  useEffect(() => {
    isProcessingRef.current = isProcessing;
  }, [isProcessing]);

  useEffect(() => {
    onBarcodeScannedRef.current = onBarcodeScanned;
  }, [onBarcodeScanned]);

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;

    if (!scanner) {
      return;
    }

    if (scanner.isScanning) {
      try {
        await scanner.stop();
      } catch {
        // Scanner may already be stopped during unmount.
      }
    }

    scanner.clear();
    scannerRef.current = null;
  }, []);

  const startScanner = useCallback(async () => {
    await stopScanner();

    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setErrorMessage('Camera access is not supported in this browser.');
      setStatus('error');
      return;
    }

    if (!document.getElementById(scannerElementId)) {
      setErrorMessage('Scanner view is not ready yet.');
      setStatus('error');
      return;
    }

    setErrorMessage(null);

    const scanner = new Html5Qrcode(scannerElementId, { verbose: false });
    scannerRef.current = scanner;

    try {
      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 260, height: 260 },
          aspectRatio: 1,
          videoConstraints: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
          },
        },
        (decodedText) => {
          if (isProcessingRef.current) {
            return;
          }

          const now = Date.now();

          if (now - lastScanAtRef.current < SCAN_DEBOUNCE_MS) {
            return;
          }

          lastScanAtRef.current = now;
          onBarcodeScannedRef.current(decodedText);
        },
        () => {
          // No QR in frame — expected while scanning.
        },
      );

      setStatus('scanning');
    } catch (error) {
      scanner.clear();
      scannerRef.current = null;

      const message = error instanceof Error ? error.message : 'Unable to start the camera.';

      if (
        message.toLowerCase().includes('permission') ||
        message.toLowerCase().includes('notallowed') ||
        message.toLowerCase().includes('denied')
      ) {
        setStatus('permission');
        return;
      }

      setErrorMessage(message);
      setStatus('error');
    }
  }, [scannerElementId, stopScanner]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      await startScanner();

      if (cancelled) {
        await stopScanner();
      }
    };

    void run();

    return () => {
      cancelled = true;
      void stopScanner();
    };
  }, [startAttempt, startScanner, stopScanner]);

  useEffect(() => {
    const scanner = scannerRef.current;

    if (!scanner || !scanner.isScanning) {
      return;
    }

    if (isProcessing) {
      scanner.pause(true);
      return;
    }

    scanner.resume();
  }, [isProcessing]);

  const handleRequestPermission = useCallback(() => {
    setStatus('loading');
    setStartAttempt((attempt) => attempt + 1);
  }, []);

  if (status === 'permission') {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionTitle}>Camera access needed</Text>
        <Text style={styles.permissionBody}>
          Allow camera access to scan pass QR codes for {eventName}. HTTPS is required on mobile
          browsers.
        </Text>
        <Pressable
          onPress={handleRequestPermission}
          style={({ pressed }) => [styles.permissionButton, pressed && styles.pressed]}>
          <Text style={styles.permissionButtonText}>Allow Camera</Text>
        </Pressable>
        <Pressable onPress={onCancel} style={styles.cancelLink}>
          <Text style={styles.cancelLinkText}>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionTitle}>Camera unavailable</Text>
        <Text style={styles.permissionBody}>{errorMessage ?? 'Unable to access the camera.'}</Text>
        <Pressable
          onPress={handleRequestPermission}
          style={({ pressed }) => [styles.permissionButton, pressed && styles.pressed]}>
          <Text style={styles.permissionButtonText}>Try Again</Text>
        </Pressable>
        <Pressable onPress={onCancel} style={styles.cancelLink}>
          <Text style={styles.cancelLinkText}>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View nativeID={scannerElementId} style={styles.camera} />

      {status === 'loading' ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={OrganizerAccent} />
        </View>
      ) : null}

      <View pointerEvents="box-none" style={styles.overlay}>
        <View style={styles.topBar}>
          <Pressable onPress={onCancel} hitSlop={12}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Text style={styles.eventName} numberOfLines={2}>
            {eventName}
          </Text>
          <View style={styles.topSpacer} />
        </View>

        <View pointerEvents="none" style={styles.frameWrap}>
          <View style={styles.scanFrame} />
        </View>

        <View style={styles.bottomBar}>
          {isProcessing ? (
            <View style={styles.processingRow}>
              <ActivityIndicator color={OrganizerAccent} />
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
    backgroundColor: '#000000',
    flex: 1,
  },
  camera: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    backgroundColor: '#000000',
    justifyContent: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
  },
  topSpacer: {
    width: 56,
  },
  cancelText: {
    color: OrganizerAccent,
    fontSize: 16,
    fontWeight: '600',
    width: 56,
  },
  eventName: {
    color: '#FFFFFF',
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
    borderColor: OrganizerAccent,
    borderRadius: Spacing.two,
    borderWidth: 3,
    height: 260,
    width: 260,
  },
  bottomBar: {
    alignItems: 'center',
    paddingBottom: Spacing.six,
    paddingHorizontal: Spacing.four,
  },
  hint: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  processingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
  },
  permissionContainer: {
    backgroundColor: '#000000',
    flex: 1,
    gap: Spacing.three,
    justifyContent: 'center',
    paddingHorizontal: Spacing.five,
  },
  permissionTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
  permissionBody: {
    color: '#B0B4BA',
    fontSize: 16,
    lineHeight: 22,
  },
  permissionButton: {
    alignItems: 'center',
    backgroundColor: OrganizerAccent,
    borderRadius: Spacing.two,
    marginTop: Spacing.two,
    paddingVertical: Spacing.three,
  },
  permissionButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
  },
  cancelLink: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  cancelLinkText: {
    color: OrganizerAccent,
    fontSize: 16,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.85,
  },
});
