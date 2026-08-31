import { Text, View } from 'react-native';

import { proto, prototypeStyles as styles } from '@/components/design-prototype/prototype-styles';
import type { PrototypeEventStatus } from '@/components/design-prototype/prototype-data';

type Tone = 'on_sale' | 'sales_ended' | 'draft' | 'cancelled' | 'neutral' | 'fee';

const TONE_STYLES: Record<Tone, { bg: string; color: string }> = {
  on_sale: { bg: proto.greenSoft, color: proto.green },
  sales_ended: { bg: proto.amberSoft, color: proto.amber },
  draft: { bg: proto.blueSoft, color: proto.violet },
  cancelled: { bg: 'rgba(255,255,255,0.06)', color: proto.textDim },
  neutral: { bg: 'rgba(255,255,255,0.06)', color: proto.textMuted },
  fee: { bg: proto.magentaSoft, color: proto.magenta },
};

export function PrototypeBadge({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: Tone;
}) {
  const palette = TONE_STYLES[tone];
  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }]}>
      <Text style={[styles.badgeText, { color: palette.color }]}>{label}</Text>
    </View>
  );
}

export function statusTone(status: PrototypeEventStatus): Tone {
  return status;
}

export function statusLabel(status: PrototypeEventStatus): string {
  if (status === 'on_sale') return 'On Sale';
  if (status === 'sales_ended') return 'Sales Ended';
  if (status === 'draft') return 'Draft';
  return 'Cancelled';
}
