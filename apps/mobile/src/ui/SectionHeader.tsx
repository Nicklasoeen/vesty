import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';
import { AppText } from './AppText';

interface SectionHeaderProps {
  title: string;
  style?: StyleProp<ViewStyle>;
}

export function SectionHeader({ title, style }: SectionHeaderProps) {
  const { spacing } = useTheme();

  return (
    <View style={[{ marginBottom: spacing.sm }, style]}>
      <AppText variant="subtitle" color="primary">{title}</AppText>
    </View>
  );
}
