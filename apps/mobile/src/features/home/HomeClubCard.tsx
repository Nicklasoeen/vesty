import { Pressable, View } from 'react-native';

import { formatHomeNok, formatHomeSignedPercentage } from './presentHomeMoney';
import { useTheme } from '@/theme';
import { AppText, AvatarStack, Surface, type AvatarPerson } from '@/ui';

const CARD_TINTS = ['#F2FBF8', '#F3F7FD', '#FFF8F0'] as const;

interface HomeClubCardProps {
  name: string;
  members: readonly AvatarPerson[];
  memberCount: number;
  valueNok: number | null;
  returnPercentage: number | null;
  tintIndex: number;
  onPress: () => void;
}

export function HomeClubCard({
  name,
  members,
  memberCount,
  valueNok,
  returnPercentage,
  tintIndex,
  onPress,
}: HomeClubCardProps) {
  const { colorScheme, colors, radius, spacing } = useTheme();
  const tint = colorScheme === 'dark' ? colors.surface : CARD_TINTS[tintIndex % CARD_TINTS.length];

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${name}`}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1, width: 118 })}
    >
      <Surface
        bordered
        elevated
        style={{
          padding: spacing.md,
          backgroundColor: tint,
          minHeight: 112,
          borderRadius: radius.lg,
        }}
      >
        <AvatarStack people={members} maxVisible={3} size="stack" />
        <AppText variant="label" color="primary" numberOfLines={1} style={{ marginTop: spacing.sm }}>
          {name}
        </AppText>
        <AppText variant="statLabel" numberOfLines={1} style={{ marginTop: 1 }}>
          {memberCount} {memberCount === 1 ? 'member' : 'members'}
        </AppText>
        <View style={{ marginTop: spacing.sm }}>
          <AppText variant="statValue" numberOfLines={1}>
            {valueNok != null ? formatHomeNok(valueNok) : '—'}
          </AppText>
          {returnPercentage != null ? (
            <AppText
              variant="statLabel"
              color={returnPercentage < 0 ? 'negative' : 'positive'}
              style={{ marginTop: 1 }}
            >
              {formatHomeSignedPercentage(returnPercentage)}
            </AppText>
          ) : null}
        </View>
      </Surface>
    </Pressable>
  );
}
