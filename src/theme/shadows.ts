/**
 * 808Tix shadow / elevation tokens.
 */

import { Platform } from 'react-native';

import { palette } from './colors';

export const shadows = {
  /** Floating pass credential card over artwork environment. */
  walletCard: {
    shadowColor: palette.pureBlack,
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: Platform.select({ web: 0.55, default: 0.45 }) ?? 0.45,
    shadowRadius: 40,
  },
  /** QR frame accent glow on pass screen. */
  qrFrame: {
    shadowColor: '#A25BFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
  },
} as const;

/** Web-only DOM shadow strings (scanner overlay). */
export const webShadows = {
  scannerOverlayText: '0 1px 6px rgba(0, 0, 0, 0.95)',
  scannerFrameGlow:
    '0 0 0 1px rgba(57, 255, 20, 0.25), inset 0 0 24px rgba(57, 255, 20, 0.08)',
} as const;
