import type { PropsWithChildren } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

type SurfaceVariant = 'primary' | 'secondary';

interface SurfaceProps extends PropsWithChildren {
  variant?: SurfaceVariant;
  bordered?: boolean;
  elevated?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Themed container. Used sparingly — not every section needs to be a card. */
export function Surface({
  children,
  variant = 'primary',
  bordered = false,
  elevated = false,
  style,
}: SurfaceProps) {
  const { colors, radius, shadows } = useTheme();

  return (
    <View
      style={[
        {
          backgroundColor: variant === 'primary' ? colors.surface : colors.surfaceSecondary,
          borderRadius: radius.lg,
          borderWidth: bordered ? 1 : 0,
          borderColor: colors.border,
        },
        elevated ? shadows.card : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}
