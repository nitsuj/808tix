/**
 * 808Tix centralized theme — implementation source of truth.
 *
 * Design spec: docs/DESIGN_SYSTEM_v2.md
 * Visual reference: docs/design/808Tix_UI_Source_of_Truth.png
 *
 * Import from `@/theme` in new code. Legacy `@/constants/theme` re-exports remain supported.
 */

import '@/global.css';

import { Platform } from 'react-native';

import {
  artwork,
  credential,
  fan,
  organizer,
  palette,
  qr,
  scanner,
  semantic,
  surface,
  text,
  themeColors,
  type ThemeColor,
} from './colors';
import {
  artworkUpload,
  chrome,
  formField,
  organizerAmbient,
  organizerScreen,
  organizerOpsScreen,
  passScreen,
  qrCode,
  scannerScreen,
} from './components';
import { layout, spacing } from './spacing';
import { fontFamily, typeScale } from './typography';
import { radius } from './radius';
import { shadows, webShadows } from './shadows';

export {
  artwork,
  credential,
  fan,
  organizer,
  palette,
  qr,
  scanner,
  semantic,
  surface,
  text,
  themeColors,
  type ThemeColor,
  artworkUpload,
  chrome,
  organizerAmbient,
  formField,
  organizerScreen,
  organizerOpsScreen,
  passScreen,
  qrCode,
  scannerScreen,
  layout,
  spacing,
  fontFamily,
  typeScale,
  radius,
  shadows,
  webShadows,
};

// ---------------------------------------------------------------------------
// Legacy aliases — keep existing `@/constants/theme` imports working
// ---------------------------------------------------------------------------

export const OrganizerAccent = organizer.accent;
export const OrganizerAccentTextOn = organizer.textOn;

export const FanAccent = fan.primary;
export const FanAccentBright = fan.bright;
export const FanAccentMuted = fan.muted;

export const Surface = surface;
export const Semantic = semantic;
export const Colors = themeColors;
export const Fonts = fontFamily;
export const Spacing = spacing;
export const Radii = radius;

export const MaxContentWidth = layout.maxContentWidth;
export const BottomTabInset =
  Platform.select({ ios: layout.bottomTabInset, android: layout.bottomTabInsetAndroid }) ?? 0;

/** Unified theme object for programmatic access. */
export const theme = {
  colors: {
    palette,
    fan,
    organizer,
    surface,
    text,
    semantic,
    scanner,
    artwork,
    credential,
    qr,
  },
  spacing,
  layout,
  typography: { fontFamily, typeScale },
  radius,
  shadows,
  webShadows,
  components: {
    passScreen,
    organizerScreen,
    scannerScreen,
    formField,
    qrCode,
    artworkUpload,
    chrome,
    organizerAmbient,
  },
} as const;

export default theme;
