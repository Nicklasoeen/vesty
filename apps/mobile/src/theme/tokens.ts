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

export type AppTextVariant = 'display' | 'title' | 'subtitle' | 'body' | 'bodyStrong' | 'caption' | 'label';

export const typography: Record<AppTextVariant, TextStyle> = {
  display: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '700',
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
  },
  title: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
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
  caption: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  label: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
};
