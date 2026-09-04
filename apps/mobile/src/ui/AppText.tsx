import { Text, type TextProps } from 'react-native';

import { useTheme, type AppTextVariant, type ThemeColors } from '@/theme';

export type AppTextColor = 'primary' | 'secondary' | 'accent' | 'positive' | 'negative' | 'onAccent';

interface AppTextProps extends TextProps {
  variant?: AppTextVariant;
  color?: AppTextColor;
}

/**
 * Text with the app's typography + color tokens applied, so components
 * never need to reach for a literal font size or color.
 */
export function AppText({ variant = 'body', color, style, ...rest }: AppTextProps) {
  const { colors, typography } = useTheme();
  const resolvedColor = resolveColor(color ?? defaultColorFor(variant), colors);

  return <Text {...rest} style={[typography[variant], { color: resolvedColor }, style]} />;
}

function defaultColorFor(variant: AppTextVariant): AppTextColor {
  return variant === 'meta' || variant === 'eyebrow' || variant === 'sectionTitle' ? 'secondary' : 'primary';
}

function resolveColor(color: AppTextColor, colors: ThemeColors): string {
  switch (color) {
    case 'primary':
      return colors.textPrimary;
    case 'secondary':
      return colors.textSecondary;
    case 'accent':
      return colors.accent;
    case 'positive':
      return colors.positive;
    case 'negative':
      return colors.negative;
    case 'onAccent':
      return colors.onAccent;
  }
}
