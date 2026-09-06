import { Feather, Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { useTheme } from '@/theme';
import { AppText, AvatarStack, Stat, Surface, type AvatarPerson } from '@/ui';

import {
  formatHomeNok,
  formatHomeSignedPercentage,
  HOME_PINNED_STAT_LABELS,
  pinnedClubStackSpacing,
} from './presentHomeMoney';

interface HomePinnedClubCardProps {
  name: string;
  members: readonly AvatarPerson[];
  memberCount: number;
  groupValueNok: number | null;
  yourStakeNok: number | null;
  returnPercentage: number | null;
  onOpenClub: () => void;
}

export function HomePinnedClubCard({
  name,
  members,
  memberCount,
  groupValueNok,
  yourStakeNok,
  returnPercentage,
  onOpenClub,
}: HomePinnedClubCardProps) {
  const { colors, radius, spacing } = useTheme();
  const returnColor = returnPercentage != null && returnPercentage < 0 ? 'negative' : 'positive';
  const stackSpacing = pinnedClubStackSpacing(members.length);

  return (
    <Pressable
      onPress={onOpenClub}
      accessibilityRole="button"
      accessibilityLabel={`Open ${name}`}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
    >
      <Surface bordered elevated style={{ padding: spacing.md + 2, borderRadius: radius.xl }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <View style={{ flex: 1, minWidth: 0, paddingRight: spacing.sm }}>
            <AppText variant="title" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
              {name}
            </AppText>
            <AppText variant="supporting" style={{ marginTop: 2 }}>
              {memberCount} {memberCount === 1 ? 'member' : 'members'}
            </AppText>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Ionicons name="star" size={20} color={colors.accent} accessibilityLabel="Pinned on Home" />
            <Feather name="chevron-right" size={24} color={colors.accent} />
          </View>
        </View>

        <AvatarStack
          people={members}
          maxVisible={3}
          size="xl"
          style={{ marginTop: stackSpacing.marginTop, marginBottom: stackSpacing.marginBottom }}
        />

        <View
          style={{
            flexDirection: 'row',
            borderTopWidth: 1,
            borderTopColor: colors.border,
            paddingTop: spacing.sm + 2,
          }}
        >
          <Stat value={groupValueNok != null ? formatHomeNok(groupValueNok) : '—'} label={HOME_PINNED_STAT_LABELS[0]} />
          <View style={{ width: 1, backgroundColor: colors.border, marginHorizontal: spacing.sm }} />
          <Stat value={yourStakeNok != null ? formatHomeNok(yourStakeNok) : '—'} label={HOME_PINNED_STAT_LABELS[1]} />
          <View style={{ width: 1, backgroundColor: colors.border, marginHorizontal: spacing.sm }} />
          <Stat
            value={returnPercentage != null ? formatHomeSignedPercentage(returnPercentage) : '—'}
            label={HOME_PINNED_STAT_LABELS[2]}
            valueColor={returnPercentage != null ? returnColor : 'secondary'}
          />
        </View>
      </Surface>
    </Pressable>
  );
}
