import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { EventScannerCamera } from '@/components/scanner/event-scanner-camera';
import { ScanResultView } from '@/components/scanner/scan-result-view';
import { MissingProfileScreen } from '@/components/organizer/missing-profile-screen';
import { formatScannerCheckInFooter } from '@/lib/event-stats';
import { fan, palette, scannerScreen, semantic } from '@/theme';
import { useEventDetail } from '@/hooks/use-event-detail';
import { useOrganizerAuthGate } from '@/hooks/use-organizer-auth-gate';
import { canScanPassesForEvent, PUBLISH_BEFORE_SCAN_MESSAGE } from '@/lib/event-status';
import { parseScannedSecureToken } from '@/lib/scan-payload';
import type { ScanValidationDisplay } from '@/lib/validate-pass-scan';
import { validatePassScan } from '@/lib/validate-pass-scan';

type ScannerPhase = 'camera' | 'result';

const MOBILE_VIEWPORT_WIDTH = 390;
const webViewportMinHeight =
  Platform.OS === 'web' ? ({ minHeight: '100dvh' } as const) : null;

export default function EventScannerScreen() {
  const router = useRouter();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const authGate = useOrganizerAuthGate();
  const { event, stats, isLoading, error, refetch } = useEventDetail(eventId);

  const [phase, setPhase] = useState<ScannerPhase>('camera');
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanResult, setScanResult] = useState<ScanValidationDisplay | null>(null);
  const isProcessingRef = useRef(isProcessing);

  const checkInFooterLabel = formatScannerCheckInFooter(stats);

  useEffect(() => {
    isProcessingRef.current = isProcessing;
  }, [isProcessing]);

  const handleScanAnother = useCallback(() => {
    setPhase('camera');
    setScanResult(null);
    setIsProcessing(false);
  }, []);

  const handleCancel = useCallback(() => {
    if (!eventId) {
      return;
    }

    router.replace(`/events/${eventId}` as Href);
  }, [eventId, router]);

  const handleBarcodeScanned = useCallback(
    async (rawData: string) => {
      if (!eventId || isProcessingRef.current) {
        return;
      }

      const secureToken = parseScannedSecureToken(rawData);

      if (!secureToken) {
        setScanResult({
          result: 'invalid',
          clientReason: 'not_808tix_pass',
        });
        setPhase('result');
        return;
      }

      setIsProcessing(true);

      const outcome = await validatePassScan(secureToken, eventId);

      setIsProcessing(false);

      if (!outcome.ok) {
        setScanResult({ result: 'invalid' });
        setPhase('result');
        return;
      }

      setScanResult(outcome.data);
      setPhase('result');

      if (outcome.data.result === 'valid') {
        await refetch();
      }
    },
    [eventId, refetch],
  );

  const showInitialGate = (authGate.state === 'loading' || isLoading) && !event;

  if (showInitialGate) {
    return (
      <MobileViewport>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={fan.primary} />
        </View>
      </MobileViewport>
    );
  }

  if (authGate.state === 'unauthenticated') {
    router.replace('/');
    return null;
  }

  if (authGate.state === 'profile_missing') {
    return <MissingProfileScreen email={authGate.email} onSignOut={authGate.signOut} />;
  }

  if (error || !event || !eventId) {
    return (
      <MobileViewport>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error ?? 'Event not found.'}</Text>
        </View>
      </MobileViewport>
    );
  }

  if (!canScanPassesForEvent(event.status)) {
    return (
      <MobileViewport>
        <View style={styles.centered}>
          <Text style={styles.blockedTitle}>Event is still a draft</Text>
          <Text style={styles.blockedBody}>{PUBLISH_BEFORE_SCAN_MESSAGE}</Text>
          <Pressable onPress={handleCancel} style={({ pressed }) => [styles.blockedCta, pressed && styles.pressed]}>
            <Text style={styles.blockedCtaText}>Back to Event</Text>
          </Pressable>
        </View>
      </MobileViewport>
    );
  }

  if (phase === 'result' && scanResult) {
    return (
      <ScanResultView
        checkInFooterLabel={checkInFooterLabel}
        eventName={event.name}
        imageUrl={event.image_url}
        result={scanResult}
        onScanAnother={handleScanAnother}
      />
    );
  }

  return (
    <MobileViewport>
      <View style={styles.scannerScreen}>
        <EventScannerCamera
          eventName={event.name}
          imageUrl={event.image_url}
          isProcessing={isProcessing}
          overlayFooterLabel={checkInFooterLabel}
          onBarcodeScanned={handleBarcodeScanned}
          onCancel={handleCancel}
        />
      </View>
    </MobileViewport>
  );
}

function MobileViewport({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.viewportOuter}>
      <View style={styles.viewportInner}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  viewportOuter: {
    alignItems: 'center',
    backgroundColor: palette.pureBlack,
    flex: 1,
  },
  viewportInner: {
    backgroundColor: palette.pureBlack,
    flex: 1,
    maxWidth: MOBILE_VIEWPORT_WIDTH,
    width: '100%',
    ...webViewportMinHeight,
  },
  scannerScreen: {
    backgroundColor: palette.pureBlack,
    flex: 1,
    height: '100%',
    minHeight: '100%',
    width: '100%',
  },
  centered: {
    alignItems: 'center',
    backgroundColor: scannerScreen.overlay.background,
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  errorText: {
    color: semantic.errorSoft,
    fontSize: 16,
    textAlign: 'center',
  },
  blockedTitle: {
    color: palette.white,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  blockedBody: {
    color: scannerScreen.overlay.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 24,
    textAlign: 'center',
  },
  blockedCta: {
    backgroundColor: fan.primary,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  blockedCtaText: {
    color: palette.white,
    fontSize: 15,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.85,
  },
});
