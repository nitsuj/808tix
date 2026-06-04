import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { ArtworkEnvironment } from '@/components/ui/artwork-environment';
import { EventArtwork } from '@/components/ui/event-artwork';
import { resolveOrganizerArtworkUrl } from '@/lib/event-artwork-display';

type ScannerArtworkBackgroundProps = {
  eventName: string;
  imageUrl?: string | null;
};

/**
 * Full-screen scanner artwork — must be position:absolute so ArtworkEnvironment
 * (height/width 100%) does not expand the flex layout and push UI off-screen.
 */
export function ScannerArtworkBackground({ eventName, imageUrl }: ScannerArtworkBackgroundProps) {
  const { width, height } = useWindowDimensions();
  const artworkUri = resolveOrganizerArtworkUrl(imageUrl);
  const hasUploadedArtwork = Boolean(artworkUri);
  const frame = { height, width };

  return (
    <View pointerEvents="none" style={[styles.layer, frame]}>
      {hasUploadedArtwork ? (
        <ArtworkEnvironment artworkUri={artworkUri!} isUploaded style={frame} />
      ) : (
        <EventArtwork
          height={height}
          imageUrl={null}
          name={eventName}
          rounded={false}
          style={StyleSheet.absoluteFill}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    top: 0,
    zIndex: 0,
  },
});
