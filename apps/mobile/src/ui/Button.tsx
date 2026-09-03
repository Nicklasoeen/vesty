import { Pressable, StyleSheet } from 'react-native';

import { useTheme } from '@/theme';
import { AppText } from './AppText';

type ButtonVariant = 'primary' | 'secondary';

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
}

export function Button({ label, onPress, variant = 'primary' }: ButtonProps) {
  const { colors, radius, spacing } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.base,
        {
          borderRadius: radius.md,
          paddingVertical: spacing.sm + 2,
          paddingHorizontal: spacing.lg,
          backgroundColor: variant === 'primary' ? colors.accent : 'transparent',
          borderWidth: variant === 'secondary' ? 1 : 0,
          borderColor: colors.border,
          opacity: pressed ? 0.85 : 1,
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
    alignSelf: 'flex-start',
  },
});
