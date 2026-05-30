/**
 * 808Tix design tokens — see docs/DESIGN_SYSTEM_V2.md
 */

import '@/global.css';

import { Platform } from 'react-native';

export const OrganizerAccent = '#39FF14';
export const OrganizerAccentTextOn = '#000000';

/** Fan / pass screens (v2). */
export const FanAccent = '#A25BFF';
export const FanAccentBright = '#FF2D78';
export const FanAccentMuted = '#7B3DB8';

export const Surface = {
  background: '#080808',
  secondary: '#141414',
  card: '#1A1A1A',
  divider: '#222222',
  input: '#111111',
} as const;

export const Semantic = {
  error: '#FF3B3B',
  warning: '#FFB020',
} as const;

export const Colors = {
  light: {
    text: '#FFFFFF',
    background: Surface.background,
    backgroundElement: Surface.card,
    backgroundSelected: Surface.secondary,
    textSecondary: '#B0B4BA',
  },
  dark: {
    text: '#FFFFFF',
    background: Surface.background,
    backgroundElement: Surface.card,
    backgroundSelected: Surface.secondary,
    textSecondary: '#B0B4BA',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radii = {
  input: 12,
  button: 14,
  card: 16,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
