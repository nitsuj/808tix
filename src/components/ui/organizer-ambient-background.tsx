import { StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';

import { ArtworkEnvironment } from '@/components/ui/artwork-environment';
import { EventArtwork } from '@/components/ui/event-artwork';
import { resolveOrganizerArtworkUrl } from '@/lib/event-artwork-display';
import { organizerAmbient, palette } from '@/theme';

/** TEMP visibility proof — set false after washes are confirmed on device. */
export const VISIBILITY_PROOF_LOUD = false;

export type OrganizerAmbientVariant = 'default' | 'subtle';

type OrganizerAmbientBackgroundProps = {
  eventName?: string;
  imageUrl?: string | null;
  /** Lighter washes for Dashboard, Profile, and no-artwork event fallbacks. */
  variant?: OrganizerAmbientVariant;
  style?: StyleProp<ViewStyle>;
};

type ElectricMagentaAmbienceProps = {
  intensity: OrganizerAmbientVariant;
  loud: boolean;
};

/** TEMP: high-contrast proof colors — tune down via VISIBILITY_PROOF_LOUD after QA. */
const PROOF_COLORS = {
  root: '#0A1058',
  deepBlue: 'rgba(24, 48, 255, 0.92)',
  purple: 'rgba(147, 51, 234, 0.88)',
  magenta: 'rgba(236, 72, 153, 0.88)',
} as const;

/**
 * Electric Magenta concept — layered purple / magenta / deep-blue washes.
 * Native-safe absolute Views only.
 */
function ElectricMagentaAmbience({ intensity, loud }: ElectricMagentaAmbienceProps) {
  const isSubtle = intensity === 'subtle';

  const deepBlueColor = loud
    ? PROOF_COLORS.deepBlue
    : isSubtle
      ? organizerAmbient.deepBlue.subtle
      : organizerAmbient.deepBlue.default;
  const purpleColor = loud
    ? PROOF_COLORS.purple
    : isSubtle
      ? organizerAmbient.purple.subtle
      : organizerAmbient.purple.default;
  const magentaColor = loud
    ? PROOF_COLORS.magenta
    : isSubtle
      ? organizerAmbient.magenta.subtle
      : organizerAmbient.magenta.default;

  return (
    <View style={styles.ambienceLayer}>
      <View
        style={[
          styles.wash,
          loud ? styles.proofDeepBlueWash : styles.deepBlueWash,
          { backgroundColor: deepBlueColor },
        ]}
      />
      <View
        style={[
          styles.wash,
          loud ? styles.proofPurpleWash : styles.purpleWash,
          { backgroundColor: purpleColor },
        ]}
      />
      <View
        style={[
          styles.wash,
          loud ? styles.proofMagentaWash : styles.magentaWash,
          { backgroundColor: magentaColor },
        ]}
      />
    </View>
  );
}

/** Shared Electric Magenta organizer backdrop for ops screens. */
export function OrganizerAmbientBackground({
  eventName,
  imageUrl,
  variant = 'default',
  style,
}: OrganizerAmbientBackgroundProps) {
  const { width, height } = useWindowDimensions();
  const artworkUri = resolveOrganizerArtworkUrl(imageUrl);
  const hasArtwork = Boolean(artworkUri);
  const fallbackName = eventName ?? '808Tix';
  const isSubtle = variant === 'subtle';
  const loud = VISIBILITY_PROOF_LOUD && !hasArtwork && !eventName;

  return (
    <View
      pointerEvents="none"
      style={[
        styles.root,
        { height, width },
        loud && { backgroundColor: PROOF_COLORS.root },
        style,
      ]}>
      {hasArtwork && artworkUri ? (
        <ArtworkEnvironment artworkUri={artworkUri} isUploaded />
      ) : eventName ? (
        <EventArtwork
          height={800}
          imageUrl={null}
          name={fallbackName}
          rounded={false}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <ElectricMagentaAmbience intensity={variant} loud={loud} />
      )}

      {!loud ? (
        <>
          <View
            style={[
              styles.scrimVeil,
              hasArtwork && { backgroundColor: organizerAmbient.scrim.withArtwork },
              !hasArtwork && {
                backgroundColor: isSubtle ? organizerAmbient.scrim.subtle : organizerAmbient.scrim.default,
              },
            ]}
          />
          <View
            style={[
              styles.scrimBottomVignette,
              hasArtwork && { backgroundColor: organizerAmbient.vignetteBottom.withArtwork },
              !hasArtwork && {
                backgroundColor: isSubtle
                  ? organizerAmbient.vignetteBottom.subtle
                  : organizerAmbient.vignetteBottom.default,
              },
            ]}
          />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: palette.pureBlack,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    top: 0,
    zIndex: 0,
  },
  ambienceLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  wash: {
    position: 'absolute',
  },
  deepBlueWash: {
    bottom: 0,
    left: 0,
    right: 0,
    top: '42%',
  },
  purpleWash: {
    bottom: '38%',
    left: 0,
    right: '22%',
    top: 0,
  },
  magentaWash: {
    bottom: '44%',
    left: '28%',
    right: 0,
    top: 0,
  },
  proofDeepBlueWash: {
    bottom: 0,
    left: 0,
    right: 0,
    top: '30%',
  },
  proofPurpleWash: {
    bottom: '25%',
    left: 0,
    right: '35%',
    top: 0,
  },
  proofMagentaWash: {
    bottom: '30%',
    left: '30%',
    right: 0,
    top: 0,
  },
  scrimVeil: {
    ...StyleSheet.absoluteFillObject,
  },
  scrimBottomVignette: {
    bottom: 0,
    height: '48%',
    left: 0,
    position: 'absolute',
    right: 0,
  },
});
