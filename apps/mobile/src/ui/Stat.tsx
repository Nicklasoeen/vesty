import { View, type StyleProp, type ViewStyle } from 'react-native';

import { AppText, type AppTextColor } from './AppText';

interface StatProps {
  value: string;
  label: string;
  valueColor?: AppTextColor;
  style?: StyleProp<ViewStyle>;
}

/** Compact labeled figure. Home cards place these in a horizontal row. */
export function Stat({ value, label, valueColor = 'primary', style }: StatProps) {
  return (
    <View style={[{ minWidth: 0, flex: 1 }, style]}>
      <AppText
        variant="statValue"
        color={valueColor}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.62}
      >
        {value}
      </AppText>
      <AppText variant="statLabel" numberOfLines={1} style={{ marginTop: 2 }}>
        {label}
      </AppText>
    </View>
  );
}
