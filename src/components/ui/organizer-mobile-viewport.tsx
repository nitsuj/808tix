import { Platform, StyleSheet, useWindowDimensions, View, type ReactNode } from 'react-native';

export const ORGANIZER_MOBILE_VIEWPORT_WIDTH = 390;

const webViewportMinHeight =
  Platform.OS === 'web' ? ({ minHeight: '100dvh' } as const) : ({} as const);

type OrganizerMobileViewportProps = {
  children: ReactNode;
  /** Full-bleed layer behind the centered content column (ambient or event artwork). */
  background?: ReactNode;
};

/**
 * Organizer ops shell: device-sized background + centered 390px content column.
 * Background sits outside the max-width column so ambient fills side gutters.
 */
export function OrganizerMobileViewport({ children, background }: OrganizerMobileViewportProps) {
  const { width, height } = useWindowDimensions();

  return (
    <View style={styles.viewportOuter}>
      {background ? (
        <View pointerEvents="none" style={[styles.backgroundFrame, { height, width }]}>
          {background}
        </View>
      ) : null}
      <View style={styles.viewportInner}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  viewportOuter: {
    backgroundColor: 'transparent',
    flex: 1,
    position: 'relative',
    ...webViewportMinHeight,
  },
  backgroundFrame: {
    left: 0,
    position: 'absolute',
    top: 0,
    zIndex: 0,
  },
  viewportInner: {
    alignSelf: 'center',
    backgroundColor: 'transparent',
    flex: 1,
    maxWidth: ORGANIZER_MOBILE_VIEWPORT_WIDTH,
    overflow: 'visible',
    width: '100%',
    zIndex: 1,
    ...webViewportMinHeight,
  },
});
