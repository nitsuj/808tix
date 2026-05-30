import jsQR from 'jsqr';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { resolveOrganizerArtworkUrl } from '@/lib/event-artwork-display';
import { artwork, organizer, radius, scannerScreen, spacing } from '@/theme';

type EventScannerCameraProps = {
  eventName: string;
  imageUrl?: string | null;
  isProcessing: boolean;
  onBarcodeScanned: (rawData: string) => void;
  onCancel: () => void;
  overlayFooterLabel?: string;
};

type ScannerStatus = 'loading' | 'permission' | 'scanning' | 'error';

type ScannerStack = {
  root: HTMLDivElement;
  artworkSlot: HTMLDivElement;
  scrimSlot: HTMLDivElement;
  uiSlot: HTMLDivElement;
  scanSquareSlot: HTMLDivElement;
  hintSlot: HTMLDivElement;
  topBarSlot: HTMLDivElement;
  footerSlot: HTMLDivElement;
};

const SCAN_DEBOUNCE_MS = 1500;
const STACK_ID = '808tix-scanner-stack';
const STACK_Z_INDEX = '10000';
const TEXT_SECONDARY = scannerScreen.overlay.textSecondary;
const OVERLAY_TEXT_SHADOW = scannerScreen.frame.webTextShadow;

function hashName(name: string): number {
  let hash = 0;

  for (let index = 0; index < name.length; index += 1) {
    hash = (hash << 5) - hash + name.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash);
}

function paletteForName(name: string) {
  const palettes = [
    { base: '#2A1040', accent: '#A25BFF', glow: '#C084FC' },
    { base: '#101828', accent: '#39FF14', glow: '#A25BFF' },
    { base: '#1A0A28', accent: '#C084FC', glow: '#7B3DB8' },
    { base: '#0A1628', accent: '#39FF14', glow: '#A25BFF' },
  ];

  return palettes[hashName(name) % palettes.length];
}

function getScannerFrameSize(): number {
  return Math.min(Math.round(window.innerWidth * 0.72), 320);
}

function applyFixedLayerStyles(element: HTMLElement) {
  element.style.position = 'absolute';
  element.style.top = '0';
  element.style.left = '0';
  element.style.right = '0';
  element.style.bottom = '0';
}

function syncScanSquareSize(scanSquare: HTMLDivElement) {
  const frameSize = getScannerFrameSize();
  scanSquare.style.width = `${frameSize}px`;
  scanSquare.style.height = `${frameSize}px`;
}

function mountFrameOverlay(scanSquare: HTMLDivElement) {
  const frameBorder = document.createElement('div');
  frameBorder.dataset.scannerFrame = 'border';
  frameBorder.style.position = 'absolute';
  frameBorder.style.inset = '0';
  frameBorder.style.border = `2px solid ${organizer.accent}`;
  frameBorder.style.borderRadius = `${radius.card}px`;
  frameBorder.style.boxSizing = 'border-box';
  frameBorder.style.backgroundColor = scannerScreen.frame.inset;
  frameBorder.style.pointerEvents = 'none';
  frameBorder.style.zIndex = '2';
  frameBorder.style.boxShadow = scannerScreen.frame.webBoxShadow;

  const cornerStyle = {
    position: 'absolute',
    width: '22px',
    height: '22px',
    borderColor: organizer.accent,
    pointerEvents: 'none',
    zIndex: '3',
  } as const;

  const cornerTL = document.createElement('div');
  Object.assign(cornerTL.style, cornerStyle, {
    top: '-1px',
    left: '-1px',
    borderTopWidth: '3px',
    borderLeftWidth: '3px',
    borderTopLeftRadius: `${radius.card}px`,
  });

  const cornerTR = document.createElement('div');
  Object.assign(cornerTR.style, cornerStyle, {
    top: '-1px',
    right: '-1px',
    borderTopWidth: '3px',
    borderRightWidth: '3px',
    borderTopRightRadius: `${radius.card}px`,
  });

  const cornerBL = document.createElement('div');
  Object.assign(cornerBL.style, cornerStyle, {
    bottom: '-1px',
    left: '-1px',
    borderBottomWidth: '3px',
    borderLeftWidth: '3px',
    borderBottomLeftRadius: `${radius.card}px`,
  });

  const cornerBR = document.createElement('div');
  Object.assign(cornerBR.style, cornerStyle, {
    bottom: '-1px',
    right: '-1px',
    borderBottomWidth: '3px',
    borderRightWidth: '3px',
    borderBottomRightRadius: `${radius.card}px`,
  });

  scanSquare.appendChild(frameBorder);
  scanSquare.appendChild(cornerTL);
  scanSquare.appendChild(cornerTR);
  scanSquare.appendChild(cornerBL);
  scanSquare.appendChild(cornerBR);
}

