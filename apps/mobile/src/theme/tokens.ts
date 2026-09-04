import type { TextStyle } from 'react-native';

/**
 * Minimal semantic theme tokens for the Club Dashboard design spike.
 *
 * Colors are derived from the existing Vesty brand mark (#032c3c, a dark
 * navy-teal — see assets/brand/vesty-icon.svg) rather than an invented
 * palette. Dark mode reuses the same hue family at lower saturation for
 * layered surfaces and a lifted tint for accent, instead of pure black.
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
  /** Low-opacity accent, used for subtle fills (e.g. active tab indicator halo). */
  accentMuted: string;
  /** Text/content color guaranteed to be readable on top of `accent`. */
  onAccent: string;
  positive: string;
  negative: string;
  /** Small, curated data-visualization ramp for the strategy allocation bar. */
  chart: readonly [string, string, string, string];
}

export const lightColors: ThemeColors = {
  background: '#F7F8F9',
  surface: '#FFFFFF',
  surfaceSecondary: '#EEF1F3',
  textPrimary: '#0B1B22',
  textSecondary: '#5B6B72',
  border: 'rgba(3, 44, 60, 0.10)',
  accent: '#032C3C',
  accentMuted: 'rgba(3, 44, 60, 0.08)',
  onAccent: '#FFFFFF',
  positive: '#1F8F5E',
  negative: '#C1503D',
  chart: ['#032C3C', '#4F7A8C', '#9BB2BA', '#C9AE81'],
};

export const darkColors: ThemeColors = {
  background: '#0B1620',
  surface: '#111F29',
  surfaceSecondary: '#1A2C36',
  textPrimary: '#F3F6F7',
  textSecondary: '#8FA3AC',
  border: 'rgba(255, 255, 255, 0.08)',
  accent: '#4FA6B8',
  accentMuted: 'rgba(79, 166, 184, 0.16)',
  onAccent: '#08161C',
  positive: '#4CBB8A',
  negative: '#E2836E',
  chart: ['#4FA6B8', '#7FA1AC', '#5C737C', '#D2BE93'],
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
  full: 999,
} as const;

/**
 * Semantic typography roles for the design spike.
 *
 * display     — strongest number/value on a screen (e.g. 92 480 kr)
 * hero        — prominent event when the moment warrants it (e.g. Investment Day today)
 * title       — screen / entity titles (e.g. WRIC)
 * sectionTitle— natural title-case section headings (Total value, Strategy)
 * value       — medium financial emphasis (+8 480 kr · +10.1%)
 * body        — normal descriptive text
 * bodyStrong  — emphasized body
 * meta        — secondary information (4 members, 3 of 4 ready)
 * eyebrow     — rare uppercase contextual/status label (NEXT INVESTMENT DAY)
 *
 * Uppercase eyebrows are intentionally sparse — prefer sectionTitle for
 * ordinary section headings so screens don't read like analytics dashboards.
 */
export type AppTextVariant =
  | 'display'
  | 'hero'
  | 'title'
  | 'sectionTitle'
  | 'subtitle'
  | 'value'
  | 'body'
  | 'bodyStrong'
  | 'meta'
  | 'eyebrow';

export const typography: Record<AppTextVariant, TextStyle> = {
  display: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '700',
    letterSpacing: -0.4,
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
    lineHeight: 26,
    fontWeight: '600',
    letterSpacing: -0.2,
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
