import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { useTheme } from '@/theme';

interface IconButtonProps {
  icon: keyof typeof Feather.glyphMap;
  accessibilityLabel: string;
  onPress?: () => void;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

/** Circular 40dp icon control. Primary Home use is the header bell. */
export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  size = 40,
  style,
}: IconButtonProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !onPress }}
      hitSlop={8}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          opacity: pressed && onPress ? 0.7 : 1,
        },
        style,
      ]}
    >
      <Feather name={icon} size={18} color={colors.accent} />
    </Pressable>
  );
}