function createScannerStack(): ScannerStack {
  const existing = document.getElementById(STACK_ID) as HTMLDivElement | null;

  if (existing) {
    existing.remove();
  }

  const root = document.createElement('div');
  root.id = STACK_ID;
  root.style.position = 'fixed';
  root.style.top = '0';
  root.style.left = '0';
  root.style.right = '0';
  root.style.bottom = '0';
  root.style.width = '100vw';
  root.style.height = '100vh';
  root.style.zIndex = STACK_Z_INDEX;
  root.style.pointerEvents = 'none';
  root.style.overflow = 'hidden';

  const artworkSlot = document.createElement('div');
  applyFixedLayerStyles(artworkSlot);
  artworkSlot.style.zIndex = '1';

  const scrimSlot = document.createElement('div');
  applyFixedLayerStyles(scrimSlot);
  scrimSlot.style.zIndex = '2';

  const uiSlot = document.createElement('div');
  applyFixedLayerStyles(uiSlot);
  uiSlot.style.zIndex = '4';
  uiSlot.style.display = 'flex';
  uiSlot.style.flexDirection = 'column';
  uiSlot.style.pointerEvents = 'none';

  const topBarSlot = document.createElement('div');
  topBarSlot.style.flexShrink = '0';

  const centerBlock = document.createElement('div');
  centerBlock.style.flex = '1';
  centerBlock.style.display = 'flex';
  centerBlock.style.flexDirection = 'column';
  centerBlock.style.alignItems = 'center';
  centerBlock.style.justifyContent = 'center';
  centerBlock.style.gap = `${spacing.three}px`;
  centerBlock.style.pointerEvents = 'none';

  const scanSquareSlot = document.createElement('div');
  scanSquareSlot.style.position = 'relative';
  scanSquareSlot.style.overflow = 'hidden';
  scanSquareSlot.style.borderRadius = `${radius.card}px`;
  scanSquareSlot.style.flexShrink = '0';
  syncScanSquareSize(scanSquareSlot);
  mountFrameOverlay(scanSquareSlot);

  const hintSlot = document.createElement('div');
  hintSlot.style.pointerEvents = 'none';

  centerBlock.appendChild(scanSquareSlot);
  centerBlock.appendChild(hintSlot);

  const footerSlot = document.createElement('div');
  footerSlot.style.flexShrink = '0';

  uiSlot.appendChild(topBarSlot);
  uiSlot.appendChild(centerBlock);
  uiSlot.appendChild(footerSlot);

  root.appendChild(artworkSlot);
  root.appendChild(scrimSlot);
  root.appendChild(uiSlot);
  document.body.appendChild(root);

  return {
    root,
    artworkSlot,
    scrimSlot,
    uiSlot,
    scanSquareSlot,
    hintSlot,
    topBarSlot,
    footerSlot,
  };
}

function destroyScannerStack() {
  document.getElementById(STACK_ID)?.remove();
}

function mountArtworkLayer(
  slot: HTMLDivElement,
  imageUrl: string | null | undefined,
  eventName: string,
) {
  slot.replaceChildren();

  const artworkUri = resolveOrganizerArtworkUrl(imageUrl);

  if (artworkUri) {
    const image = document.createElement('img');
    image.src = artworkUri;
    image.alt = '';
    image.style.width = '100%';
    image.style.height = '100%';
    image.style.objectFit = 'cover';

    const tint = document.createElement('div');
    applyFixedLayerStyles(tint);
    tint.style.backgroundColor = artwork.uploadedTint;

    const bottomScrim = document.createElement('div');
    applyFixedLayerStyles(bottomScrim);
    bottomScrim.style.top = '58%';
    bottomScrim.style.backgroundColor = artwork.uploadedBottomScrim;

    slot.appendChild(image);
    slot.appendChild(tint);
    slot.appendChild(bottomScrim);
    return;
  }

  const palette = paletteForName(eventName);
  const gradient = document.createElement('div');
  applyFixedLayerStyles(gradient);
  gradient.style.backgroundColor = palette.base;

  const glowOrb = document.createElement('div');
  glowOrb.style.position = 'absolute';
  glowOrb.style.top = '-20%';
  glowOrb.style.right = '-10%';
  glowOrb.style.width = '70%';
  glowOrb.style.height = '70%';
  glowOrb.style.borderRadius = '999px';
  glowOrb.style.backgroundColor = palette.accent;
  glowOrb.style.opacity = '0.35';
  glowOrb.style.filter = 'blur(48px)';

  const glowOrbSmall = document.createElement('div');
  glowOrbSmall.style.position = 'absolute';
  glowOrbSmall.style.bottom = '-10%';
  glowOrbSmall.style.left = '-5%';
  glowOrbSmall.style.width = '50%';
  glowOrbSmall.style.height = '50%';
  glowOrbSmall.style.borderRadius = '999px';
  glowOrbSmall.style.backgroundColor = palette.glow;
  glowOrbSmall.style.opacity = '0.28';
  glowOrbSmall.style.filter = 'blur(40px)';

  gradient.appendChild(glowOrb);
  gradient.appendChild(glowOrbSmall);
  slot.appendChild(gradient);
}

