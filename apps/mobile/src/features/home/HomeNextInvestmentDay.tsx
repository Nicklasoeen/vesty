import { Feather } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { formatNokFromMinor } from '@/lib/currency';
import { useTheme } from '@/theme';
import { AppText, Surface } from '@/ui';

interface HomeNextInvestmentDayProps {
  dateLabel: string;
  plannedMinor: number | null;
  onPress?: () => void;
}

export function HomeNextInvestmentDay({ dateLabel, plannedMinor, onPress }: HomeNextInvestmentDayProps) {
  const { colors, radius, spacing } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? 'Open Invest for next Investment Day' : undefined}
      style={({ pressed }) => ({ opacity: onPress && pressed ? 0.85 : 1 })}
    >
      <Surface
        bordered
        elevated
        style={{
          padding: spacing.md,
          flexDirection: 'row',
          alignItems: 'center',
          borderRadius: radius.xl,
        }}
      >
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: radius.lg,
            backgroundColor: colors.mintSoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Feather name="calendar" size={20} color={colors.accent} />
        </View>
        <View style={{ flex: 1, marginHorizontal: spacing.md, minWidth: 0 }}>
          <AppText variant="label">Next Investment Day</AppText>
          <AppText variant="subtitle" numberOfLines={1} style={{ marginTop: 1 }}>
            {dateLabel}
          </AppText>
          {plannedMinor != null ? (
            <AppText variant="supporting" style={{ marginTop: 2 }}>
              {formatNokFromMinor(plannedMinor)} planned
            </AppText>
          ) : null}
        </View>
        <Feather name="chevron-right" size={22} color={colors.accent} />
      </Surface>
    </Pressable>
  );
}
