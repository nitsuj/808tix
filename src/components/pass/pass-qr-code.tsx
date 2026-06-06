import { useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { qrCode, spacing } from '@/theme';
import { platformViewShadow } from '@/theme/platform-styles';

type PassQrCodeProps = {
  secureToken: string;
  dimmed?: boolean;
  /** Fixed QR module size (px). When set, ignores window-based sizing. */
  size?: number;
  /** Render QR only — no outer frame (Ticket Detail mock supplies the shell). */
  bare?: boolean;
};

const QR_MAX_SIZE = 300;
const QR_MIN_SIZE = 240;

export function PassQrCode({ secureToken, dimmed = false, size, bare = false }: PassQrCodeProps) {
  const { width } = useWindowDimensions();

  const qrSize = useMemo(() => {
    if (size != null) {
      return size;
    }

    const available = width - spacing.four * 2 - spacing.four * 2;
    return Math.max(QR_MIN_SIZE, Math.min(QR_MAX_SIZE, Math.floor(available)));
  }, [size, width]);

  const code = (
    <QRCode
      backgroundColor={qrCode.background}
      color={qrCode.foreground}
      ecl="M"
      size={qrSize}
      value={secureToken}
    />
  );

  if (bare) {
    return <View style={dimmed ? styles.bareDimmed : undefined}>{code}</View>;
  }

  return (
    <View style={[styles.frame, dimmed && styles.frameDimmed]}>
      <View style={styles.qrPad}>{code}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: qrCode.background,
    borderColor: qrCode.borderColor,
    borderRadius: spacing.three,
    borderWidth: qrCode.borderWidth,
    padding: spacing.three,
    ...platformViewShadow({
      shadowColor: qrCode.shadowColor,
      shadowOffset: qrCode.shadowOffset,
      shadowOpacity: qrCode.shadowOpacity,
      shadowRadius: qrCode.shadowRadius,
    }),
  },
  frameDimmed: {
    opacity: qrCode.dimmedOpacity,
  },
  bareDimmed: {
    opacity: qrCode.dimmedOpacity,
  },
  qrPad: {
    backgroundColor: qrCode.background,
    padding: spacing.two,
  },
});
