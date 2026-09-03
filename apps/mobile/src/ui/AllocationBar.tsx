import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';
import { AppText } from './AppText';

export interface AllocationSlice {
  id: string;
  label: string;
  percentage: number;
}

interface AllocationBarProps {
  allocations: AllocationSlice[];
}

/**
 * Restrained strategy visualization: one segmented bar plus compact legend
 * rows. Deliberately not a pie chart — a single row reads faster for 3-5
 * categories and avoids the "decorative chart" look.
 */
export function AllocationBar({ allocations }: AllocationBarProps) {
  const { colors, spacing, radius } = useTheme();

  return (
    <View>
      <View style={[styles.track, { borderRadius: radius.sm, backgroundColor: colors.surfaceSecondary }]}>
        {allocations.map((allocation, index) => (
          <View
            key={allocation.id}
            style={{
              flex: allocation.percentage,
              backgroundColor: colors.chart[index % colors.chart.length],
              marginRight: index === allocations.length - 1 ? 0 : 2,
            }}
          />
        ))}
      </View>

      <View style={{ marginTop: spacing.lg }}>
        {allocations.map((allocation, index) => (
          <View
            key={allocation.id}
            style={[styles.legendRow, index > 0 ? { marginTop: spacing.sm + 2 } : undefined]}
          >
            <View style={styles.legendLeft}>
              <View style={[styles.dot, { backgroundColor: colors.chart[index % colors.chart.length] }]} />
              <AppText variant="body" style={{ marginLeft: spacing.sm }}>
                {allocation.label}
              </AppText>
            </View>
            <AppText variant="bodyStrong">{allocation.percentage}%</AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    height: 10,
    overflow: 'hidden',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  legendLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
