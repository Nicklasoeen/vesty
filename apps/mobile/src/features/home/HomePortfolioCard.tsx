import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';

import type { OverallPerformancePoint } from '@/demo/homeDemoData';
import { ESTIMATED_VALUATION_INFO } from '@/features/portfolio/valuationLabels';
import { useTheme } from '@/theme';
import { AppText, Button, Stat, Surface } from '@/ui';

import { HomePerformanceChart } from './HomePerformanceChart';
import {
  formatHomeGainLine,
  formatHomeNokFromMinor,
  formatHomeSignedBps,
  HOME_PORTFOLIO_STAT_LABELS,
} from './presentHomeMoney';
import {
  HOME_PORTFOLIO_DEFAULT_RANGE,
  type HomePortfolioPresentation,
  type HomePortfolioRangeKey,
} from './presentHomePortfolio';

interface HomePortfolioCardProps {
  presentation: HomePortfolioPresentation;
  historyByRange: Record<HomePortfolioRangeKey, OverallPerformancePoint[]>;
  onRetry: () => void;
}

export function HomePortfolioCard({ presentation, historyByRange, onRetry }: HomePortfolioCardProps) {
  const { colors, radius, spacing } = useTheme();
  const [range, setRange] = useState<HomePortfolioRangeKey>(HOME_PORTFOLIO_DEFAULT_RANGE);
  const gainColor = presentation.gainLossMinor != null && presentation.gainLossMinor < 0 ? 'negative' : 'positive';
  const hasChart =
    presentation.status === 'available'
    && Object.values(historyByRange).some((points) => points.length >= 2);

  return (
    <Surface bordered elevated style={{ padding: spacing.md + 2, borderRadius: radius.xl }}>
      <AppText variant="label">Your portfolio</AppText>
      {presentation.status === 'loading' ? (
        <View style={{ paddingVertical: spacing.lg, alignItems: 'center' }}>
          <ActivityIndicator accessibilityLabel="Loading portfolio" color={colors.accent} />
        </View>
      ) : presentation.status === 'error' ? (
        <View style={{ marginTop: spacing.sm }}>
          <AppText variant="supporting">{presentation.detail}</AppText>
          <View style={{ marginTop: spacing.md }}>
            <Button label="Try again" variant="secondary" onPress={onRetry} />
          </View>
        </View>
      ) : (
        <>
          {presentation.valueMinor !== null ? (
            <AppText
              variant="display"
              style={{ marginTop: 2 }}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.55}
            >
              {formatHomeNokFromMinor(presentation.valueMinor)}
            </AppText>
          ) : (
            <AppText variant="title" style={{ marginTop: spacing.xs }}>
              Value unavailable
            </AppText>
          )}
          {presentation.gainLossMinor != null && presentation.gainLossBps != null ? (
            <AppText
              variant="value"
              color={gainColor}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              style={{ marginTop: 1 }}
            >
              {formatHomeGainLine(presentation.gainLossMinor, presentation.gainLossBps)}
            </AppText>
          ) : null}

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: 2 }}>
            <AppText variant="supporting">{presentation.detail}</AppText>
            {presentation.caption ? (
              <>
                <AppText variant="supporting">{'  ·  '}</AppText>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${presentation.caption}. ${ESTIMATED_VALUATION_INFO}`}
                  onPress={() => Alert.alert(presentation.caption ?? 'Estimated', ESTIMATED_VALUATION_INFO)}
                  hitSlop={6}
                >
                  <AppText variant="supporting">{presentation.caption}</AppText>
                </Pressable>
              </>
            ) : null}
          </View>

          {hasChart ? (
            <View style={{ marginTop: 4 }}>
              <HomePerformanceChart
                historyByRange={historyByRange}
                range={range}
                onRangeChange={setRange}
                valueLegendLabel={presentation.chartLabel}
                performanceColor="mint"
                rangeVariant="segmented"
                chartHeight={108}
                compactLegend
              />
            </View>
          ) : null}

          <View
            style={{
              marginTop: spacing.sm + 2,
              paddingTop: spacing.sm + 2,
              borderTopWidth: 1,
              borderTopColor: colors.border,
              flexDirection: 'row',
            }}
          >
            <Stat
              value={presentation.investedMinor !== null ? formatHomeNokFromMinor(presentation.investedMinor) : '—'}
              label="Reported invested"
            />
            <View style={{ width: 1, backgroundColor: colors.border, marginHorizontal: spacing.sm }} />
            <Stat
              value={presentation.gainLossBps != null ? formatHomeSignedBps(presentation.gainLossBps) : '—'}
              label={HOME_PORTFOLIO_STAT_LABELS[1]}
              valueColor={presentation.gainLossBps != null && presentation.gainLossBps < 0 ? 'negative' : 'positive'}
            />
            <View style={{ width: 1, backgroundColor: colors.border, marginHorizontal: spacing.sm }} />
            <Stat value={String(presentation.activeClubs)} label={HOME_PORTFOLIO_STAT_LABELS[2]} />
          </View>
        </>
      )}
    </Surface>
  );
}
