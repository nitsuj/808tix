import { Image } from 'expo-image';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { artwork, fan } from '@/theme';

const webBlurStyle =
  Platform.OS === 'web' ? ({ filter: `blur(${artwork.blurRadius}px)` } as ViewStyle) : null;

type ArtworkEnvironmentProps = {
  artworkUri: string;
  /** True when showing uploaded event artwork (sharper, lighter overlays). */
  isUploaded?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function ArtworkEnvironment({
  artworkUri,
  isUploaded = false,
  style,
}: ArtworkEnvironmentProps) {
  const useBlur = !isUploaded;
  const blurRadius = useBlur && Platform.OS !== 'web' ? artwork.blurRadius : 0;

  return (
    <View pointerEvents="none" style={[styles.environment, style]}>
      <View style={[styles.artLayer, useBlur && styles.artLayerScaled]}>
        <Image
          blurRadius={blurRadius}
          cachePolicy={isUploaded ? 'none' : 'memory-disk'}
          contentFit="cover"
          recyclingKey={artworkUri}
          source={{ uri: artworkUri }}
          style={[StyleSheet.absoluteFill, useBlur && Platform.OS === 'web' ? webBlurStyle : null]}
        />
      </View>

      {isUploaded ? (
        <>
          <View style={styles.uploadedTint} />
          <View style={styles.uploadedBottomScrim} />
        </>
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
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
  },
  artLayer: {
    ...StyleSheet.absoluteFill,
  },
  artLayerScaled: {
    transform: [{ scale: artwork.scale }],
  },
  uploadedTint: {
    ...StyleSheet.absoluteFill,
    backgroundColor: artwork.uploadedTint,
  },
  uploadedBottomScrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: artwork.uploadedBottomScrim,
    top: '58%',
  },
  fallbackTint: {
    ...StyleSheet.absoluteFill,
    backgroundColor: artwork.fallbackTint,
  },
  fallbackPurpleWash: {
    ...StyleSheet.absoluteFill,
    backgroundColor: fan.purpleWash,
  },
  fallbackBottomScrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: artwork.fallbackBottomScrim,
    top: '62%',
  },
  fallbackVignetteTop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: artwork.vignetteMedium,
    bottom: '70%',
  },
  fallbackVignetteBottom: {
    ...StyleSheet.absoluteFill,
    backgroundColor: artwork.vignetteStrong,
    top: '70%',
  },
});