function mountScrimLayer(slot: HTMLDivElement) {
  slot.replaceChildren();

  const scrim = document.createElement('div');
  applyFixedLayerStyles(scrim);
  scrim.style.backgroundColor = scannerScreen.cameraScrim;
  slot.appendChild(scrim);
}

function applyVideoElementStyles(video: HTMLVideoElement) {
  video.autoplay = true;
  video.playsInline = true;
  video.muted = true;
  video.setAttribute('autoplay', '');
  video.setAttribute('playsinline', '');
  video.setAttribute('muted', '');
  video.style.position = 'absolute';
  video.style.top = '0';
  video.style.left = '0';
  video.style.width = '100%';
  video.style.height = '100%';
  video.style.objectFit = 'cover';
  video.style.opacity = '1';
  video.style.backgroundColor = scannerScreen.overlay.background;
  video.style.pointerEvents = 'none';
  video.style.zIndex = '1';
}

function removeVideoElement(video: HTMLVideoElement | null) {
  if (!video) {
    return;
  }

  video.srcObject = null;

  if (video.parentElement) {
    video.parentElement.removeChild(video);
  }
}

function mountScannerUiLayer(
  stack: ScannerStack,
  options: {
    eventName: string;
    footerLabel?: string;
    hint: string;
    isLoading: boolean;
    onCancel: () => void;
  },
) {
  stack.topBarSlot.replaceChildren();
  stack.hintSlot.replaceChildren();
  stack.footerSlot.replaceChildren();
  stack.scanSquareSlot.querySelectorAll('[data-scanner-loading]').forEach((node) => {
    node.remove();
  });

  const topBar = document.createElement('div');
  topBar.style.display = 'flex';
  topBar.style.alignItems = 'flex-start';
  topBar.style.justifyContent = 'space-between';
  topBar.style.padding = `${spacing.five}px ${spacing.four}px 0`;
  topBar.style.pointerEvents = 'none';

  const cancelButton = document.createElement('button');
  cancelButton.type = 'button';
  cancelButton.textContent = 'Cancel';
  cancelButton.style.pointerEvents = 'auto';
  cancelButton.style.background = 'transparent';
  cancelButton.style.border = 'none';
  cancelButton.style.color = organizer.accent;
  cancelButton.style.cursor = 'pointer';
  cancelButton.style.fontSize = '16px';
  cancelButton.style.fontWeight = '600';
  cancelButton.style.padding = `${spacing.one}px 0`;
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
  eventHeader.style.gap = `${spacing.half}px`;
  eventHeader.style.padding = `0 ${spacing.two}px`;

  const scanningLabel = document.createElement('div');
  scanningLabel.textContent = 'SCANNING';
  scanningLabel.style.color = organizer.accent;
  scanningLabel.style.fontSize = '11px';
  scanningLabel.style.fontWeight = '800';
  scanningLabel.style.letterSpacing = '2.4px';
  scanningLabel.style.textShadow = OVERLAY_TEXT_SHADOW;

  const eventName = document.createElement('div');
  eventName.textContent = options.eventName;
  eventName.style.color = scannerScreen.overlay.text;
  eventName.style.fontSize = '17px';
  eventName.style.fontWeight = '700';
  eventName.style.lineHeight = '22px';
  eventName.style.textAlign = 'center';
  eventName.style.textShadow = OVERLAY_TEXT_SHADOW;

  eventHeader.appendChild(scanningLabel);
  eventHeader.appendChild(eventName);

  const topSpacer = document.createElement('div');
  topSpacer.style.minWidth = '56px';

  topBar.appendChild(cancelButton);
  topBar.appendChild(eventHeader);
  topBar.appendChild(topSpacer);
  stack.topBarSlot.appendChild(topBar);

  const hint = document.createElement('div');
  hint.textContent = options.hint;
  hint.style.color = scannerScreen.overlay.text;
  hint.style.fontSize = '15px';
  hint.style.fontWeight = '600';
  hint.style.maxWidth = '320px';
  hint.style.textAlign = 'center';
  hint.style.textShadow = OVERLAY_TEXT_SHADOW;
  stack.hintSlot.appendChild(hint);

  if (options.footerLabel) {
    const footer = document.createElement('div');
    footer.style.display = 'flex';
    footer.style.justifyContent = 'center';
    footer.style.padding = `0 ${spacing.four}px ${spacing.five}px`;
    footer.style.pointerEvents = 'none';

    const footerPill = document.createElement('div');
    footerPill.style.backgroundColor = scannerScreen.footer.pillBackground;
    footerPill.style.border = `1px solid ${organizer.accent}`;
    footerPill.style.borderRadius = `${radius.input}px`;
    footerPill.style.padding = `${spacing.two}px ${spacing.four}px`;

    const footerText = document.createElement('div');
    footerText.textContent = options.footerLabel;
    footerText.style.color = scannerScreen.overlay.text;
    footerText.style.fontSize = '14px';
    footerText.style.fontWeight = '700';
    footerText.style.letterSpacing = '0.3px';
    footerText.style.textShadow = OVERLAY_TEXT_SHADOW;

    footerPill.appendChild(footerText);
    footer.appendChild(footerPill);
    stack.footerSlot.appendChild(footer);
  }

  if (options.isLoading) {
    const loadingIndicator = document.createElement('div');
    loadingIndicator.dataset.scannerLoading = 'true';
    loadingIndicator.textContent = 'Starting camera…';
    loadingIndicator.style.position = 'absolute';
    loadingIndicator.style.top = '50%';
    loadingIndicator.style.left = '50%';
    loadingIndicator.style.transform = 'translate(-50%, -50%)';
    loadingIndicator.style.color = organizer.accent;
    loadingIndicator.style.fontSize = '14px';
    loadingIndicator.style.fontWeight = '700';
    loadingIndicator.style.textShadow = OVERLAY_TEXT_SHADOW;
    loadingIndicator.style.zIndex = '5';
    loadingIndicator.style.pointerEvents = 'none';
    stack.scanSquareSlot.appendChild(loadingIndicator);
  }

  return () => {
    cancelButton.removeEventListener('click', onCancelClick);
    stack.topBarSlot.replaceChildren();
    stack.hintSlot.replaceChildren();
    stack.footerSlot.replaceChildren();
    stack.scanSquareSlot.querySelectorAll('[data-scanner-loading]').forEach((node) => {
      node.remove();
    });
  };
}

