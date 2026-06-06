import { Image } from 'expo-image';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { artwork, fan } from '@/theme';
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
 * Full-screen artwork — uploaded path mirrors EventArtwork (Command Center cards):
 * expo-image, source={{ uri }}, cachePolicy="none", contentFit="cover", StyleSheet.absoluteFill.
 */
export function ArtworkEnvironment({
  artworkUri,
  isUploaded = false,
  style,
}: ArtworkEnvironmentProps) {
  const useBlur = !isUploaded;
  const blurRadius = useBlur && Platform.OS !== 'web' ? artwork.blurRadius : 0;

  return (
    <View style={[styles.environment, platformPointerEventsNone(), style]}>
      {isUploaded ? (
        <>
          <Image
            cachePolicy="none"
            contentFit="cover"
            recyclingKey={artworkUri}
            source={{ uri: artworkUri }}
            style={styles.uploadedImage}
          />
          <View style={styles.uploadedBottomFade} />
        </>
      ) : (
        <>
          <View style={[styles.artLayer, styles.artLayerScaled]}>
            <Image
              blurRadius={blurRadius}
              cachePolicy="memory-disk"
              contentFit="cover"
              recyclingKey={artworkUri}
              source={{ uri: artworkUri }}
              style={[StyleSheet.absoluteFill, useBlur && Platform.OS === 'web' ? webBlurStyle : null]}
            />
          </View>
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
    height: '100%',
    overflow: 'hidden',
    width: '100%',
  },
  uploadedImage: {
    ...StyleSheet.absoluteFill,
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
  artLayer: {
    ...StyleSheet.absoluteFill,
    zIndex: 1,
  },
  artLayerScaled: {
    transform: [{ scale: artwork.scale }],
  },
  fallbackTint: {
    ...StyleSheet.absoluteFill,
    backgroundColor: artwork.fallbackTint,
    zIndex: 2,
  },
  fallbackPurpleWash: {
    ...StyleSheet.absoluteFill,
    backgroundColor: fan.purpleWash,
    zIndex: 2,
  },
  fallbackBottomScrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: artwork.fallbackBottomScrim,
    top: '62%',
    zIndex: 2,
  },
  fallbackVignetteTop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: artwork.vignetteMedium,
    bottom: '70%',
    zIndex: 2,
  },
  fallbackVignetteBottom: {
    ...StyleSheet.absoluteFill,
    backgroundColor: artwork.vignetteStrong,
    top: '70%',
    zIndex: 2,
  },
});
