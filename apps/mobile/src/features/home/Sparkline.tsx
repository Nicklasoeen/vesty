import { useMemo, useState } from 'react';
import { LayoutChangeEvent, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import type { PortfolioHistoryPoint } from '@/demo/clubDemoData';
import { useTheme } from '@/theme';

interface SparklineProps {
  data: PortfolioHistoryPoint[];
  height?: number;
}

/**
 * Minimal glance-only trend line for a club preview row. Deliberately
 * simpler than the full Club portfolio chart (straight segments, no area
 * fill, no range selector) — Home only needs to signal "trending up", the
 * detailed chart belongs to Club.
 */
export function Sparkline({ data, height = 32 }: SparklineProps) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);

  const path = useMemo(() => (width > 0 ? buildSparklinePath(data, width, height) : null), [data, width, height]);

  const handleLayout = (event: LayoutChangeEvent) => {
    const nextWidth = Math.round(event.nativeEvent.layout.width);
    if (nextWidth !== width) {
      setWidth(nextWidth);
    }
  };

  return (
    <View onLayout={handleLayout} style={{ width: '100%', height }} accessibilityLabel="Portfolio trend">
      {path ? (
        <Svg width={width} height={height}>
          <Path d={path} fill="none" stroke={colors.positive} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      ) : null}
    </View>
  );
}

function buildSparklinePath(data: PortfolioHistoryPoint[], width: number, height: number): string | null {
  if (data.length < 2) {
    return null;
  }

  const values = data.map((point) => point.valueNok);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);
  const stepX = width / (data.length - 1);
  const padding = 2;
  const plotHeight = height - padding * 2;

  return data
    .map((point, index) => {
      const x = index * stepX;
      const normalized = (point.valueNok - min) / range;
      const y = padding + plotHeight * (1 - normalized);
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');
}
