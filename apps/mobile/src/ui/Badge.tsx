import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';
import { AppText } from './AppText';

interface BadgeProps {
  label: string;
  style?: StyleProp<ViewStyle>;
}

/** Compact mint-soft pill for status such as Estimated. */
export function Badge({ label, style }: BadgeProps) {
  const { colors, radius, spacing } = useTheme();

  return (
    <View
      style={[
        {
          alignSelf: 'flex-start',
          backgroundColor: colors.mintSoft,
          borderRadius: radius.full,
          paddingHorizontal: spacing.sm + 1,
          paddingVertical: spacing.xs + 2,
        },
        style,
      ]}
    >
      <AppText variant="meta" color="accent" style={{ fontWeight: '700', fontSize: 11, lineHeight: 14 }}>
        {label}
      </AppText>
    </View>
  );
}
