import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EventScannerCamera } from '@/components/scanner/event-scanner-camera';
import { ScanResultView } from '@/components/scanner/scan-result-view';
import { ScannerArtworkBackground } from '@/components/scanner/scanner-artwork-background';
import { MissingProfileScreen } from '@/components/organizer/missing-profile-screen';
import { OrganizerMobileViewport } from '@/components/ui/organizer-mobile-viewport';
import { Radii, Spacing } from '@/constants/theme';
import { formatEventDateTimeLong } from '@/lib/event-datetime-display';
import { formatVenueLine } from '@/lib/event-display';
import { formatScannerCheckInFooter } from '@/lib/event-stats';
import { chrome, fan, palette, scannerScreen, text } from '@/theme';
import { useEventDetail } from '@/hooks/use-event-detail';
import { useOrganizerAuthGate } from '@/hooks/use-organizer-auth-gate';
import { useOrganizerAuthRedirect } from '@/hooks/use-organizer-auth-redirect';
import { canScanPassesForEvent, PUBLISH_BEFORE_SCAN_MESSAGE } from '@/lib/event-status';
import { parseScannedSecureToken } from '@/lib/scan-payload';
import { ORGANIZER_DASHBOARD_ROUTE, safeRouterBack } from '@/lib/safe-router-back';
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

  const eventDateLine = useMemo(() => {
    const formatted = formatEventDateTimeLong(event?.event_date ?? null, event?.start_time ?? null);
    return formatted ? formatted.toUpperCase() : null;
  }, [event?.event_date, event?.start_time]);

  const venueLine = event?.venue_name?.trim() ? formatVenueLine(event.venue_name) : null;

  useEffect(() => {
    isProcessingRef.current = isProcessing;
  }, [isProcessing]);

  const handleScanAnother = useCallback(() => {
    setPhase('camera');
    setScanResult(null);
    setIsProcessing(false);
  }, []);

  const handleCancel = useCallback(() => {
    safeRouterBack(router, ORGANIZER_DASHBOARD_ROUTE);
  }, [router]);

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

  useOrganizerAuthRedirect(authGate.state);

  if (showInitialGate) {
    return (
      <OrganizerMobileViewport>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={fan.primary} />
        </View>
      </OrganizerMobileViewport>
    );
  }

  if (authGate.state === 'unauthenticated') {
    return null;
  }

  if (authGate.state === 'profile_missing') {
    return <MissingProfileScreen email={authGate.email} onSignOut={authGate.signOut} />;
  }

  if (error || !event || !eventId) {
    return (
      <ScannerStateShell onBack={handleCancel}>
        <Text style={styles.stateTitle}>Could not load event</Text>
        <Text style={styles.stateBody}>{error ?? 'Event not found.'}</Text>
      </ScannerStateShell>
    );
  }

  if (!canScanPassesForEvent(event.status)) {
    return (
      <ScannerStateShell onBack={handleCancel}>
        <Text style={styles.stateTitle}>Event is still a draft</Text>
        <Text style={styles.stateBody}>{PUBLISH_BEFORE_SCAN_MESSAGE}</Text>
        <Pressable
          onPress={handleCancel}
          style={({ pressed }) => [styles.stateCta, pressed && styles.pressed]}>
          <Text style={styles.stateCtaText}>Back to Event</Text>
        </Pressable>
      </ScannerStateShell>
    );
  }

  if (phase === 'result' && scanResult) {
    return (
      <ScanResultView
        checkInFooterLabel={checkInFooterLabel}
        eventDateLine={eventDateLine}
        eventName={event.name}
        imageUrl={event.image_url}
        result={scanResult}
        venueLine={venueLine}
        onScanAnother={handleScanAnother}
      />
    );
  }

  return (
    <OrganizerMobileViewport
      background={
        <ScannerArtworkBackground eventName={event.name} imageUrl={event.image_url} />
      }>
      <View style={styles.scannerScreen}>
        <EventScannerCamera
          eventDateLine={eventDateLine}
          eventName={event.name}
          hideArtworkBackground
          imageUrl={event.image_url}
          isProcessing={isProcessing}
          overlayFooterLabel={checkInFooterLabel}
          venueLine={venueLine}
          onBarcodeScanned={handleBarcodeScanned}
          onCancel={handleCancel}
        />
      </View>
    </OrganizerMobileViewport>
  );
}

function ScannerStateShell({
  children,
  onBack,
}: {
  children: React.ReactNode;
  onBack: () => void;
}) {
  return (
    <OrganizerMobileViewport>
      <View style={styles.stateScreen}>
        <SafeAreaView edges={['top', 'bottom']} style={styles.stateSafeArea}>
          <Pressable onPress={onBack} style={styles.backHit}>
            <Text style={styles.backText}>← Event</Text>
          </Pressable>
          <View style={styles.statePanel}>{children}</View>
        </SafeAreaView>
      </View>
    </OrganizerMobileViewport>
  );
}

const styles = StyleSheet.create({
  scannerScreen: {
    backgroundColor: 'transparent',
    flex: 1,
    overflow: 'hidden',
    width: '100%',
  },
  centered: {
    alignItems: 'center',
    backgroundColor: scannerScreen.overlay.background,
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  stateScreen: {
    backgroundColor: palette.pureBlack,
    flex: 1,
  },
  stateSafeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
  },
  backHit: {
    paddingVertical: Spacing.one,
  },
  backText: {
    color: fan.badgeText,
    fontSize: 15,
    fontWeight: '700',
  },
  statePanel: {
    alignItems: 'center',
    backgroundColor: chrome.glass.fill,
    borderColor: chrome.glass.border,
    borderRadius: Radii.card,
    borderWidth: 1,
    flex: 1,
    gap: Spacing.three,
    justifyContent: 'center',
    marginBottom: Spacing.six,
    marginTop: Spacing.four,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.five,
  },
  stateTitle: {
    color: text.primary,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  stateBody: {
    color: text.secondary,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  stateCta: {
    alignItems: 'center',
    backgroundColor: fan.primary,
    borderRadius: Radii.button,
    marginTop: Spacing.two,
    minWidth: 160,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  stateCtaText: {
    color: chrome.white,
    fontSize: 16,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.88,
  },
});
