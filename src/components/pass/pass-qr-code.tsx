import { useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { qrCode, spacing } from '@/theme';

type PassQrCodeProps = {
  secureToken: string;
  dimmed?: boolean;
};

const QR_MAX_SIZE = 300;
const QR_MIN_SIZE = 240;

export function PassQrCode({ secureToken, dimmed = false }: PassQrCodeProps) {
  const { width } = useWindowDimensions();

  const qrSize = useMemo(() => {
    const available = width - spacing.four * 2 - spacing.four * 2;
    return Math.max(QR_MIN_SIZE, Math.min(QR_MAX_SIZE, Math.floor(available)));
  }, [width]);

  return (
    <View style={[styles.frame, dimmed && styles.frameDimmed]}>
      <View style={styles.qrPad}>
        <QRCode
          backgroundColor={qrCode.background}
          color={qrCode.foreground}
          ecl="M"
          size={qrSize}
          value={secureToken}
        />
      </View>
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
    shadowColor: qrCode.shadowColor,
    shadowOffset: qrCode.shadowOffset,
    shadowOpacity: qrCode.shadowOpacity,
    shadowRadius: qrCode.shadowRadius,
  },
  frameDimmed: {
    opacity: qrCode.dimmedOpacity,
  },
  qrPad: {
    backgroundColor: qrCode.background,
    padding: spacing.two,
  },
});
