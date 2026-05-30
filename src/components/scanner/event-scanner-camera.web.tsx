import jsQR from 'jsqr';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { OrganizerAccent, Spacing } from '@/constants/theme';

type EventScannerCameraProps = {
  eventName: string;
  isProcessing: boolean;
  onBarcodeScanned: (rawData: string) => void;
  onCancel: () => void;
};

type ScannerStatus = 'loading' | 'permission' | 'scanning' | 'error';

type DebugSnapshot = {
  mounted: boolean;
  hostReady: boolean;
  stream: boolean;
  videoWidth: number;
  videoHeight: number;
  playing: boolean;
  scanLoop: boolean;
};

const SCAN_DEBOUNCE_MS = 1500;

const INITIAL_DEBUG_SNAPSHOT: DebugSnapshot = {
  mounted: true,
  hostReady: false,
  stream: false,
  videoWidth: 0,
  videoHeight: 0,
  playing: false,
  scanLoop: false,
};

function applyCameraHostStyles(host: HTMLDivElement) {
  host.style.position = 'absolute';
  host.style.top = '0';
  host.style.left = '0';
  host.style.right = '0';
  host.style.bottom = '0';
  host.style.width = '100%';
  host.style.height = '100%';
  host.style.overflow = 'hidden';
  host.style.zIndex = '0';
  // TEMP: visible host bounds while debugging preview layout
  host.style.backgroundColor = '#220033';
  host.style.border = '3px solid #ff00ff';
}

function yesNo(value: boolean) {
  return value ? 'yes' : 'no';
}

function ScannerDebugPanel({ snapshot }: { snapshot: DebugSnapshot }) {
  return (
    <View pointerEvents="none" style={styles.debugPanel}>
      <Text style={styles.debugTitle}>WEB SCANNER DEBUG v3</Text>
      <Text style={styles.debugLine}>mounted: {yesNo(snapshot.mounted)}</Text>
      <Text style={styles.debugLine}>hostReady: {yesNo(snapshot.hostReady)}</Text>
      <Text style={styles.debugLine}>stream: {yesNo(snapshot.stream)}</Text>
      <Text style={styles.debugLine}>
        videoWidth/videoHeight: {snapshot.videoWidth}x{snapshot.videoHeight}
      </Text>
      <Text style={styles.debugLine}>playing: {yesNo(snapshot.playing)}</Text>
      <Text style={styles.debugLine}>scanLoop: {yesNo(snapshot.scanLoop)}</Text>
    </View>
  );
}

function applyVideoElementStyles(video: HTMLVideoElement) {
  video.autoplay = true;
  video.playsInline = true;
  video.muted = true;
  video.setAttribute('autoplay', '');
  video.setAttribute('playsinline', '');
  video.setAttribute('muted', '');
  video.style.position = 'fixed';
  video.style.top = '0';
  video.style.left = '0';
  video.style.right = '0';
  video.style.bottom = '0';
  video.style.width = '100vw';
  video.style.height = '100vh';
  video.style.objectFit = 'cover';
  video.style.opacity = '1';
  video.style.zIndex = '999';
  video.style.border = '10px solid lime';
  video.style.backgroundColor = 'red';
  video.style.boxSizing = 'border-box';
  video.style.pointerEvents = 'none';
}

