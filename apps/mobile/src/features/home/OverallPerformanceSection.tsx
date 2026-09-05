import { Alert, Pressable, View } from 'react-native';

import type { PortfolioRangeKey } from '@/demo/clubDemoData';
import type { OverallPerformancePoint } from '@/demo/homeDemoData';
import { ESTIMATED_VALUATION_INFO } from '@/features/portfolio/valuationLabels';
import { formatSignedNok, formatSignedPercentage, formatNok } from '@/lib/currency';
import { useTheme } from '@/theme';
import { AppText } from '@/ui';
import { HomePerformanceChart } from './HomePerformanceChart';

interface OverallPerformanceSectionProps {
  totalValueNok: number;
  gainNok: number | null;
  gainPercentage: number | null;
  historyByRange: Record<PortfolioRangeKey, OverallPerformancePoint[]>;
  defaultRange: PortfolioRangeKey;
  caption?: string | null;
  valueLegendLabel?: string;
  isDemo?: boolean;
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
  caption,
  valueLegendLabel,
  isDemo = false,
}: OverallPerformanceSectionProps) {
  const { spacing } = useTheme();
  const gainColor = gainNok != null && gainNok < 0 ? 'negative' : 'positive';
  const hasChart = Object.values(historyByRange).some((points) => points.length >= 2);

  return (
    <View>
      <AppText variant="sectionTitle">Portfolio value</AppText>
      <AppText variant="display" style={{ marginTop: spacing.xs }}>
        {formatNok(totalValueNok)}
      </AppText>
      {gainNok != null && gainPercentage != null ? (
        <AppText variant="value" color={gainColor} style={{ marginTop: spacing.sm }}>
          {formatSignedNok(gainNok)}
          {' \u00B7 '}
          {formatSignedPercentage(gainPercentage)}
        </AppText>
      ) : null}
      {isDemo ? (
        <AppText variant="meta" color="secondary" style={{ marginTop: spacing.xs }}>
          Demo market value.
        </AppText>
      ) : caption ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${caption}. ${ESTIMATED_VALUATION_INFO}`}
          onPress={() => Alert.alert(caption, ESTIMATED_VALUATION_INFO)}
        >
          <AppText variant="meta" color="secondary" style={{ marginTop: spacing.xs }}>
            {caption}
          </AppText>
        </Pressable>
      ) : null}

      {hasChart ? (
        <View style={{ marginTop: spacing.md }}>
          <HomePerformanceChart
            historyByRange={historyByRange}
            defaultRange={defaultRange}
            valueLegendLabel={valueLegendLabel}
          />
        </View>
      ) : null}
    </View>
  );
}
