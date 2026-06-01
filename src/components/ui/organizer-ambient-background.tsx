import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ArtworkEnvironment } from '@/components/ui/artwork-environment';
import { EventArtwork } from '@/components/ui/event-artwork';
import { chrome } from '@/theme';

type OrganizerAmbientBackgroundProps = {
  eventName?: string;
  imageUrl?: string | null;
  style?: StyleProp<ViewStyle>;
};

export function OrganizerAmbientBackground({
  eventName,
  imageUrl,
  style,
}: OrganizerAmbientBackgroundProps) {
  const hasArtwork = Boolean(imageUrl?.trim());
  const artworkUri = imageUrl?.trim();
  const fallbackName = eventName ?? '808Tix';

  return (
    <View pointerEvents="none" style={[styles.root, style]}>
      {hasArtwork && artworkUri ? (
        <ArtworkEnvironment artworkUri={artworkUri} isUploaded />
      ) : eventName ? (
        <EventArtwork height={800} imageUrl={null} name={fallbackName} rounded={false} style={StyleSheet.absoluteFill} />
      ) : (
        <>
          <View style={styles.ambientTop} />
          <View style={styles.ambientBottom} />
        </>
      )}
      <View style={styles.scrim} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: chrome.screen.background,
    overflow: 'hidden',
  },
  ambientTop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: chrome.screen.ambientTop,
    bottom: '45%',
  },
  ambientBottom: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: chrome.screen.ambientBottom,
    top: '55%',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: chrome.screen.scrim,
  },
});
