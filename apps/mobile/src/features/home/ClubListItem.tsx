import { Pressable, StyleSheet, View } from 'react-native';

import type { PortfolioHistoryPoint } from '@/demo/clubDemoData';
import { formatNok, formatSignedPercentage } from '@/lib/currency';
import { useTheme } from '@/theme';
import { AppText, AvatarStack, type AvatarPerson } from '@/ui';
import { Sparkline } from './Sparkline';

const SPARKLINE_WIDTH = 44;
const SPARKLINE_HEIGHT = 20;

interface ClubListItemProps {
  clubName: string;
  members: readonly AvatarPerson[];
  portfolioValueNok: number;
  returnPercentage: number;
  history: PortfolioHistoryPoint[];
  onPress?: () => void;
}

/**
 * Lightweight club row — people first, then a compact sparkline and value.
 * Reads as a personal club list, not a wealth-dashboard tile.
 */
export function ClubListItem({
  clubName,
  members,
  portfolioValueNok,
  returnPercentage,
  history,
  onPress,
}: ClubListItemProps) {
  const { spacing } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${clubName}, ${members.length} members`}
      style={({ pressed }) => [styles.row, { paddingVertical: spacing.md, opacity: pressed ? 0.6 : 1 }]}
    >
      <View style={styles.textBlock}>
        <AppText variant="bodyStrong">{clubName}</AppText>
        <AvatarStack people={members} size="stack" style={{ marginTop: 4 }} />
      </View>

      <View style={[styles.sparklineBox, { marginHorizontal: spacing.sm }]}>
        <Sparkline data={history} height={SPARKLINE_HEIGHT} />
      </View>

      <View style={styles.valueBlock}>
        <AppText variant="bodyStrong">{formatNok(portfolioValueNok)}</AppText>
        <AppText variant="meta" color="positive" style={{ marginTop: 2 }}>
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
