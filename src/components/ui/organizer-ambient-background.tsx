import { Image } from 'expo-image';
import { StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';

import { ArtworkEnvironment } from '@/components/ui/artwork-environment';
import { EventArtwork } from '@/components/ui/event-artwork';
import { resolveOrganizerArtworkUrl } from '@/lib/event-artwork-display';
import { palette } from '@/theme';
import { platformPointerEventsNone } from '@/theme/platform-styles';

const ORGANIZER_BACKGROUND = require('@/assets/backgrounds/organizer-background.png');

/** Readability overlays when uploaded artwork replaces the branded background. */
const UPLOADED_ARTWORK_SCRIM = 'rgba(8, 8, 8, 0.28)';
const UPLOADED_ARTWORK_VIGNETTE = 'rgba(0, 0, 0, 0.42)';

export type OrganizerAmbientVariant = 'default' | 'subtle';

type OrganizerAmbientBackgroundProps = {
  eventName?: string;
  imageUrl?: string | null;
  /** Preserved for call sites; branded image background is shared across variants. */
  variant?: OrganizerAmbientVariant;
  style?: StyleProp<ViewStyle>;
};

/** Shared 808Tix organizer backdrop — approved brand asset, full-bleed cover. */
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
    <View style={[styles.root, platformPointerEventsNone(), { height, width }, style]}>
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
        <Image contentFit="cover" source={ORGANIZER_BACKGROUND} style={StyleSheet.absoluteFill} />
      )}

      {hasArtwork ? (
        <>
          <View style={[styles.scrimVeil, { backgroundColor: UPLOADED_ARTWORK_SCRIM }]} />
          <View style={[styles.scrimBottomVignette, { backgroundColor: UPLOADED_ARTWORK_VIGNETTE }]} />
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
