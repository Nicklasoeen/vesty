import type { ReactNode } from 'react';
import { View } from 'react-native';

import { useTheme } from '@/theme';
import { AppText } from './AppText';

type SectionVariant = 'eyebrow' | 'heading';

interface SectionProps {
  title: string;
  isLast?: boolean;
  /**
   * 'eyebrow' (default) — small uppercase label, matches the original Club
   * Dashboard section style. 'heading' — softer sentence-case heading with
   * weight/color contrast instead of all-caps, used on Home to feel less
   * like a generic dashboard.
   */
  variant?: SectionVariant;
  children: ReactNode;
}

/** Label + content block with consistent bottom spacing. Not a card. */
export function Section({ title, isLast, variant = 'eyebrow', children }: SectionProps) {
  const { spacing } = useTheme();
  const isHeading = variant === 'heading';

  return (
    <View style={{ marginBottom: isLast ? 0 : spacing.xxl }}>
      <AppText
        variant={isHeading ? 'bodyStrong' : 'label'}
        color={isHeading ? 'secondary' : undefined}
        style={{ marginBottom: spacing.md }}
      >
        {title}
      </AppText>
      {children}
    </View>
  );
}