export function EventScannerCamera({
  eventName,
  imageUrl,
  isProcessing,
  onBarcodeScanned,
  onCancel,
  overlayFooterLabel,
}: EventScannerCameraProps) {
  const stackRef = useRef<ScannerStack | null>(null);
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
      destroyScannerStack();
      stackRef.current = null;
      return;
    }

    let stack = stackRef.current;

    if (!stack) {
      stack = createScannerStack();
      stackRef.current = stack;
    }

    syncScanSquareSize(stack.scanSquareSlot);
    mountArtworkLayer(stack.artworkSlot, imageUrl, eventName);
    mountScrimLayer(stack.scrimSlot);

    const hint = isProcessing ? 'Validating…' : 'Point at the guest pass QR code';
    const cleanupUi = mountScannerUiLayer(stack, {
      eventName,
      footerLabel: overlayFooterLabel,
      hint,
      isLoading: status === 'loading',
      onCancel: () => {
        onCancelRef.current();
      },
    });

    const handleResize = () => {
      if (!stackRef.current) {
        return;
      }

      syncScanSquareSize(stackRef.current.scanSquareSlot);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cleanupUi();
    };
  }, [eventName, imageUrl, isProcessing, overlayFooterLabel, status]);

  useEffect(() => {
    return () => {
      destroyScannerStack();
      stackRef.current = null;
    };
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
    if (status === 'permission' || status === 'error') {
      return;
    }

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

    const mountVideoWhenReady = () => {
      if (cancelled) {
        return;
      }

      const stack = stackRef.current;

      if (!stack) {
        rafId = requestAnimationFrame(mountVideoWhenReady);
        return;
      }

      syncScanSquareSize(stack.scanSquareSlot);

      video = document.createElement('video');
      applyVideoElementStyles(video);
      stack.scanSquareSlot.insertBefore(video, stack.scanSquareSlot.firstChild);
      videoRef.current = video;

      void run();
    };

    rafId = requestAnimationFrame(() => {
      rafId = requestAnimationFrame(mountVideoWhenReady);
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

  return <View pointerEvents="none" style={styles.hiddenHost} />;
}

const styles = StyleSheet.create({
  hiddenHost: {
    height: 1,
    left: 0,
    opacity: 0,
    overflow: 'hidden',
    position: 'absolute',
    top: 0,
    width: 1,
  },
  permissionContainer: {
    backgroundColor: scannerScreen.overlay.background,
    bottom: 0,
    flex: 1,
    gap: spacing.three,
    height: '100%',
    justifyContent: 'center',
    left: 0,
    minHeight: '100dvh',
    paddingHorizontal: spacing.five,
    position: 'fixed',
    right: 0,
    top: 0,
    width: '100%',
    zIndex: 10001,
  },
  permissionTitle: {
    color: scannerScreen.overlay.text,
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
