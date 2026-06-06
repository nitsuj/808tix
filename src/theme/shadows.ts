/**
 * 808Tix shadow / elevation tokens.
 */

import { Platform } from 'react-native';

import { palette } from './colors';
import { platformViewShadow, type PlatformShadowSpec } from './platform-styles';

const walletCardSpec: PlatformShadowSpec = {
  shadowColor: palette.pureBlack,
  shadowOffset: { width: 0, height: 20 },
  shadowOpacity: Platform.select({ web: 0.55, default: 0.45 }) ?? 0.45,
  shadowRadius: 40,
};

const qrFrameSpec: PlatformShadowSpec = {
  shadowColor: '#A25BFF',
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0.35,
  shadowRadius: 12,
};

const opsPanelSpec: PlatformShadowSpec = {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.35,
  shadowRadius: 6,
  elevation: 2,
};

export const shadows = {
  /** Raw token values — prefer walletCardStyle / qrFrameStyle at use sites. */
  walletCard: walletCardSpec,
  qrFrame: qrFrameSpec,
  opsPanel: opsPanelSpec,
  /** Platform-safe styles for StyleSheet spreads. */
  walletCardStyle: platformViewShadow(walletCardSpec),
  qrFrameStyle: platformViewShadow(qrFrameSpec),
  opsPanelStyle: platformViewShadow(opsPanelSpec),
} as const;

/** Web-only DOM shadow strings (scanner overlay). */
export const webShadows = {
  scannerOverlayText: '0 1px 6px rgba(0, 0, 0, 0.95)',
  scannerFrameGlow:
    '0 0 0 2px rgba(57, 255, 20, 0.55), 0 0 28px rgba(57, 255, 20, 0.35), inset 0 0 32px rgba(57, 255, 20, 0.08)',
} as const;
