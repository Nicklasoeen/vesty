import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';
import { AppText } from './AppText';

type RangeSelectorVariant = 'underline' | 'segmented';

interface RangeSelectorProps<T extends string> {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  labels?: Partial<Record<T, string>>;
  variant?: RangeSelectorVariant;
  style?: StyleProp<ViewStyle>;
}

/**
 * Restrained text-only range control (1M / 3M / 6M / 1Y / ALL), shared by
 * every chart that offers a time range — avoids two slightly different
 * range-selector implementations drifting apart.
 */
export function RangeSelector<T extends string>({
  options,
  value,
  onChange,
  labels,
  variant = 'underline',
  style,
}: RangeSelectorProps<T>) {
  const { colors } = useTheme();
  const segmented = variant === 'segmented';

  return (
    <View
      style={[
        styles.row,
        segmented
          ? {
              backgroundColor: colors.surfaceSecondary,
              borderRadius: 15,
              padding: 3,
            }
          : null,
        style,
      ]}
    >
      {options.map((option) => {
        const selected = option === value;
        const label = labels?.[option] ?? option;
        return (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`Show ${label} history`}
            hitSlop={6}
            style={({ pressed }) => [
              styles.item,
              segmented ? styles.segment : null,
              {
                opacity: pressed ? 0.6 : 1,
                borderBottomColor: segmented ? 'transparent' : selected ? colors.accent : 'transparent',
                backgroundColor: segmented && selected ? colors.mintSoft : 'transparent',
                borderRadius: segmented ? 11 : 0,
              },
            ]}
          >
            <AppText
              variant={segmented ? 'statLabel' : 'meta'}
              color={selected ? (segmented ? 'accent' : 'primary') : 'secondary'}
              style={selected ? styles.selected : undefined}
            >
              {label}
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
  segment: {
    flex: 1,
    borderBottomWidth: 0,
    paddingVertical: 6,
    minHeight: 30,
  },
  selected: {
    fontWeight: '700',
  },
});
