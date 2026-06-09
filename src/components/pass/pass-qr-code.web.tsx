import { Image } from 'expo-image';
import QRCodeLib from 'qrcode';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { qrCode, spacing } from '@/theme';
import { platformViewShadow } from '@/theme/platform-styles';

type PassQrCodeProps = {
  secureToken: string;
  dimmed?: boolean;
  size?: number;
  bare?: boolean;
};

const QR_MAX_SIZE = 300;
const QR_MIN_SIZE = 240;

export function PassQrCode({ secureToken, dimmed = false, size, bare = false }: PassQrCodeProps) {
  const { width } = useWindowDimensions();
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  const qrSize = useMemo(() => {
    if (size != null) {
      return size;
    }

    const available = width - spacing.four * 2 - spacing.four * 2;
    return Math.max(QR_MIN_SIZE, Math.min(QR_MAX_SIZE, Math.floor(available)));
  }, [size, width]);

  useEffect(() => {
    if (!secureToken.trim()) {
      return;
    }

    let cancelled = false;

    void QRCodeLib.toDataURL(secureToken, {
      width: qrSize,
      margin: 0,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    }).then((uri) => {
      if (!cancelled) {
        setDataUrl(uri);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [secureToken, qrSize]);

  const code = dataUrl ? (
    <Image
      accessibilityLabel="Pass QR code"
      contentFit="fill"
      source={{ uri: dataUrl }}
      style={{ backgroundColor: '#FFFFFF', height: qrSize, width: qrSize }}
    />
  ) : (
    <View style={[styles.placeholder, { height: qrSize, width: qrSize }]} />
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
  bareDimmed: {
    opacity: qrCode.dimmedOpacity,
  },
  placeholder: {
    backgroundColor: '#FFFFFF',
  },
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
  qrPad: {
    backgroundColor: qrCode.background,
    padding: spacing.two,
  },
});
