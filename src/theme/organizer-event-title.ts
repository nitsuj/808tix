import { StyleSheet } from 'react-native';

import { text } from '@/theme/colors';

/** Preserves organizer-entered event name casing on command surfaces. */
export const organizerEventTitleStyle = StyleSheet.create({
  title: {
    color: text.primary,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.6,
    lineHeight: 32,
    textAlign: 'center',
    textTransform: 'none',
  },
});
