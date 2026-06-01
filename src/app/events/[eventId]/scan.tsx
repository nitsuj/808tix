import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { EventScannerCamera } from '@/components/scanner/event-scanner-camera';
import { ScanResultView } from '@/components/scanner/scan-result-view';
import { MissingProfileScreen } from '@/components/organizer/missing-profile-screen';
import { formatScannerCheckInFooter } from '@/lib/event-stats';
import { fan, scannerScreen, semantic } from '@/theme';
import { useEventDetail } from '@/hooks/use-event-detail';
import { useOrganizerAuthGate } from '@/hooks/use-organizer-auth-gate';
import { parseScannedSecureToken } from '@/lib/scan-payload';
import type { ScanValidationDisplay } from '@/lib/validate-pass-scan';
import { validatePassScan } from '@/lib/validate-pass-scan';

type ScannerPhase = 'camera' | 'result';

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
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={fan.primary} />
      </View>
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
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error ?? 'Event not found.'}</Text>
      </View>
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
  );
}

const styles = StyleSheet.create({
  scannerScreen: {
    backgroundColor: 'transparent',
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
});
