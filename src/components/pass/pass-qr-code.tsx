import { useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { FanAccent, Spacing } from '@/constants/theme';

type PassQrCodeProps = {
  secureToken: string;
  dimmed?: boolean;
};

const QR_MAX_SIZE = 300;
const QR_MIN_SIZE = 240;

export function PassQrCode({ secureToken, dimmed = false }: PassQrCodeProps) {
  const { width } = useWindowDimensions();

  const qrSize = useMemo(() => {
    const available = width - Spacing.four * 2 - Spacing.four * 2;
    return Math.max(QR_MIN_SIZE, Math.min(QR_MAX_SIZE, Math.floor(available)));
  }, [width]);

  return (
    <View style={[styles.frame, dimmed && styles.frameDimmed]}>
      <View style={styles.qrPad}>
        <QRCode
          backgroundColor="#FFFFFF"
          color="#000000"
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
    backgroundColor: '#FFFFFF',
    borderColor: FanAccent,
    borderRadius: Spacing.three,
    borderWidth: 2,
    padding: Spacing.three,
    shadowColor: FanAccent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
  },
  frameDimmed: {
    opacity: 0.45,
  },
  qrPad: {
    backgroundColor: '#FFFFFF',
    padding: Spacing.two,
  },
});
