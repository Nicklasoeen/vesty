import { Pressable, StyleSheet, View } from 'react-native';

import type { PortfolioHistoryPoint } from '@/demo/clubDemoData';
import { formatNok, formatSignedPercentage } from '@/lib/currency';
import { useTheme } from '@/theme';
import { AppText } from '@/ui';
import { Sparkline } from './Sparkline';

const SPARKLINE_WIDTH = 44;
const SPARKLINE_HEIGHT = 20;

interface ClubListItemProps {
  clubName: string;
  memberCount: number;
  portfolioValueNok: number;
  returnPercentage: number;
  history: PortfolioHistoryPoint[];
  onPress?: () => void;
}

/**
 * Lightweight club row — typography and a compact sparkline, not a card.
 * Reads like a personal watchlist row (name+members left, trend middle,
 * value+return right) rather than a wealth-dashboard tile, and scales
 * naturally from one club to many without every entry needing its own
 * large surface.
 */
export function ClubListItem({ clubName, memberCount, portfolioValueNok, returnPercentage, history, onPress }: ClubListItemProps) {
  const { spacing } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${clubName}`}
      style={({ pressed }) => [styles.row, { paddingVertical: spacing.md, opacity: pressed ? 0.6 : 1 }]}
    >
      <View style={styles.textBlock}>
        <AppText variant="bodyStrong">{clubName}</AppText>
        <AppText variant="caption" color="secondary" style={{ marginTop: 2 }}>
          {memberCount} members
        </AppText>
      </View>

      <View style={[styles.sparklineBox, { marginHorizontal: spacing.sm }]}>
        <Sparkline data={history} height={SPARKLINE_HEIGHT} />
      </View>

      <View style={styles.valueBlock}>
        <AppText variant="bodyStrong">{formatNok(portfolioValueNok)}</AppText>
        <AppText variant="caption" color="positive" style={{ marginTop: 2 }}>
          {formatSignedPercentage(returnPercentage)}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  textBlock: {
    flex: 1,
  },
  sparklineBox: {
    width: SPARKLINE_WIDTH,
  },
  valueBlock: {
    alignItems: 'flex-end',
  },
});
