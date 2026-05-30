import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { ArtworkEnvironment } from '@/components/ui/artwork-environment';
import { EventArtwork } from '@/components/ui/event-artwork';
import { resolveOrganizerArtworkUrl } from '@/lib/event-artwork-display';

type ScannerArtworkBackgroundProps = {
  eventName: string;
  imageUrl?: string | null;
};

export function ScannerArtworkBackground({ eventName, imageUrl }: ScannerArtworkBackgroundProps) {
  const { height: windowHeight } = useWindowDimensions();
  const artworkUri = resolveOrganizerArtworkUrl(imageUrl);
  const hasUploadedArtwork = Boolean(artworkUri);

  if (hasUploadedArtwork) {
    return <ArtworkEnvironment artworkUri={artworkUri!} isUploaded />;
  }

  return (
    <View style={[styles.fallbackLayer, { height: windowHeight }]}>
      <EventArtwork
        height={windowHeight}
        imageUrl={null}
        name={eventName}
        rounded={false}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fallbackLayer: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
  },
});
