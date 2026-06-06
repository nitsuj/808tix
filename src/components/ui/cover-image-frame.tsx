import { Image } from 'expo-image';
import { type ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

/** Clip shape for uploaded images — circle for avatars, square/rounded for future artwork crops. */
export type CoverImageShape = 'circle' | 'rounded' | 'square';

export type CoverImageFrameProps = {
  uri?: string | null;
  shape?: CoverImageShape;
  /** Square frames use `size` for width and height. */
  size?: number;
  width?: number;
  height?: number;
  /** Used when `shape="rounded"`. Ignored for circle/square. */
  borderRadius?: number;
  fallback?: ReactNode;
  accessibilityLabel?: string;
  recyclingKey?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Reusable uploaded-image frame: center-cropped `cover` fit inside clipped bounds.
 *
 * Organizer avatars use `shape="circle"`. Future event artwork / background crop UI can
 * reuse this component with `shape="square" | "rounded"` and optional dimension props
 * without duplicating expo-image layout rules.
 */
export function resolveCoverImageBorderRadius(
  shape: CoverImageShape,
  width: number,
  height: number,
  borderRadius = 12,
): number {
  if (shape === 'circle') {
    return Math.min(width, height) / 2;
  }

  if (shape === 'square') {
    return 0;
  }

  return borderRadius;
}

function resolveFrameDimensions({
  size,
  width,
  height,
}: Pick<CoverImageFrameProps, 'size' | 'width' | 'height'>) {
  const resolvedWidth = width ?? size ?? 48;
  const resolvedHeight = height ?? size ?? resolvedWidth;

  return {
    width: resolvedWidth,
    height: resolvedHeight,
  };
}

export function CoverImageFrame({
  uri,
  shape = 'square',
  size,
  width,
  height,
  borderRadius = 12,
  fallback = null,
  accessibilityLabel,
  recyclingKey,
  style,
}: CoverImageFrameProps) {
  const trimmedUri = uri?.trim();
  const frameDimensions = resolveFrameDimensions({ size, width, height });
  const clipRadius = resolveCoverImageBorderRadius(
    shape,
    frameDimensions.width,
    frameDimensions.height,
    borderRadius,
  );

  const frameStyle: ViewStyle = {
    ...frameDimensions,
    borderRadius: clipRadius,
  };

  if (!trimmedUri) {
    if (fallback == null) {
      return null;
    }

    return (
      <View
        accessibilityLabel={accessibilityLabel}
        style={[styles.frame, styles.fallbackFrame, frameStyle, style]}>
        {fallback}
      </View>
    );
  }

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
      style={[styles.frame, frameStyle, style]}>
      <Image
        accessibilityIgnoresInvertColors
        cachePolicy="none"
        contentFit="cover"
        contentPosition="center"
        recyclingKey={recyclingKey ?? trimmedUri}
        source={{ uri: trimmedUri }}
        style={styles.image}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    position: 'relative',
    ...(Platform.OS === 'web' ? ({ isolation: 'isolate' } as ViewStyle) : null),
  },
  fallbackFrame: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    ...StyleSheet.absoluteFillObject,
    height: '100%',
    width: '100%',
  },
});
