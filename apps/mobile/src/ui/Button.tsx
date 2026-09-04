import { Pressable, StyleSheet } from 'react-native';

import { useTheme } from '@/theme';
import { AppText } from './AppText';

type ButtonVariant = 'primary' | 'secondary';
type ButtonSize = 'md' | 'sm';

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  /** Stretch to the parent width. */
  block?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  block = false,
  accessibilityLabel,
  accessibilityHint,
}: ButtonProps) {
  const { colors, radius, spacing } = useTheme();
  const compact = size === 'sm';

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.base,
        {
          borderRadius: compact ? radius.sm : radius.md,
          paddingVertical: compact ? spacing.xs + 2 : spacing.sm + 2,
          paddingHorizontal: compact ? spacing.md : spacing.lg,
          minHeight: compact ? 36 : 44,
          alignSelf: block ? 'stretch' : 'flex-start',
          backgroundColor: variant === 'primary' ? colors.accent : 'transparent',
          borderWidth: variant === 'secondary' ? 1 : 0,
          borderColor: colors.border,
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
        },
      ]}
    >
      <AppText variant="bodyStrong" color={variant === 'primary' ? 'onAccent' : 'primary'}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
