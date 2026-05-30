import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { EventScannerCamera } from '@/components/scanner/event-scanner-camera';
import { ScanResultView } from '@/components/scanner/scan-result-view';
import { MissingProfileScreen } from '@/components/organizer/missing-profile-screen';
import { OrganizerAccent } from '@/constants/theme';
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
  const { event, isLoading, error } = useEventDetail(eventId);

  const [phase, setPhase] = useState<ScannerPhase>('camera');
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanResult, setScanResult] = useState<ScanValidationDisplay | null>(null);

  const handleScanAnother = useCallback(() => {
    setPhase('camera');
    setScanResult(null);
    setIsProcessing(false);
  }, []);

  const handleBarcodeScanned = useCallback(
    async (rawData: string) => {
      if (!eventId || isProcessing) {
        return;
      }

      const secureToken = parseScannedSecureToken(rawData);

      if (!secureToken) {
        setScanResult({
          result: 'invalid',
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
    },
    [eventId, isProcessing],
  );

  if (authGate.state === 'loading' || isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={OrganizerAccent} />
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
    return <ScanResultView result={scanResult} onScanAnother={handleScanAnother} />;
  }

  return (
    <EventScannerCamera
      eventName={event.name}
      isProcessing={isProcessing}
      onBarcodeScanned={handleBarcodeScanned}
      onCancel={() => router.back()}
    />
  );
}

const styles = StyleSheet.create({
  centered: {
    alignItems: 'center',
    backgroundColor: '#000000',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 16,
    textAlign: 'center',
  },
});
