import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ArtworkEnvironment } from '@/components/ui/artwork-environment';
import { resolveEventScreenBackgroundArtwork } from '@/lib/event-artwork-display';
import { palette } from '@/theme';

type EventScreenBackgroundProps = {
  eventName: string;
  imageUrl?: string | null;
  pendingLocalUri?: string | null;
  style?: StyleProp<ViewStyle>;
};

/** Full-bleed event hero background — same resolver path as Event Detail. */
export function EventScreenBackground({
  eventName,
  imageUrl,
  pendingLocalUri,
  style,
}: EventScreenBackgroundProps) {
  const artwork = resolveEventScreenBackgroundArtwork(imageUrl, eventName, pendingLocalUri);

  return (
    <View pointerEvents="none" style={[styles.root, style]}>
      <ArtworkEnvironment artworkUri={artwork.uri} isUploaded={artwork.isUploaded} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: palette.black,
    overflow: 'hidden',
    zIndex: 0,
  },
});
