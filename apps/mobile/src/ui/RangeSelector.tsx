import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';
import { AppText } from './AppText';

interface RangeSelectorProps<T extends string> {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * Restrained text-only range control (1M / 3M / 6M / 1Y / ALL), shared by
 * every chart that offers a time range — avoids two slightly different
 * range-selector implementations drifting apart.
 */
export function RangeSelector<T extends string>({ options, value, onChange, style }: RangeSelectorProps<T>) {
  const { colors } = useTheme();

  return (
    <View style={[styles.row, style]}>
      {options.map((option) => {
        const selected = option === value;
        return (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`Show ${option} history`}
            hitSlop={6}
            style={({ pressed }) => [
              styles.item,
              {
                opacity: pressed ? 0.6 : 1,
                borderBottomColor: selected ? colors.accent : 'transparent',
              },
            ]}
          >
            <AppText
              variant="meta"
              color={selected ? 'primary' : 'secondary'}
              style={selected ? styles.selected : undefined}
            >
              {option}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  item: {
    paddingVertical: 4,
    paddingHorizontal: 2,
    borderBottomWidth: 1.5,
    minWidth: 28,
    alignItems: 'center',
  },
  selected: {
    fontWeight: '700',
  },
});
