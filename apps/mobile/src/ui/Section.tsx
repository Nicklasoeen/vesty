import type { ReactNode } from 'react';
import { View } from 'react-native';

import { useTheme } from '@/theme';
import { AppText } from './AppText';

interface SectionProps {
  title: string;
  isLast?: boolean;
  children: ReactNode;
}

/**
 * Section heading + content. Uses the shared sectionTitle role (natural
 * title case) — uppercase eyebrows are reserved for rare status context
 * and should be authored with AppText eyebrow directly, not via Section.
 */
export function Section({ title, isLast, children }: SectionProps) {
  const { spacing } = useTheme();

  return (
    <View style={{ marginBottom: isLast ? 0 : spacing.xxl }}>
      <AppText variant="sectionTitle" style={{ marginBottom: spacing.md }}>
        {title}
      </AppText>
      {children}
    </View>
  );
}
