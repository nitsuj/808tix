import { Platform, type TextStyle, type ViewStyle } from 'react-native';

export type PlatformShadowSpec = {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation?: number;
};

export type PlatformTextShadowSpec = {
  textShadowColor: string;
  textShadowOffset: { width: number; height: number };
  textShadowRadius: number;
};

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.replace('#', '');

  if (normalized.length !== 6) {
    return null;
  }

  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);

  if ([r, g, b].some((channel) => Number.isNaN(channel))) {
    return null;
  }

  return { r, g, b };
}

function shadowColorWithOpacity(color: string, opacity: number): string {
  if (color.startsWith('rgba(')) {
    return color;
  }

  if (color.startsWith('rgb(')) {
    return color.replace('rgb(', 'rgba(').replace(')', `, ${opacity})`);
  }

  const rgb = hexToRgb(color);

  if (rgb) {
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
  }

  return color;
}

function toBoxShadow({
  shadowColor,
  shadowOffset,
  shadowOpacity,
  shadowRadius,
}: PlatformShadowSpec): string {
  const color = shadowColorWithOpacity(shadowColor, shadowOpacity);
  return `${shadowOffset.width}px ${shadowOffset.height}px ${shadowRadius}px ${color}`;
}

function toTextShadow({
  textShadowColor,
  textShadowOffset,
  textShadowRadius,
}: PlatformTextShadowSpec): string {
  return `${textShadowOffset.width}px ${textShadowOffset.height}px ${textShadowRadius}px ${textShadowColor}`;
}

/** Native shadow* on iOS/Android; boxShadow on web (avoids RN web deprecation warnings). */
export function platformViewShadow(spec: PlatformShadowSpec): ViewStyle {
  if (Platform.OS === 'web') {
    return { boxShadow: toBoxShadow(spec) };
  }

  return spec;
}

/** Native textShadow* on iOS/Android; textShadow on web. */
export function platformTextShadow(spec: PlatformTextShadowSpec): TextStyle {
  if (Platform.OS === 'web') {
    return { textShadow: toTextShadow(spec) };
  }

  return spec;
}

/** Prefer style.pointerEvents over the deprecated View pointerEvents prop on web. */
export function platformPointerEventsNone(): ViewStyle {
  return { pointerEvents: 'none' };
}
