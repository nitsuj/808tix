import { Image } from 'expo-image';
import { Platform, StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';

import { resolveEventArtworkPublicUrl } from '@/lib/event-artwork-storage';
import { artwork, fan, palette } from '@/theme';
import { platformPointerEventsNone } from '@/theme/platform-styles';

const webBlurStyle =
  Platform.OS === 'web' ? ({ filter: `blur(${artwork.blurRadius}px)` } as ViewStyle) : null;

type ArtworkEnvironmentProps = {
  artworkUri: string;
  /** True when showing uploaded event artwork (sharper, lighter overlays). */
  isUploaded?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Absolute-fill background artwork. Single cover image fills the frame; overlays sit above.
 */
export function ArtworkEnvironment({
  artworkUri,
  isUploaded = false,
  style,
}: ArtworkEnvironmentProps) {
  const { width, height } = useWindowDimensions();
  const resolvedArtworkUri = resolveEventArtworkPublicUrl(artworkUri) ?? artworkUri;
  const useBlur = !isUploaded;
  const blurRadius = useBlur && Platform.OS !== 'web' ? artwork.blurRadius : 0;
  const uploadedCachePolicy = Platform.OS === 'web' ? 'none' : 'memory-disk';

  return (
    <View style={[styles.environment, platformPointerEventsNone(), style]}>
      {resolvedArtworkUri ? (
        <Image
          blurRadius={blurRadius}
          cachePolicy={isUploaded ? uploadedCachePolicy : 'memory-disk'}
          contentFit="cover"
          recyclingKey={resolvedArtworkUri}
          source={{ uri: resolvedArtworkUri }}
          style={[
            styles.uploadedImage,
            isUploaded && Platform.OS !== 'web' ? { height, width } : null,
            useBlur && Platform.OS === 'web' ? webBlurStyle : null,
          ]}
        />
      ) : null}

      {isUploaded ? (
        <View style={styles.uploadedBottomFade} />
      ) : (
        <>
          <View style={styles.fallbackTint} />
          <View style={styles.fallbackPurpleWash} />
          <View style={styles.fallbackBottomScrim} />
          <View style={styles.fallbackVignetteTop} />
          <View style={styles.fallbackVignetteBottom} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  environment: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: palette.pureBlack,
    overflow: 'hidden',
  },
  uploadedImage: {
    ...StyleSheet.absoluteFillObject,
  },
  uploadedBottomFade: {
    backgroundColor: 'rgba(8, 8, 8, 0.55)',
    bottom: 0,
    height: '45%',
    left: 0,
    position: 'absolute',
    right: 0,
    zIndex: 2,
  },
  fallbackTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: artwork.fallbackTint,
    zIndex: 2,
  },
  fallbackPurpleWash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: fan.purpleWash,
    zIndex: 2,
  },
  fallbackBottomScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: artwork.fallbackBottomScrim,
    top: '62%',
    zIndex: 2,
  },
  fallbackVignetteTop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: artwork.vignetteMedium,
    bottom: '70%',
    zIndex: 2,
  },
  fallbackVignetteBottom: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: artwork.vignetteStrong,
    top: '70%',
    zIndex: 2,
  },
});
