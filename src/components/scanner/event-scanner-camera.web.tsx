import jsQR from 'jsqr';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { OrganizerAccent, Spacing } from '@/constants/theme';

type EventScannerCameraProps = {
  eventName: string;
  isProcessing: boolean;
  onBarcodeScanned: (rawData: string) => void;
  onCancel: () => void;
  overlayFooterLabel?: string;
};

type ScannerStatus = 'loading' | 'permission' | 'scanning' | 'error';

const SCAN_DEBOUNCE_MS = 1500;
const TEXT_SECONDARY = '#B0B4BA';

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
  video.style.backgroundColor = '#000000';
  video.style.zIndex = '999';
  video.style.pointerEvents = 'none';
}

function removeVideoElement(video: HTMLVideoElement | null) {
  if (!video) {
    return;
  }

  video.srcObject = null;

  if (document.body.contains(video)) {
    document.body.removeChild(video);
  }
}

const SCANNER_OVERLAY_Z_INDEX = '1000';
const OVERLAY_TEXT_SHADOW = '0 1px 6px rgba(0, 0, 0, 0.95)';

function mountScannerOverlay(options: {
  eventName: string;
  footerLabel?: string;
  hint: string;
  isLoading: boolean;
  onCancel: () => void;
}) {
  const overlay = document.createElement('div');

  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.right = '0';
  overlay.style.bottom = '0';
  overlay.style.width = '100vw';
  overlay.style.height = '100vh';
  overlay.style.zIndex = SCANNER_OVERLAY_Z_INDEX;
  overlay.style.pointerEvents = 'none';
  overlay.style.display = 'flex';
  overlay.style.flexDirection = 'column';
  overlay.style.justifyContent = 'space-between';
  overlay.style.boxSizing = 'border-box';
  overlay.style.backgroundColor = 'transparent';

  const topBar = document.createElement('div');
  topBar.style.display = 'flex';
  topBar.style.alignItems = 'flex-start';
  topBar.style.justifyContent = 'space-between';
  topBar.style.padding = `${Spacing.five}px ${Spacing.four}px 0`;
  topBar.style.pointerEvents = 'none';

  const cancelButton = document.createElement('button');
  cancelButton.type = 'button';
  cancelButton.textContent = 'Cancel';
  cancelButton.style.pointerEvents = 'auto';
  cancelButton.style.background = 'transparent';
  cancelButton.style.border = 'none';
  cancelButton.style.color = OrganizerAccent;
  cancelButton.style.cursor = 'pointer';
  cancelButton.style.fontSize = '16px';
  cancelButton.style.fontWeight = '600';
  cancelButton.style.padding = `${Spacing.one}px 0`;
  cancelButton.style.minWidth = '56px';
  cancelButton.style.textShadow = OVERLAY_TEXT_SHADOW;

  const onCancelClick = () => {
    options.onCancel();
  };

  cancelButton.addEventListener('click', onCancelClick);

  const eventHeader = document.createElement('div');
  eventHeader.style.flex = '1';
  eventHeader.style.display = 'flex';
  eventHeader.style.flexDirection = 'column';
  eventHeader.style.alignItems = 'center';
  eventHeader.style.gap = `${Spacing.one}px`;
  eventHeader.style.padding = `0 ${Spacing.two}px`;

  const scanningLabel = document.createElement('div');
  scanningLabel.textContent = 'Scanning';
  scanningLabel.style.color = OrganizerAccent;
  scanningLabel.style.fontSize = '11px';
  scanningLabel.style.fontWeight = '800';
  scanningLabel.style.letterSpacing = '1.2px';
  scanningLabel.style.textTransform = 'uppercase';
  scanningLabel.style.textShadow = OVERLAY_TEXT_SHADOW;

  const eventName = document.createElement('div');
  eventName.textContent = options.eventName;
  eventName.style.color = '#FFFFFF';
  eventName.style.fontSize = '22px';
  eventName.style.fontWeight = '800';
  eventName.style.lineHeight = '28px';
  eventName.style.textAlign = 'center';
  eventName.style.textShadow = OVERLAY_TEXT_SHADOW;

  eventHeader.appendChild(scanningLabel);
  eventHeader.appendChild(eventName);

  const topSpacer = document.createElement('div');
  topSpacer.style.minWidth = '56px';

  topBar.appendChild(cancelButton);
  topBar.appendChild(eventHeader);
  topBar.appendChild(topSpacer);

  const frameWrap = document.createElement('div');
  frameWrap.style.flex = '1';
  frameWrap.style.display = 'flex';
  frameWrap.style.flexDirection = 'column';
  frameWrap.style.alignItems = 'center';
  frameWrap.style.justifyContent = 'center';
  frameWrap.style.gap = `${Spacing.three}px`;
  frameWrap.style.pointerEvents = 'none';

  const scanFrame = document.createElement('div');
  scanFrame.style.width = '260px';
  scanFrame.style.height = '260px';
  scanFrame.style.border = `3px solid ${OrganizerAccent}`;
  scanFrame.style.borderRadius = '16px';
  scanFrame.style.boxSizing = 'border-box';
  scanFrame.style.backgroundColor = 'transparent';
  scanFrame.style.boxShadow = `0 0 0 1px rgba(57, 255, 20, 0.25), inset 0 0 24px rgba(57, 255, 20, 0.08)`;

  const hint = document.createElement('div');
  hint.textContent = options.hint;
  hint.style.color = TEXT_SECONDARY;
  hint.style.fontSize = '12px';
  hint.style.fontWeight = '600';
  hint.style.letterSpacing = '0.4px';
  hint.style.maxWidth = '280px';
  hint.style.textAlign = 'center';
  hint.style.textTransform = 'uppercase';
  hint.style.textShadow = OVERLAY_TEXT_SHADOW;

  frameWrap.appendChild(scanFrame);
  frameWrap.appendChild(hint);

  overlay.appendChild(topBar);
  overlay.appendChild(frameWrap);

  if (options.footerLabel) {
    const footer = document.createElement('div');
    footer.style.display = 'flex';
    footer.style.justifyContent = 'center';
    footer.style.padding = `0 ${Spacing.four}px ${Spacing.five}px`;
    footer.style.pointerEvents = 'none';

    const footerText = document.createElement('div');
    footerText.textContent = options.footerLabel;
    footerText.style.color = OrganizerAccent;
    footerText.style.fontSize = '14px';
    footerText.style.fontWeight = '800';
    footerText.style.letterSpacing = '0.6px';
    footerText.style.textShadow = OVERLAY_TEXT_SHADOW;
    footerText.style.textTransform = 'uppercase';

    footer.appendChild(footerText);
    overlay.appendChild(footer);
  }

  if (options.isLoading) {
    const loadingIndicator = document.createElement('div');
    loadingIndicator.textContent = 'Starting camera…';
    loadingIndicator.style.position = 'absolute';
    loadingIndicator.style.top = '50%';
    loadingIndicator.style.left = '50%';
    loadingIndicator.style.transform = 'translate(-50%, -50%)';
    loadingIndicator.style.color = OrganizerAccent;
    loadingIndicator.style.fontSize = '14px';
    loadingIndicator.style.fontWeight = '700';
    loadingIndicator.style.textShadow = OVERLAY_TEXT_SHADOW;
    overlay.appendChild(loadingIndicator);
  }

  document.body.appendChild(overlay);

  return () => {
    cancelButton.removeEventListener('click', onCancelClick);
    overlay.remove();
  };
}

