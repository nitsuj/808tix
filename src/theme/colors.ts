/**
 * 808Tix color tokens — see docs/DESIGN_SYSTEM_v2.md
 *
 * Role groups:
 * - fan: purple/pink accents for guest-facing screens (pass, discovery)
 * - organizer: neon green for ops screens (dashboard, issue, scanner success)
 * - surface: dark backgrounds and cards
 * - text: typography colors
 * - semantic: error/warning states
 * - scanner: full-screen scan result feedback colors
 * - artwork: full-bleed pass background overlays (poster environment)
 * - credential: floating pass card surfaces
 */

/** Raw palette anchors — prefer semantic tokens below in UI code. */
export const palette = {
  black: '#080808',
  white: '#FFFFFF',
  pureBlack: '#000000',
} as const;

/** Fan-facing purple / pink — pass, ticket, discovery experiences. */
export const fan = {
  primary: '#A25BFF',
  bright: '#FF2D78',
  muted: '#7B3DB8',
  badgeBackground: 'rgba(162, 91, 255, 0.14)',
  badgeText: '#E2CCFF',
  purpleWash: 'rgba(42, 16, 64, 0.18)',
} as const;

/** Organizer / operations green — dashboard, issue, check-in, scanner frame. */
export const organizer = {
  accent: '#39FF14',
  textOn: '#000000',
  liveBadgeBackground: 'rgba(57, 255, 20, 0.15)',
  scanFrameGlow: 'rgba(57, 255, 20, 0.25)',
  scanFrameInset: 'rgba(57, 255, 20, 0.08)',
} as const;

/** Dark surfaces — cards, dividers, inputs. */
export const surface = {
  background: '#080808',
  secondary: '#141414',
  card: '#1A1A1A',
  divider: '#222222',
  input: '#111111',
} as const;

/** Text hierarchy — dark mode only for MVP. */
export const text = {
  primary: '#FFFFFF',
  secondary: '#B0B4BA',
  tertiary: '#A8ADB5',
  muted: '#7E848C',
  venue: '#EDEDED',
  footer: '#E2E4E8',
  placeholder: '#666666',
  disabled: '#888888',
  onAccent: '#000000',
  dotSeparator: 'rgba(255, 255, 255, 0.25)',
} as const;

/** Semantic feedback colors. */
export const semantic = {
  error: '#FF3B3B',
  errorSoft: '#FF6B6B',
  warning: '#FFB020',
} as const;

/**
 * Scanner result screen tokens — instant valid/invalid feedback at the door.
 * Used by scan-result-view and scanner-results helpers.
 */
export const scanner = {
  valid: { background: '#39FF14', text: '#000000' },
  alreadyUsed: { background: '#FFB020', text: '#000000' },
  invalid: { background: '#FF3B3B', text: '#FFFFFF' },
  wrongEvent: { background: '#FF3B3B', text: '#FFFFFF' },
  voided: { background: '#2E3135', text: '#B0B4BA' },
  overlayBackground: '#000000',
  overlayText: '#FFFFFF',
  overlayTextSecondary: '#B0B4BA',
  iconInvalidBackground: 'rgba(0, 0, 0, 0.25)',
  iconInvalidBorder: '#FFFFFF',
  buttonOnValidBackground: '#000000',
  buttonOnValidBorder: '#000000',
  buttonOnDarkBorder: '#FFFFFF',
} as const;

/**
 * Artwork / poster environment — full-screen pass backgrounds with overlays.
 * Artwork should dominate; overlays keep credential text readable.
 */
export const artwork = {
  blurRadius: 28,
  scale: 1.12,
  darkOverlay: 'rgba(8, 8, 8, 0.52)',
  vignetteStrong: 'rgba(8, 8, 8, 0.45)',
  vignetteMedium: 'rgba(8, 8, 8, 0.38)',
  vignetteEdge: 'rgba(8, 8, 8, 0.32)',
  gradientHigh: 'rgba(8, 8, 8, 0.28)',
  gradientMid: 'rgba(8, 8, 8, 0.22)',
  gradientLow: 'rgba(8, 8, 8, 0.18)',
  /** Uploaded event art — keep vibrant; minimal tint only. */
  uploadedTint: 'rgba(8, 8, 8, 0.12)',
  uploadedBottomScrim: 'rgba(8, 8, 8, 0.38)',
  /** Temporary fallback posters — lighter than credential overlays. */
  fallbackTint: 'rgba(8, 8, 8, 0.32)',
  fallbackBottomScrim: 'rgba(8, 8, 8, 0.48)',
} as const;

/**
 * Credential card — floating wallet/pass surfaces over artwork.
 */
export const credential = {
  cardBackground: 'rgba(14, 14, 14, 0.88)',
  cardBorder: 'rgba(255, 255, 255, 0.09)',
  divider: 'rgba(255, 255, 255, 0.08)',
  statusBannerBackground: 'rgba(20, 20, 20, 0.82)',
} as const;

/** QR scan surface — white background required for reliable scanning. */
export const qr = {
  background: '#FFFFFF',
  foreground: '#000000',
} as const;

/** Theme provider color map (ThemedText / ThemedView). */
export const themeColors = {
  light: {
    text: text.primary,
    background: surface.background,
    backgroundElement: surface.card,
    backgroundSelected: surface.secondary,
    textSecondary: text.secondary,
  },
  dark: {
    text: text.primary,
    background: surface.background,
    backgroundElement: surface.card,
    backgroundSelected: surface.secondary,
    textSecondary: text.secondary,
  },
} as const;

export type ThemeColor = keyof typeof themeColors.light & keyof typeof themeColors.dark;
