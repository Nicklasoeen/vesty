import { useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import type { PortfolioRangeKey } from '@/demo/clubDemoData';
import type { OverallPerformancePoint } from '@/demo/homeDemoData';
import { buildSmoothLinePath, type Point2D } from '@/lib/smoothLinePath';
import { useTheme } from '@/theme';
import { AppText, RangeSelector } from '@/ui';
import { chartDomain, mapChartX, mapChartY } from './chartScale';
import { HOME_PORTFOLIO_RANGE_LABELS, HOME_PORTFOLIO_RANGE_OPTIONS } from './presentHomePortfolio';

const DEFAULT_CHART_HEIGHT = 100;
/** Fraction of each interval's width spent rising to the new invested total — the rest stays flat. */
const CONTRIBUTION_RISE_FRACTION = 0.3;

interface HomePerformanceChartProps {
  historyByRange: Record<PortfolioRangeKey, OverallPerformancePoint[]>;
  defaultRange?: PortfolioRangeKey;
  range?: PortfolioRangeKey;
  onRangeChange?: (range: PortfolioRangeKey) => void;
  valueLegendLabel?: string;
  performanceColor?: 'mint' | 'accent';
  rangeVariant?: 'underline' | 'segmented';
  chartHeight?: number;
  compactLegend?: boolean;
}

/**
 * Two-line comparison chart: portfolio value vs. invested capital across
 * all clubs. The gap between the lines *is* the unrealized gain/loss, so
 * both lines share one y-scale (computed from both series combined) —
 * scaling them independently would make the gap visually meaningless.
 * Value is foreground (solid, filled); invested capital is background
 * (dashed, muted) — a reference line, not a second headline number.
 */
export function HomePerformanceChart({
  historyByRange,
  defaultRange = '6M',
  range,
  onRangeChange,
  valueLegendLabel = 'Value',
  performanceColor = 'accent',
  rangeVariant = 'underline',
  chartHeight = DEFAULT_CHART_HEIGHT,
  compactLegend = false,
}: HomePerformanceChartProps) {
  const { colors, spacing } = useTheme();
  const [internalRange, setInternalRange] = useState<PortfolioRangeKey>(defaultRange);
  const [width, setWidth] = useState(0);
  const selectedRange = range ?? internalRange;
  const handleRangeChange = onRangeChange ?? setInternalRange;
  const lineColor = performanceColor === 'mint' ? colors.mint : colors.accent;

  const points = historyByRange[selectedRange];
  const geometry = useMemo(
    () => (width > 0 ? buildDualLineGeometry(points, width, chartHeight) : null),
    [chartHeight, points, width],
  );

  const handleLayout = (event: LayoutChangeEvent) => {
    const nextWidth = Math.round(event.nativeEvent.layout.width);
    if (nextWidth !== width) {
      setWidth(nextWidth);
    }
  };

  return (
    <View>
      <View style={[styles.legendRow, compactLegend ? styles.legendRowCompact : null]}>
        <LegendItem color={lineColor} label={valueLegendLabel} compact={compactLegend} />
        <LegendItem
          color={colors.textSecondary}
          label="Invested"
          style={{ marginLeft: compactLegend ? spacing.md : spacing.lg }}
          dashed
          compact={compactLegend}
        />
      </View>

      <View
        onLayout={handleLayout}
        style={[styles.chartFrame, { marginTop: compactLegend ? 2 : spacing.sm, height: chartHeight }]}
        accessibilityLabel="Overall performance history"
      >
        {geometry ? (
          <Svg width={width} height={chartHeight}>
            <Defs>
              <LinearGradient id="homePerformanceAreaFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor={lineColor} stopOpacity={performanceColor === 'mint' ? 0.26 : 0.16} />
                <Stop offset="100%" stopColor={lineColor} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Path d={geometry.areaPath} fill="url(#homePerformanceAreaFill)" />
            <Path
              d={geometry.investedLine}
              fill="none"
              stroke={colors.textSecondary}
              strokeWidth={1.5}
              strokeDasharray="4 4"
              strokeLinecap="round"
            />
            <Path
              d={geometry.valueLine}
              fill="none"
              stroke={lineColor}
              strokeWidth={performanceColor === 'mint' ? 3 : 2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        ) : null}
      </View>

      <RangeSelector
        options={HOME_PORTFOLIO_RANGE_OPTIONS}
        labels={HOME_PORTFOLIO_RANGE_LABELS}
        value={selectedRange}
        onChange={handleRangeChange}
        variant={rangeVariant}
        style={{ marginTop: compactLegend ? 2 : spacing.sm }}
      />
    </View>
  );
}

interface LegendItemProps {
  color: string;
  label: string;
  /** Renders a hollow ring instead of a solid dot, echoing the dashed line. */
  dashed?: boolean;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

function LegendItem({ color, label, dashed, compact, style }: LegendItemProps) {
  return (
    <View style={[styles.legendItem, style]}>
      <View
        style={[
          compact ? styles.legendMarkCompact : styles.legendMark,
          { borderColor: color, backgroundColor: dashed ? 'transparent' : color, borderWidth: dashed ? 1.5 : 0 },
        ]}
      />
      <AppText
        variant={compact ? 'statLabel' : 'meta'}
        style={styles.legendLabel}
      >
        {label}
      </AppText>
    </View>
  );
}

interface DualLineGeometry {
  valueLine: string;
  investedLine: string;
  areaPath: string;
}

function buildDualLineGeometry(
  points: OverallPerformancePoint[],
  width: number,
  chartHeight: number,
): DualLineGeometry | null {
  if (points.length < 2 || width <= 0) {
    return null;
  }

  const allValues = points.flatMap((point) => [point.portfolioValueNok, point.investedCapitalNok]);
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const { domainMin, domainMax } = chartDomain(min, max);
  const toY = (amount: number) => mapChartY(amount, domainMin, domainMax, chartHeight);
  const toX = (index: number) => mapChartX(index, points.length, width);

  const valuePoints: Point2D[] = points.map((point, index) => ({ x: toX(index), y: toY(point.portfolioValueNok) }));
  const investedPoints: Point2D[] = points.map((point, index) => ({ x: toX(index), y: toY(point.investedCapitalNok) }));

  const valueLine = buildSmoothLinePath(valuePoints);
  // Invested capital only moves when money is actually contributed, so it's
  // rendered as flat-then-rise segments rather than a smooth curve — reads
  // as discrete contribution events, not a second market line. The rise
  // covers the tail of each interval (not a hard vertical jump) so it
  // still feels drawn, not like a literal staircase chart.
  const investedLine = buildContributionStepPath(investedPoints);
  const last = valuePoints[valuePoints.length - 1];
  const first = valuePoints[0];
  const areaPath = `${valueLine} L ${last.x} ${chartHeight} L ${first.x} ${chartHeight} Z`;

  return { valueLine, investedLine, areaPath };
}

function buildContributionStepPath(points: Point2D[]): string {
  if (points.length < 2) {
    return '';
  }

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const riseStartX = current.x + (next.x - current.x) * (1 - CONTRIBUTION_RISE_FRACTION);
    path += ` L ${riseStartX} ${current.y} L ${next.x} ${next.y}`;
  }

  return path;
}

const styles = StyleSheet.create({
  chartFrame: {
    width: '100%',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendRowCompact: {
    minHeight: 14,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendMark: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendMarkCompact: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendLabel: {
    marginLeft: 4,
  },
});
