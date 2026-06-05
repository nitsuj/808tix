import { Image } from 'expo-image';
import { StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';

import { ArtworkEnvironment } from '@/components/ui/artwork-environment';
import { EventArtwork } from '@/components/ui/event-artwork';
import { resolveOrganizerArtworkUrl } from '@/lib/event-artwork-display';
import { organizerAmbient, palette } from '@/theme';

const ELECTRIC_MAGENTA_BACKGROUND = require('@/assets/backgrounds/electric-magenta.png');

export type OrganizerAmbientVariant = 'default' | 'subtle';

type OrganizerAmbientBackgroundProps = {
  eventName?: string;
  imageUrl?: string | null;
  /** Preserved for call sites; image background is shared across variants. */
  variant?: OrganizerAmbientVariant;
  style?: StyleProp<ViewStyle>;
};

/** Shared Electric Magenta organizer backdrop for ops screens. */
export function OrganizerAmbientBackground({
  eventName,
  imageUrl,
  style,
}: OrganizerAmbientBackgroundProps) {
  const { width, height } = useWindowDimensions();
  const artworkUri = resolveOrganizerArtworkUrl(imageUrl);
  const hasArtwork = Boolean(artworkUri);
  const fallbackName = eventName ?? '808Tix';

  return (
    <View pointerEvents="none" style={[styles.root, { height, width }, style]}>
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
        <Image
          contentFit="cover"
          source={ELECTRIC_MAGENTA_BACKGROUND}
          style={StyleSheet.absoluteFill}
        />
      )}

      {hasArtwork ? (
        <>
          <View style={[styles.scrimVeil, { backgroundColor: organizerAmbient.scrim.withArtwork }]} />
          <View
            style={[styles.scrimBottomVignette, { backgroundColor: organizerAmbient.vignetteBottom.withArtwork }]}
          />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: palette.pureBlack,
    bottom: 0,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 0,
  },
  scrimVeil: {
    ...StyleSheet.absoluteFill,
  },
  scrimBottomVignette: {
    bottom: 0,
    height: '48%',
    left: 0,
    position: 'absolute',
    right: 0,
  },
});
