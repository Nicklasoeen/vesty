import { useId, useState, type PropsWithChildren } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useTheme } from '@/theme';
import { Surface } from '@/ui';

/**
 * Shared Investment Day material. Home and Club keep their own content
 * and layout; this only provides the dark premium surface and lighting.
 */
export function InvestmentDayCard({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const { colors, colorScheme } = useTheme();
  const dark = colorScheme === 'dark';

  return (
    <Surface
      variant="secondary"
      style={[
        {
          overflow: 'hidden',
          backgroundColor: dark ? 'rgba(16, 30, 40, 0.96)' : colors.surfaceSecondary,
          borderWidth: 1,
          borderTopColor: dark ? 'rgba(79, 166, 184, 0.22)' : 'rgba(3, 44, 60, 0.14)',
          borderRightColor: dark ? 'rgba(79, 166, 184, 0.10)' : 'rgba(3, 44, 60, 0.07)',
          borderBottomColor: dark ? 'rgba(79, 166, 184, 0.07)' : 'rgba(3, 44, 60, 0.05)',
          borderLeftColor: dark ? 'rgba(79, 166, 184, 0.28)' : 'rgba(3, 44, 60, 0.18)',
        },
        style,
      ]}
    >
      <CardMaterialShine dark={dark} />
      {children}
    </Surface>
  );
}

function CardMaterialShine({ dark }: { dark: boolean }) {
  const reactId = useId().replace(/:/g, '');
  const [size, setSize] = useState({ width: 0, height: 0 });

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width !== size.width || height !== size.height) {
      setSize({ width, height });
    }
  };

  const { width, height } = size;
  const light = dark ? 'rgb(206, 226, 232)' : 'rgb(255, 255, 255)';
  const edge = dark ? 'rgb(79, 166, 184)' : 'rgb(3, 44, 60)';
  const catchId = `investmentDayCatch-${reactId}`;
  const reflectionId = `investmentDayReflection-${reactId}`;
  const leftCatchId = `investmentDayLeftCatch-${reactId}`;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} onLayout={handleLayout}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient
              id={catchId}
              x1={0}
              y1={0}
              x2={width * 0.42}
              y2={height * 0.62}
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0" stopColor={edge} stopOpacity={dark ? 0.14 : 0.10} />
              <Stop offset="0.38" stopColor={light} stopOpacity={dark ? 0.05 : 0.08} />
              <Stop offset="1" stopColor={light} stopOpacity={0} />
            </LinearGradient>
            <RadialGradient
              id={reflectionId}
              cx={width * 0.04}
              cy={0}
              rx={width * 0.58}
              ry={height * 0.36}
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0" stopColor={light} stopOpacity={dark ? 0.10 : 0.20} />
              <Stop offset="0.5" stopColor={light} stopOpacity={dark ? 0.03 : 0.07} />
              <Stop offset="1" stopColor={light} stopOpacity={0} />
            </RadialGradient>
            <RadialGradient
              id={leftCatchId}
              cx={0}
              cy={height * 0.12}
              rx={14}
              ry={height * 0.72}
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0" stopColor={edge} stopOpacity={dark ? 0.16 : 0.10} />
              <Stop offset="0.45" stopColor={edge} stopOpacity={dark ? 0.05 : 0.04} />
              <Stop offset="1" stopColor={edge} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect width={width} height={height} fill={`url(#${catchId})`} />
          <Rect width={width} height={height} fill={`url(#${reflectionId})`} />
          <Rect width={width} height={height} fill={`url(#${leftCatchId})`} />
        </Svg>
      ) : null}
    </View>
  );
}
