import { View } from 'react-native';

import type { PortfolioRangeKey } from '@/demo/clubDemoData';
import type { OverallPerformancePoint } from '@/demo/homeDemoData';
import { formatSignedNok, formatSignedPercentage, formatNok } from '@/lib/currency';
import { useTheme } from '@/theme';
import { AppText } from '@/ui';
import { HomePerformanceChart } from './HomePerformanceChart';

interface OverallPerformanceSectionProps {
  totalValueNok: number;
  gainNok: number;
  gainPercentage: number;
  historyByRange: Record<PortfolioRangeKey, OverallPerformancePoint[]>;
  defaultRange: PortfolioRangeKey;
}

/**
 * "How are my Vesty investments doing overall" — the aggregate across all
 * clubs. Mirrors Club's portfolio summary rhythm (quiet label, big number,
 * signed gain line, chart) so it reads as the same product, just zoomed
 * out to "all my clubs" instead of one. Deliberately no strategy/allocation
 * detail here — that stays on Club.
 */
export function OverallPerformanceSection({
  totalValueNok,
  gainNok,
  gainPercentage,
  historyByRange,
  defaultRange,
}: OverallPerformanceSectionProps) {
  const { spacing } = useTheme();

  return (
    <View>
      <AppText variant="body" color="secondary">
        Total value
      </AppText>
      <AppText variant="display" style={{ marginTop: spacing.xs }}>
        {formatNok(totalValueNok)}
      </AppText>
      <AppText variant="bodyStrong" color="positive" style={{ marginTop: spacing.sm }}>
        {formatSignedNok(gainNok)}
        {' \u00B7 '}
        {formatSignedPercentage(gainPercentage)}
      </AppText>

      <View style={{ marginTop: spacing.lg }}>
        <HomePerformanceChart historyByRange={historyByRange} defaultRange={defaultRange} />
      </View>
    </View>
  );
}
