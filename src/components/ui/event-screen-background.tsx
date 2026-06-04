import { StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';

import { ArtworkEnvironment } from '@/components/ui/artwork-environment';
import { resolveEventScreenBackgroundArtwork } from '@/lib/event-artwork-display';

type EventScreenBackgroundProps = {
  eventName: string;
  imageUrl?: string | null;
  pendingLocalUri?: string | null;
  debugArtworkLogging?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Full-bleed event hero background — explicit window size so expo-image can lay out like EventArtwork cards. */
export function EventScreenBackground({
  eventName,
  imageUrl,
  pendingLocalUri,
  debugArtworkLogging = false,
  style,
}: EventScreenBackgroundProps) {
  const { width, height } = useWindowDimensions();
  const artwork = resolveEventScreenBackgroundArtwork(imageUrl, eventName, pendingLocalUri);
  const frameStyle = { height, width };

  return (
    <View pointerEvents="none" style={[styles.root, frameStyle, style]}>
      <ArtworkEnvironment
        artworkUri={artwork.uri}
        debugArtworkLogging={debugArtworkLogging}
        isUploaded={artwork.isUploaded}
        style={frameStyle}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    top: 0,
    zIndex: 0,
  },
});
