import { useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import {
  PORTFOLIO_RANGE_OPTIONS,
  type PortfolioHistoryPoint,
  type PortfolioRangeKey,
} from '@/demo/clubDemoData';
import { buildSmoothLinePath, type Point2D } from '@/lib/smoothLinePath';
import { useTheme } from '@/theme';
import { RangeSelector } from '@/ui';

const CHART_HEIGHT = 148;
const VERTICAL_PADDING = 8;

interface PortfolioChartProps {
  historyByRange: Record<PortfolioRangeKey, PortfolioHistoryPoint[]>;
  defaultRange: PortfolioRangeKey;
}

/**
 * Design-spike portfolio history chart.
 * Custom SVG line + quiet area fill — not a charting framework.
 */
export function PortfolioChart({ historyByRange, defaultRange }: PortfolioChartProps) {
  const { colors, spacing } = useTheme();
  const [range, setRange] = useState<PortfolioRangeKey>(defaultRange);
  const [width, setWidth] = useState(0);

  const points = historyByRange[range];
  const geometry = useMemo(() => (width > 0 ? buildChartGeometry(points, width) : null), [points, width]);

  const handleLayout = (event: LayoutChangeEvent) => {
    const nextWidth = Math.round(event.nativeEvent.layout.width);
    if (nextWidth !== width) {
      setWidth(nextWidth);
    }
  };

  return (
    <View>
      <View onLayout={handleLayout} style={styles.chartFrame} accessibilityLabel="Portfolio value history">
        {geometry ? (
          <Svg width={width} height={CHART_HEIGHT}>
            <Defs>
              <LinearGradient id="portfolioAreaFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor={colors.accent} stopOpacity={0.18} />
                <Stop offset="100%" stopColor={colors.accent} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Path d={geometry.areaPath} fill="url(#portfolioAreaFill)" />
            <Path
              d={geometry.linePath}
              fill="none"
              stroke={colors.accent}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        ) : null}
      </View>

      <RangeSelector options={PORTFOLIO_RANGE_OPTIONS} value={range} onChange={setRange} style={{ marginTop: spacing.md }} />
    </View>
  );
}

interface ChartGeometry {
  linePath: string;
  areaPath: string;
}

function buildChartGeometry(points: PortfolioHistoryPoint[], width: number): ChartGeometry | null {
  if (points.length < 2 || width <= 0) {
    return null;
  }

  const values = points.map((point) => point.valueNok);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);
  const plotHeight = CHART_HEIGHT - VERTICAL_PADDING * 2;
  const stepX = width / (points.length - 1);

  const plotted: Point2D[] = points.map((point, index) => {
    const x = index * stepX;
    const normalized = (point.valueNok - min) / range;
    const y = VERTICAL_PADDING + plotHeight * (1 - normalized);
    return { x, y };
  });

  const linePath = buildSmoothLinePath(plotted);
  const last = plotted[plotted.length - 1];
  const first = plotted[0];
  const areaPath = `${linePath} L ${last.x} ${CHART_HEIGHT} L ${first.x} ${CHART_HEIGHT} Z`;

  return { linePath, areaPath };
}

const styles = StyleSheet.create({
  chartFrame: {
    width: '100%',
    height: CHART_HEIGHT,
  },
});