export function EventScannerCamera({
  eventName,
  isProcessing,
  onBarcodeScanned,
  onCancel,
  overlayFooterLabel,
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
  const onCancelRef = useRef(onCancel);

  const [status, setStatus] = useState<ScannerStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [startAttempt, setStartAttempt] = useState(0);

  useEffect(() => {
    isProcessingRef.current = isProcessing;
  }, [isProcessing]);

  useEffect(() => {
    onBarcodeScannedRef.current = onBarcodeScanned;
  }, [onBarcodeScanned]);

  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    if (status === 'permission' || status === 'error') {
      return;
    }

    const hint = isProcessing ? 'Validating…' : 'Point at the guest pass QR code';

    return mountScannerOverlay({
      eventName,
      footerLabel: overlayFooterLabel,
      hint,
      isLoading: status === 'loading',
      onCancel: () => {
        onCancelRef.current();
      },
    });
  }, [eventName, isProcessing, overlayFooterLabel, status]);

  const assignCameraHostRef = useCallback((node: unknown) => {
    const host = (node as HTMLDivElement | null) ?? null;
    cameraHostRef.current = host;

    if (host) {
      applyCameraHostStyles(host);
    }
  }, []);

  const stopStream = useCallback(() => {
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

  const teardownCamera = useCallback(() => {
    stopStream();
    removeVideoElement(videoRef.current);
    videoRef.current = null;
  }, [stopStream]);

  const startDecodeLoop = useCallback(() => {
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }

    const canvas = canvasRef.current;
    const context = canvas.getContext('2d', { willReadFrequently: true });

    if (!context) {
      return;
    }

    scanLoopStartedRef.current = true;

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
    let cancelled = false;
    let rafId: number | null = null;
    let video: HTMLVideoElement | null = null;

    const cleanup = () => {
      cancelled = true;

      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }

      teardownCamera();
    };

    const run = async () => {
      if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setErrorMessage('Camera access is not supported in this browser.');
        setStatus('error');
        return;
      }

      if (!window.isSecureContext) {
        setErrorMessage('Camera requires HTTPS or localhost.');
        setStatus('error');
        return;
      }

      setErrorMessage(null);
      setStatus('loading');

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
          },
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        video.srcObject = stream;
        await video.play();

        if (cancelled) {
          stopStream();
          return;
        }

        setStatus('scanning');
        startDecodeLoop();
      } catch (error) {
        if (cancelled) {
          return;
        }

        const message = error instanceof Error ? error.message : 'Unable to start the camera.';
        const name = error instanceof DOMException ? error.name : '';

        stopStream();
        removeVideoElement(video);
        videoRef.current = null;

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
          return;
        }

        const host = cameraHostRef.current;

        if (!host) {
          return;
        }

        applyCameraHostStyles(host);

        video = document.createElement('video');
        applyVideoElementStyles(video);
        document.body.appendChild(video);
        videoRef.current = video;

        void run();
      });
    });

    return cleanup;
  }, [startAttempt, startDecodeLoop, stopStream, teardownCamera]);

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
    <View pointerEvents="none" style={styles.container}>
      <View ref={assignCameraHostRef} pointerEvents="none" style={styles.cameraHost} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    height: 1,
    left: 0,
    opacity: 0,
    overflow: 'hidden',
    position: 'absolute',
    top: 0,
    width: 1,
  },
  cameraHost: {
    height: 1,
    overflow: 'hidden',
    width: 1,
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
    zIndex: 1001,
  },
  permissionTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
  permissionBody: {
    color: TEXT_SECONDARY,
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
