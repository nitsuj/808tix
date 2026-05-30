import { Image } from 'expo-image';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { FanAccent, FanAccentBright, Radii, Surface } from '@/constants/theme';
import { resolveOrganizerArtworkUrl } from '@/lib/event-artwork-display';

type EventArtworkProps = {
  imageUrl?: string | null;
  name: string;
  height?: number;
  style?: ViewStyle;
  rounded?: boolean;
};

function hashName(name: string): number {
  let hash = 0;

  for (let index = 0; index < name.length; index += 1) {
    hash = (hash << 5) - hash + name.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash);
}

function paletteForName(name: string) {
  const palettes = [
    { base: '#2A1040', accent: FanAccent, glow: FanAccentBright },
    { base: '#101828', accent: '#39FF14', glow: FanAccent },
    { base: '#1A0A28', accent: FanAccentBright, glow: '#7B3DB8' },
    { base: '#0A1628', accent: FanAccent, glow: '#39FF14' },
  ];

  return palettes[hashName(name) % palettes.length];
}

export function EventArtwork({
  imageUrl,
  name,
  height = 200,
  style,
  rounded = true,
}: EventArtworkProps) {
  const palette = paletteForName(name);
  const borderRadius = rounded ? Radii.card : 0;
  const resolvedImageUrl = resolveOrganizerArtworkUrl(imageUrl);

  if (resolvedImageUrl) {
    return (
      <View style={[styles.container, { height, borderRadius }, style]}>
        <Image
          cachePolicy="none"
          contentFit="cover"
          recyclingKey={resolvedImageUrl}
          source={{ uri: resolvedImageUrl }}
          style={[StyleSheet.absoluteFill, { borderRadius }]}
        />
        <View style={[styles.bottomFade, { borderRadius }]} />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: palette.base, height, borderRadius },
        style,
      ]}>
      <View style={[styles.glowOrb, { backgroundColor: palette.accent }]} />
      <View style={[styles.glowOrbSmall, { backgroundColor: palette.glow }]} />
      <View style={[styles.bottomFade, { borderRadius }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Surface.card,
    overflow: 'hidden',
    width: '100%',
  },
  bottomFade: {
    backgroundColor: 'rgba(8, 8, 8, 0.55)',
    bottom: 0,
    height: '45%',
    left: 0,
    position: 'absolute',
    right: 0,
  },
  glowOrb: {
    borderRadius: 999,
    height: 120,
    left: '10%',
    opacity: 0.35,
    position: 'absolute',
    top: '20%',
    width: 120,
  },
  glowOrbSmall: {
    borderRadius: 999,
    height: 80,
    opacity: 0.28,
    position: 'absolute',
    right: '15%',
    top: '35%',
    width: 80,
  },
});
