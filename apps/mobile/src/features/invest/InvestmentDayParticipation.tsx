import { Alert, Pressable, ScrollView, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { useTheme } from '@/theme';
import { AppText, Avatar } from '@/ui';

import type { InvestmentDayParticipationMember } from './participationApi';
import {
  presentInvestmentDayParticipation,
  presentParticipationMember,
} from './presentParticipation';

interface InvestmentDayParticipationProps {
  completedCount: number;
  totalCount: number;
  allCompleted: boolean;
  members: readonly InvestmentDayParticipationMember[];
}

export function InvestmentDayParticipationSection({
  completedCount,
  totalCount,
  allCompleted,
  members,
}: InvestmentDayParticipationProps) {
  const { colors, radius, spacing } = useTheme();
  const presented = presentInvestmentDayParticipation({
    completedCount,
    totalCount,
    allCompleted,
  });
  const wrap = members.length > 6;

  return (
    <View
      style={{
        marginBottom: spacing.xl,
        padding: allCompleted ? spacing.md : 0,
        borderRadius: allCompleted ? radius.xl : 0,
        backgroundColor: allCompleted ? colors.mintSoft : 'transparent',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <AppText variant="sectionTitle" style={{ flex: 1 }}>
          {presented.allCompletedTitle ?? presented.title}
        </AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${presented.privacyInfo} ${presented.reportingInfo}`}
          onPress={() => Alert.alert('Investment Day', `${presented.privacyInfo}\n\n${presented.reportingInfo}`)}
          hitSlop={8}
        >
          <Feather name="info" size={16} color={colors.textSecondary} />
        </Pressable>
      </View>

      <AppText variant="supporting" style={{ marginTop: spacing.xs }}>
        {presented.allCompletedSubtitle ?? presented.countLabel}
      </AppText>

      {members.length > 0 ? (
        <ScrollView
          horizontal={wrap}
          scrollEnabled={wrap}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            marginTop: spacing.lg,
            gap: spacing.md,
            flexDirection: 'row',
            flexWrap: wrap ? 'nowrap' : 'wrap',
          }}
        >
          {members.map((member) => {
            const row = presentParticipationMember({
              displayName: member.displayName,
              completed: member.completed,
              currentStreak: member.currentStreak,
            });

            return (
              <View key={member.membershipId} style={{ width: 72, alignItems: 'center' }}>
                <View>
                  <Avatar
                    initials={member.initials}
                    imageSource={member.imageSource}
                    size="lg"
                    ring={member.completed ? 'ready' : 'pending'}
                  />
                  {member.completed ? (
                    <View
                      style={{
                        position: 'absolute',
                        right: -2,
                        bottom: -2,
                        width: 16,
                        height: 16,
                        borderRadius: 8,
                        backgroundColor: colors.positive,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Feather name="check" size={10} color={colors.onAccent} />
                    </View>
                  ) : null}
                </View>
                <AppText variant="meta" style={{ marginTop: spacing.xs }} numberOfLines={1}>
                  {row.firstName}
                </AppText>
                <AppText
                  variant="supporting"
                  color={member.completed ? 'positive' : 'secondary'}
                  style={{ marginTop: 1 }}
                >
                  {row.statusLabel}
                </AppText>
                {row.streakLabel ? (
                  <AppText variant="supporting" style={{ marginTop: 1 }}>
                    {row.streakLabel}
                  </AppText>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );
}
