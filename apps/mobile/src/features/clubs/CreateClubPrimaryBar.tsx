import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { useTheme } from '@/theme';
import { AppText } from '@/ui';

interface CreateClubPrimaryBarProps {
  label: string;
  onPress: () => void;
  enabled: boolean;
  busy?: boolean;
  accessibilityLabel?: string;
}

export function CreateClubPrimaryBar({
  label,
  onPress,
  enabled,
  busy = false,
  accessibilityLabel,
}: CreateClubPrimaryBarProps) {
  const { colors, radius, spacing } = useTheme();
  const inactive = !enabled || busy;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy }}
      disabled={inactive}
      onPress={onPress}
      style={{
        minHeight: 56,
        borderRadius: radius.lg,
        paddingHorizontal: spacing.lg,
        backgroundColor: inactive ? colors.surfaceSecondary : colors.accent,
        borderWidth: inactive ? 1 : 0,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: spacing.sm,
      }}
    >
      {busy ? <ActivityIndicator color={colors.textSecondary} /> : null}
      <AppText variant="bodyStrong" color={inactive ? 'secondary' : 'onAccent'}>
        {label}
      </AppText>
    </Pressable>
  );
}

export function CreateClubFooterNote({ children }: { children: string }) {
  const { spacing } = useTheme();
  return (
    <AppText variant="supporting" style={{ marginTop: spacing.md, textAlign: 'center' }}>
      {children}
    </AppText>
  );
}

export function CreateClubStickyFooter({ children }: { children: ReactNode }) {
  const { colors, spacing } = useTheme();
  return (
    <View
      style={{
        paddingTop: spacing.md,
        paddingBottom: spacing.sm,
        backgroundColor: colors.background,
      }}
    >
      {children}
    </View>
  );
}
