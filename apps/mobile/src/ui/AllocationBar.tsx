import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';
import { AppText } from './AppText';

export interface AllocationSlice {
  id: string;
  label: string;
  secondaryLabel?: string;
  percentage: number;
  ticker?: string;
}

interface AllocationBarProps {
  allocations: AllocationSlice[];
  /** Club Overview replaces the technical legend with friendly rows. */
  showLegend?: boolean;
}

/**
 * Restrained strategy visualization: one segmented bar plus compact legend
 * rows. Deliberately not a pie chart — a single row reads faster for 3-5
 * categories and avoids the "decorative chart" look.
 */
export function AllocationBar({ allocations, showLegend = true }: AllocationBarProps) {
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

      {showLegend ? (
        <View style={{ marginTop: spacing.lg }}>
        {allocations.map((allocation, index) => (
          <View
            key={allocation.id}
            style={[styles.legendRow, index > 0 ? { marginTop: spacing.sm + 2 } : undefined]}
          >
            <View style={styles.legendLeft}>
              <View style={[styles.dot, { backgroundColor: colors.chart[index % colors.chart.length] }]} />
              <View style={{ marginLeft: spacing.sm, flex: 1, paddingRight: spacing.sm }}>
                <AppText variant="body">{allocation.label}</AppText>
                {allocation.secondaryLabel ? (
                  <AppText variant="meta" color="secondary">
                    {allocation.secondaryLabel}
                  </AppText>
                ) : null}
              </View>
            </View>
            <AppText variant="bodyStrong">{allocation.percentage}%</AppText>
          </View>
        ))}
      </View>
      ) : null}
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
    flex: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
