import { Text, View } from 'react-native';

import { dash } from '@/components/dashboard/dashboard-tokens';
import { dashboardStyles as styles } from '@/components/dashboard/dashboard-styles';

export type StatusBadgeTone =
  | 'neutral'
  | 'positive'
  | 'warn'
  | 'magenta'
  | 'draft'
  | 'cancelled';

const TONE_STYLES: Record<StatusBadgeTone, { bg: string; color: string }> = {
  neutral: { bg: 'rgba(255,255,255,0.06)', color: dash.textMuted },
  positive: { bg: dash.greenSoft, color: dash.green },
  warn: { bg: dash.amberSoft, color: dash.amber },
  magenta: { bg: dash.magentaSoft, color: dash.magenta },
  draft: { bg: dash.blueSoft, color: dash.violet },
  cancelled: { bg: 'rgba(255,255,255,0.06)', color: dash.textDim },
};

export function StatusBadge({ label, tone = 'neutral' }: { label: string; tone?: StatusBadgeTone }) {
  const palette = TONE_STYLES[tone];
  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }]}>
      <Text style={[styles.badgeText, { color: palette.color }]}>{label}</Text>
    </View>
  );
}
