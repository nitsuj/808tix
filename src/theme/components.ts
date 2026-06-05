/**
 * Component-level design tokens — composed recipes for recurring UI patterns.
 * Update these to restyle multiple screens from one place.
 */

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
} from './colors';
import { radius } from './radius';
import { shadows, webShadows } from './shadows';
import { spacing } from './spacing';

/** Guest pass / ticket screen — artwork environment + floating credential. */
export const passScreen = {
  artEnvironment: artwork,
  credential: {
    ...credential,
    borderRadius: radius.walletCard,
    ...shadows.walletCard,
    paddingHorizontal: spacing.four,
    paddingTop: spacing.four + 4,
    paddingBottom: spacing.four,
    marginHorizontal: spacing.three,
  },
  passTypeBadge: {
    backgroundColor: fan.badgeBackground,
    borderRadius: radius.badge,
    textColor: fan.badgeText,
  },
  statusBanner: {
    backgroundColor: credential.statusBannerBackground,
    borderRadius: radius.statusBanner,
    marginHorizontal: spacing.three,
  },
  footerActionOpacity: 0.55,
} as const;

/** Organizer dashboard and event detail. */
export const organizerScreen = {
  liveBadge: {
    backgroundColor: organizer.liveBadgeBackground,
  },
  createButton: {
    accent: organizer.accent,
    textOn: organizer.textOn,
  },
} as const;

/** Scanner camera overlay and result states. */
export const scannerScreen = {
  overlay: {
    background: scanner.overlayBackground,
    text: scanner.overlayText,
    textSecondary: scanner.overlayTextSecondary,
    accent: organizer.accent,
    textOnAccent: organizer.textOn,
  },
  frame: {
    glow: organizer.scanFrameGlow,
    inset: organizer.scanFrameInset,
    webBoxShadow: webShadows.scannerFrameGlow,
    webTextShadow: webShadows.scannerOverlayText,
  },
  resultOverlays: {
    valid: scanner.validOverlay,
    already_used: scanner.alreadyUsedOverlay,
    invalid: scanner.invalidOverlay,
    wrong_event: scanner.wrongEventOverlay,
    voided: scanner.voidedOverlay,
  },
  footer: {
    pillBackground: scanner.footerPillBackground,
  },
  cameraScrim: scanner.cameraScrim,
  results: scanner,
} as const;

/** Form fields on create/edit/issue screens. */
export const formField = {
  inputBackground: surface.input,
  inputBorder: surface.divider,
  labelColor: text.primary,
  placeholderColor: text.placeholder,
  errorColor: semantic.error,
} as const;

/** QR code presentation — scanning reliability requires high contrast. */
export const qrCode = {
  background: qr.background,
  foreground: qr.foreground,
  borderColor: fan.primary,
  borderWidth: 2,
  dimmedOpacity: 0.45,
  ...shadows.qrFrame,
} as const;

/** Event artwork upload on edit event — preview + picker affordance. */
export const artworkUpload = {
  previewHeight: 200,
  borderColor: surface.divider,
  hintColor: text.secondary,
  actionBackground: surface.card,
  actionBorder: organizer.accent,
  actionText: organizer.accent,
} as const;

/**
 * Electric Magenta — organizer ops ambience (Dashboard, Profile, auth, event fallbacks).
 * Magenta / purple / deep blue only; green reserved for operational indicators.
 */
export const organizerAmbient = {
  deepBlue: {
    default: 'rgba(18, 28, 86, 0.24)',
    subtle: 'rgba(18, 28, 86, 0.16)',
  },
  purple: {
    default: 'rgba(125, 58, 228, 0.34)',
    subtle: 'rgba(125, 58, 228, 0.26)',
  },
  magenta: {
    default: 'rgba(236, 52, 156, 0.42)',
    subtle: 'rgba(236, 52, 156, 0.32)',
  },
  scrim: {
    default: 'rgba(8, 8, 12, 0.12)',
    subtle: 'rgba(8, 8, 12, 0.08)',
    withArtwork: 'rgba(8, 8, 8, 0.28)',
  },
  vignetteBottom: {
    default: 'rgba(0, 0, 0, 0.34)',
    subtle: 'rgba(0, 0, 0, 0.24)',
    withArtwork: 'rgba(0, 0, 0, 0.42)',
  },
} as const;

/** Shared chrome — premium dark UI surfaces (login, dashboard, ops screens). */
export const chrome = {
  pureBlack: palette.pureBlack,
  white: palette.white,
  screen: {
    background: surface.background,
    ambientDeepBlue: organizerAmbient.deepBlue.default,
    ambientPurple: organizerAmbient.purple.default,
    ambientMagenta: organizerAmbient.magenta.default,
    ambientDeepBlueSubtle: organizerAmbient.deepBlue.subtle,
    ambientPurpleSubtle: organizerAmbient.purple.subtle,
    ambientMagentaSubtle: organizerAmbient.magenta.subtle,
    scrim: 'rgba(8, 8, 8, 0.65)',
    scrimSubtle: organizerAmbient.scrim.subtle,
  },
  glass: {
    fill: 'rgba(18, 18, 24, 0.88)',
    border: 'rgba(255, 255, 255, 0.09)',
    highlight: 'rgba(255, 255, 255, 0.04)',
  },
  brand: {
    wordmark: fan.primary,
    tagline: text.secondary,
    eyebrow: fan.badgeText,
    opsAccent: organizer.accent,
  },
  input: {
    background: 'rgba(10, 10, 14, 0.95)',
    border: 'rgba(255, 255, 255, 0.1)',
    placeholder: text.placeholder,
  },
} as const;

export { organizerOpsScreen } from './organizer-ops-screen';