export function EventScannerCamera({
  eventName,
  isProcessing,
  onBarcodeScanned,
  onCancel,
}: EventScannerCameraProps) {
  const cameraHostRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const scanLoopStartedRef = useRef(false);
  const lastScanAtRef = useRef(0);
  const isProcessingRef = useRef(isProcessing);
  const onBarcodeScannedRef = useRef(onBarcodeScanned);

  const [status, setStatus] = useState<ScannerStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [startAttempt, setStartAttempt] = useState(0);
  const [debugSnapshot, setDebugSnapshot] = useState<DebugSnapshot>(INITIAL_DEBUG_SNAPSHOT);

  useEffect(() => {
    console.log('[808Tix scanner] component mounted');

    return () => {
      console.log('[808Tix scanner] component unmounted');
    };
  }, []);

  useEffect(() => {
    const refreshDebugSnapshot = () => {
      const video = videoRef.current;

      setDebugSnapshot({
        mounted: true,
        hostReady: cameraHostRef.current !== null,
        stream: streamRef.current !== null,
        videoWidth: video?.videoWidth ?? 0,
        videoHeight: video?.videoHeight ?? 0,
        playing: Boolean(
          video &&
            !video.paused &&
            video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA,
        ),
        scanLoop: scanLoopStartedRef.current,
      });
    };

    refreshDebugSnapshot();
    const intervalId = window.setInterval(refreshDebugSnapshot, 250);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [status, startAttempt]);

  useEffect(() => {
    isProcessingRef.current = isProcessing;
  }, [isProcessing]);

  useEffect(() => {
    onBarcodeScannedRef.current = onBarcodeScanned;
  }, [onBarcodeScanned]);

  const assignCameraHostRef = useCallback((node: unknown) => {
    const host = (node as HTMLDivElement | null) ?? null;
    cameraHostRef.current = host;

    if (host) {
      applyCameraHostStyles(host);
      console.log('[808Tix scanner] host ref exists');
    } else {
      console.log('[808Tix scanner] host ref cleared');
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    scanLoopStartedRef.current = false;

    const stream = streamRef.current;

    if (stream) {
      stream.getTracks().forEach((track) => {
        track.stop();
      });
      streamRef.current = null;
    }

    const video = videoRef.current;

    if (video) {
      video.srcObject = null;
    }
  }, []);

  const startDecodeLoop = useCallback(() => {
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }

    const canvas = canvasRef.current;
    const context = canvas.getContext('2d', { willReadFrequently: true });

    if (!context) {
      return;
    }

    if (!scanLoopStartedRef.current) {
      scanLoopStartedRef.current = true;
      console.log('[808Tix scanner] scan loop running');
    }

    const tick = () => {
      const video = videoRef.current;

      if (
        video &&
        video.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA &&
        !isProcessingRef.current
      ) {
        const width = video.videoWidth;
        const height = video.videoHeight;

        if (width > 0 && height > 0) {
          canvas.width = width;
          canvas.height = height;
          context.drawImage(video, 0, 0, width, height);

          const imageData = context.getImageData(0, 0, width, height);
          const code = jsQR(imageData.data, width, height);

          if (code?.data) {
            const now = Date.now();

            if (now - lastScanAtRef.current >= SCAN_DEBOUNCE_MS) {
              lastScanAtRef.current = now;
              onBarcodeScannedRef.current(code.data);
            }
          }
        }
      }

      animationFrameRef.current = requestAnimationFrame(tick);
    };

    animationFrameRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    console.log('[808Tix scanner] camera startup effect running', { startAttempt });

    let cancelled = false;
    let rafId: number | null = null;
    let video: HTMLVideoElement | null = null;

    const handleLoadedMetadata = () => {
      if (!video) {
        return;
      }

      console.log('[808Tix scanner] video metadata loaded', {
        width: video.videoWidth,
        height: video.videoHeight,
      });
    };

    const cleanup = (reason: string) => {
      console.log('[808Tix scanner] cleanup', { reason, cancelled: true, startAttempt });
      cancelled = true;

      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }

      if (video) {
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      }

      stopCamera();

      const host = cameraHostRef.current;

      if (host && video && host.contains(video)) {
        host.removeChild(video);
      }

      if (video && document.body.contains(video)) {
        document.body.removeChild(video);
      }

      videoRef.current = null;
    };

    const run = async (host: HTMLDivElement) => {
      stopCamera();

      if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        console.log('[808Tix scanner] getUserMedia unavailable');
        setErrorMessage('Camera access is not supported in this browser.');
        setStatus('error');
        return;
      }

      if (!window.isSecureContext) {
        console.log('[808Tix scanner] insecure context — getUserMedia blocked');
        setErrorMessage('Camera requires HTTPS or localhost.');
        setStatus('error');
        return;
      }

      setErrorMessage(null);
      setStatus('loading');

      console.log('[808Tix scanner] before getUserMedia', { startAttempt });

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
          },
        });

        if (cancelled) {
          console.log('[808Tix scanner] getUserMedia success but effect cancelled — stopping tracks');
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        console.log('[808Tix scanner] getUserMedia success', {
          videoTracks: stream.getVideoTracks().length,
        });

        streamRef.current = stream;
        video.srcObject = stream;

        try {
          await video.play();
          console.log('[808Tix scanner] video.play() success');
        } catch (playError) {
          console.log('[808Tix scanner] video.play() error', playError);
          throw playError;
        }

        if (cancelled) {
          console.log('[808Tix scanner] video.play() success but effect cancelled — stopping camera');
          stopCamera();
          return;
        }

        setStatus('scanning');
        startDecodeLoop();
      } catch (error) {
        if (cancelled) {
          console.log('[808Tix scanner] getUserMedia error after cancellation', error);
          return;
        }

        const message = error instanceof Error ? error.message : 'Unable to start the camera.';
        const name = error instanceof DOMException ? error.name : '';

        console.log('[808Tix scanner] getUserMedia catch/error', { name, message, error });

        stopCamera();

        if (
          name === 'NotAllowedError' ||
          name === 'PermissionDeniedError' ||
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
    };

    rafId = requestAnimationFrame(() => {
      rafId = requestAnimationFrame(() => {
        rafId = null;

        if (cancelled) {
          console.log('[808Tix scanner] startup aborted — cancelled before host rAF');
          return;
        }

        const host = cameraHostRef.current;

        console.log('[808Tix scanner] host ref check after rAF', { hostExists: Boolean(host) });

        if (!host) {
          console.log('[808Tix scanner] host ref missing after rAF — startup stopped');
          return;
        }

        applyCameraHostStyles(host);

        video = document.createElement('video');
        applyVideoElementStyles(video);
        document.body.appendChild(video);
        videoRef.current = video;
        video.addEventListener('loadedmetadata', handleLoadedMetadata);

        console.log('[808Tix scanner] video appended to document.body');

        void run(host);
      });
    });

    return () => {
      cleanup('effect unmount or deps changed');
    };
  }, [startAttempt, startDecodeLoop, stopCamera]);

  const handleRequestPermission = useCallback(() => {
    setStatus('loading');
    setStartAttempt((attempt) => attempt + 1);
  }, []);

  if (status === 'permission') {
    return (
      <View style={styles.permissionContainer}>
        <ScannerDebugPanel snapshot={debugSnapshot} />
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
        <ScannerDebugPanel snapshot={debugSnapshot} />
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
      <ScannerDebugPanel snapshot={debugSnapshot} />
      <View ref={assignCameraHostRef} style={styles.camera} />

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
    bottom: 0,
    flex: 1,
    height: '100%',
    left: 0,
    minHeight: '100dvh',
    position: 'fixed',
    right: 0,
    top: 0,
    width: '100%',
  },
  camera: {
    backgroundColor: '#220033',
    borderColor: '#ff00ff',
    borderWidth: 3,
    bottom: 0,
    height: '100%',
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    top: 0,
    width: '100%',
    zIndex: 0,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    backgroundColor: 'transparent',
    justifyContent: 'center',
    zIndex: 1000,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    justifyContent: 'space-between',
    zIndex: 1000,
  },
  debugPanel: {
    backgroundColor: 'rgba(0, 0, 0, 0.88)',
    borderColor: '#ffff00',
    borderWidth: 3,
    gap: 4,
    left: 0,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 10001,
  },
  debugTitle: {
    color: '#ffff00',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  debugLine: {
    color: '#ffffff',
    fontFamily: 'monospace',
    fontSize: 14,
    fontWeight: '700',
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
    bottom: 0,
    flex: 1,
    gap: Spacing.three,
    height: '100%',
    justifyContent: 'center',
    left: 0,
    minHeight: '100dvh',
    paddingHorizontal: Spacing.five,
    position: 'fixed',
    right: 0,
    top: 0,
    width: '100%',
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
