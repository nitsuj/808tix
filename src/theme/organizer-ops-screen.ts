import { organizer, palette, text } from './colors';
import { radius } from './radius';
import { spacing } from './spacing';

/**
 * Shared organizer ops UI — Dashboard, Create/Edit Event, Event Detail.
 * Dark surfaces, neon green accents, compact status pills.
 */
export const organizerOpsScreen = {
  surface: {
    card: '#0C0C0C',
    cardBorder: 'rgba(255, 255, 255, 0.08)',
    inset: '#0A0A0A',
    insetBorder: 'rgba(255, 255, 255, 0.08)',
  },
  panel: {
    backgroundColor: '#0C0C0C',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: radius.card,
    borderWidth: 1,
    paddingBottom: spacing.four,
    paddingHorizontal: spacing.three,
    paddingTop: spacing.four,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 2,
  },
  backLink: {
    color: organizer.accent,
    fontSize: 15,
    fontWeight: '700',
  },
  meta: {
    date: {
      color: organizer.accent,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.2,
      lineHeight: 14,
    },
    venue: {
      color: text.secondary,
      fontSize: 14,
      fontWeight: '600',
      letterSpacing: 0.4,
      lineHeight: 18,
    },
  },
  statusPill: {
    base: {
      alignSelf: 'center',
      borderRadius: 6,
      borderWidth: 1,
      marginTop: spacing.two,
      paddingHorizontal: 7,
      paddingVertical: 2,
    },
    live: {
      backgroundColor: 'rgba(57, 255, 20, 0.1)',
      borderColor: 'rgba(57, 255, 20, 0.35)',
      color: organizer.accent,
    },
    draft: {
      backgroundColor: 'rgba(255, 196, 64, 0.08)',
      borderColor: 'rgba(255, 196, 64, 0.32)',
      color: '#FFC440',
    },
    text: {
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 0.3,
      lineHeight: 12,
      textAlign: 'center',
    },
  },
  liveBadge: {
    backgroundColor: 'rgba(57, 255, 20, 0.1)',
    borderColor: 'rgba(57, 255, 20, 0.35)',
    color: organizer.accent,
  },
  draftBadge: {
    backgroundColor: 'rgba(255, 196, 64, 0.08)',
    borderColor: 'rgba(255, 196, 64, 0.32)',
    color: '#FFC440',
  },
  statChip: {
    backgroundColor: '#0A0A0A',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    valueAccent: organizer.accent,
    tapHint: organizer.accent,
  },
  progress: {
    track: 'rgba(255, 255, 255, 0.06)',
    fill: organizer.accent,
  },
  button: {
    primary: {
      backgroundColor: 'rgba(57, 255, 20, 0.1)',
      borderColor: organizer.accent,
      borderWidth: 1.5,
      text: organizer.accent,
    },
    secondary: {
      backgroundColor: 'transparent',
      borderColor: 'rgba(255, 255, 255, 0.12)',
      borderWidth: 1,
      text: text.primary,
    },
    disabled: {
      backgroundColor: 'rgba(255, 255, 255, 0.04)',
      borderColor: 'rgba(255, 255, 255, 0.08)',
      text: text.muted,
    },
    minHeight: 48,
    text: {
      fontSize: 16,
      fontWeight: '800',
      letterSpacing: 0.3,
    },
  },
  viewport: {
    background: palette.pureBlack,
    maxWidth: 390,
  },
} as const;
