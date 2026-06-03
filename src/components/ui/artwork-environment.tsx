import { Image } from 'expo-image';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { artwork, fan, palette } from '@/theme';

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
      <Image
        blurRadius={blurRadius}
        cachePolicy={isUploaded ? 'none' : 'memory-disk'}
        contentFit="cover"
        contentPosition="center"
        recyclingKey={artworkUri}
        source={{ uri: artworkUri }}
        style={[
          styles.coverImage,
          useBlur && Platform.OS === 'web' ? webBlurStyle : null,
        ]}
      />

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

const COVER_OVERSCAN_PERCENT = `${artwork.uploadedCoverScale * 100}%`;
const COVER_INSET_PERCENT = `${((1 - artwork.uploadedCoverScale) / 2) * 100}%`;

const styles = StyleSheet.create({
  environment: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: palette.black,
    overflow: 'hidden',
  },
  coverImage: {
    height: COVER_OVERSCAN_PERCENT,
    left: COVER_INSET_PERCENT,
    position: 'absolute',
    top: COVER_INSET_PERCENT,
    width: COVER_OVERSCAN_PERCENT,
  },
  uploadedTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: artwork.uploadedTint,
  },
  uploadedBottomScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: artwork.uploadedBottomScrim,
    top: '58%',
  },
  fallbackTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: artwork.fallbackTint,
  },
  fallbackPurpleWash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: fan.purpleWash,
  },
  fallbackBottomScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: artwork.fallbackBottomScrim,
    top: '62%',
  },
  fallbackVignetteTop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: artwork.vignetteMedium,
    bottom: '70%',
  },
  fallbackVignetteBottom: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: artwork.vignetteStrong,
    top: '70%',
  },
});
