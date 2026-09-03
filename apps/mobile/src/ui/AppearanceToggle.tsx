import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';
import { AppText } from './AppText';

interface AppearanceToggleProps {
  style?: StyleProp<ViewStyle>;
}

/**
 * Dev-time affordance to compare dark/light without changing the OS
 * setting. Shared across screens that have a header — not a permanent
 * product setting.
 */
export function AppearanceToggle({ style }: AppearanceToggleProps) {
  const { colors, colorScheme, toggleColorScheme } = useTheme();
  const isDark = colorScheme === 'dark';

  return (
    <Pressable
      onPress={toggleColorScheme}
      accessibilityRole="button"
      accessibilityLabel={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      hitSlop={8}
      style={({ pressed }) => [
        styles.toggle,
        {
          backgroundColor: colors.surfaceSecondary,
          borderColor: colors.border,
          opacity: pressed ? 0.7 : 1,
        },
        style,
      ]}
    >
      <AppText variant="caption" style={styles.glyph}>
        {isDark ? '\u2600' : '\u263E'}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  toggle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: {
    lineHeight: 16,
  },
});
