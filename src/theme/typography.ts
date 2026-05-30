/**
 * 808Tix typography tokens — Inter / system stack (see docs/DESIGN_SYSTEM_v2.md).
 */

import { Platform } from 'react-native';

export const fontFamily = Platform.select({
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

/** Type scale — use in StyleSheet; screens may compose locally until text components adopt tokens. */
export const typeScale = {
  eyebrow: { fontSize: 13, fontWeight: '600' as const, letterSpacing: 0.2 },
  passTitle: { fontSize: 38, fontWeight: '700' as const, letterSpacing: -0.8, lineHeight: 44 },
  passVenue: { fontSize: 19, fontWeight: '500' as const, letterSpacing: -0.2, lineHeight: 26 },
  passMeta: { fontSize: 16, fontWeight: '400' as const, lineHeight: 22 },
  passHolderName: { fontSize: 26, fontWeight: '600' as const, letterSpacing: -0.2, lineHeight: 32 },
  screenTitle: { fontSize: 32, fontWeight: '700' as const, letterSpacing: -0.4, lineHeight: 38 },
} as const;
