import type { TextStyle, ViewStyle } from 'react-native';

/**
 * Vesty Design System v2 tokens.
 *
 * Light mode is the approved direction: pale background, deep Vesty blue,
 * mint reserved for performance and selected states. Dark mode stays a
 * functional fallback — visual polish comes later.
 */

export type ColorScheme = 'light' | 'dark';

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceSecondary: string;
  textPrimary: string;
  textSecondary: string;
  border: string;
  accent: string;
  accentDeep: string;
  /** Low-opacity accent, used for subtle fills (e.g. active tab indicator halo). */
  accentMuted: string;
  /** Text/content color guaranteed to be readable on top of `accent`. */
  onAccent: string;
  mint: string;
  mintSoft: string;
  positive: string;
  negative: string;
  /** Small, curated data-visualization ramp for the strategy allocation bar. */
  chart: readonly [string, string, string, string];
}

export const lightColors: ThemeColors = {
  background: '#F7F9F8',
  surface: '#FFFFFF',
  surfaceSecondary: '#F3F7F5',
  textPrimary: '#102B3A',
  textSecondary: '#778995',
  border: '#E4ECE9',
  accent: '#12384A',
  accentDeep: '#0B2D3D',
  accentMuted: 'rgba(18, 56, 74, 0.08)',
  onAccent: '#FFFFFF',
  mint: '#22C59A',
  mintSoft: '#DFF7EF',
  positive: '#17B67E',
  negative: '#D95E63',
  chart: ['#12384A', '#4F7A8C', '#9BB2BA', '#22C59A'],
};

export const darkColors: ThemeColors = {
  background: '#0B1620',
  surface: '#111F29',
  surfaceSecondary: '#1A2C36',
  textPrimary: '#F3F6F7',
  textSecondary: '#8FA3AC',
  border: 'rgba(255, 255, 255, 0.08)',
  accent: '#4FA6B8',
  accentDeep: '#0B2D3D',
  accentMuted: 'rgba(79, 166, 184, 0.16)',
  onAccent: '#08161C',
  mint: '#22C59A',
  mintSoft: 'rgba(34, 197, 154, 0.16)',
  positive: '#4CBB8A',
  negative: '#E2836E',
  chart: ['#4FA6B8', '#7FA1AC', '#5C737C', '#22C59A'],
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 40,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  xxl: 28,
  full: 999,
} as const;

export const shadows = {
  card: {
    shadowColor: '#0F2F40',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  nav: {
    shadowColor: '#12384A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
} as const satisfies Record<string, ViewStyle>;

/**
 * Semantic typography roles.
 *
 * display     — strongest figure on a screen (portfolio value)
 * hero        — greeting / rare prominent moment
 * title       — card / entity title (club name)
 * subtitle    — Home section title (Your Clubs)
 * sectionTitle— quieter in-card heading (kept for Club / Invest)
 * value       — gain / secondary financial figure
 * statValue   — compact column figure
 * body        — readable copy
 * bodyStrong  — emphasized body
 * label       — card eyebrow (“Your portfolio”) — sentence case, not uppercase
 * supporting  — captions and helper copy
 * statLabel   — column captions under statValue
 * meta        — generic secondary (older screens)
 * eyebrow     — rare uppercase status. Do not use for ordinary Home labels.
 */
export type AppTextVariant =
  | 'display'
  | 'hero'
  | 'title'
  | 'sectionTitle'
  | 'subtitle'
  | 'value'
  | 'statValue'
  | 'body'
  | 'bodyStrong'
  | 'label'
  | 'supporting'
  | 'statLabel'
  | 'meta'
  | 'eyebrow';

export const typography: Record<AppTextVariant, TextStyle> = {
  display: {
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '700',
    letterSpacing: -0.55,
    fontVariant: ['tabular-nums'],
  },
  hero: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  title: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '600',
    letterSpacing: -0.25,
  },
  sectionTitle: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
  },
  value: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  statValue: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '600',
    letterSpacing: -0.2,
    fontVariant: ['tabular-nums'],
  },
  body: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '400',
  },
  bodyStrong: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
  },
  label: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  supporting: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
  },
  statLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '500',
  },
  meta: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  eyebrow: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
};
