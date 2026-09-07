import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

const COLORS = ['#032C3C', '#C9F1DC', '#79A88B', '#BDE4CE', '#EEFAF4'] as const;

interface CreateClubConfettiProps {
  play: boolean;
}

export function CreateClubConfetti({ play }: CreateClubConfettiProps) {
  if (!play) {
    return null;
  }

  return <ConfettiBurst />;
}

function ConfettiBurst() {
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setFinished(true), 1600);
    return () => clearTimeout(timer);
  }, []);

  if (finished) {
    return null;
  }

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden>
      {COLORS.flatMap((color, colorIndex) =>
        Array.from({ length: 5 }, (_, pieceIndex) => {
          const index = colorIndex * 5 + pieceIndex;
          return <ConfettiPiece key={index} color={color} index={index} />;
        }),
      )}
    </View>
  );
}

function ConfettiPiece({ color, index }: { color: string; index: number }) {
  const progress = useSharedValue(0);
  const side = index % 2 === 0 ? -1 : 1;
  const spread = 36 + ((index * 47) % 150);
  const peak = -60 - ((index * 23) % 100);
  const drop = 120 + ((index * 29) % 180);

  useEffect(() => {
    progress.value = withDelay(
      (index % 6) * 22,
      withTiming(1, {
        duration: 1100 + (index % 5) * 70,
        easing: Easing.bezier(0.18, 0.72, 0.28, 1),
      }),
    );
  }, [index, progress]);

  const style = useAnimatedStyle(() => {
    const t = progress.value;
    const lift = t < 0.55 ? peak * (t / 0.55) : peak + (drop - peak) * ((t - 0.55) / 0.45);
    const x = side * spread * t;
    return {
      opacity: t === 0 ? 0 : t > 0.85 ? 1 - (t - 0.85) / 0.15 : 1,
      transform: [
        { translateX: x },
        { translateY: lift },
        { rotate: `${index * 41 * t}deg` },
        { scale: 0.3 + t * 0.7 },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: '50%',
          top: '32%',
          width: 5 + (index % 3) * 2,
          height: index % 4 === 0 ? 7 : 13,
          borderRadius: index % 4 === 0 ? 99 : 2,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}
