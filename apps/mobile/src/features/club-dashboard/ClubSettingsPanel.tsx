import { View } from 'react-native';

import { governanceLabel, GOVERNANCE_OPTIONS } from '@/features/clubs/governance';
import type { ClubSummary } from '@/features/clubs/types';
import { useTheme } from '@/theme';
import { AppText, Avatar, Button, SectionHeader } from '@/ui';

import { clubMemberCountLabel, presentClubSettingsItems } from './presentClubDashboard';

interface ClubSettingsPanelProps {
  club: ClubSummary;
  onInvite: () => void;
}

export function ClubSettingsPanel({ club, onInvite }: ClubSettingsPanelProps) {
  const { spacing } = useTheme();
  const items = presentClubSettingsItems({ isOwner: club.isOwner });
  const governance = GOVERNANCE_OPTIONS.find((option) => option.value === club.governanceThresholdKind);

  return (
    <View>
      {items.details ? (
        <View style={{ marginBottom: spacing.lg }}>
          <SectionHeader title="Club details" />
          <AppText variant="subtitle">{club.name}</AppText>
          <AppText variant="supporting" style={{ marginTop: 2 }}>
            {clubMemberCountLabel(club.members.length)}
          </AppText>
        </View>
      ) : null}

      {items.members ? (
        <View style={{ marginBottom: spacing.lg }}>
          <SectionHeader title="Members" />
          {club.members.map((member) => (
            <View
              key={member.membershipId}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                minHeight: 44,
                marginBottom: spacing.sm,
              }}
            >
              <Avatar initials={member.initials} imageSource={member.imageSource} size="md" />
              <AppText variant="body" style={{ marginLeft: spacing.sm, flex: 1 }} numberOfLines={1}>
                {member.displayName?.trim() || 'Member'}
              </AppText>
            </View>
          ))}
        </View>
      ) : null}

      {items.governance ? (
        <View style={{ marginBottom: spacing.lg }}>
          <SectionHeader title="Governance" />
          <AppText variant="bodyStrong">{governanceLabel(club.governanceThresholdKind)}</AppText>
          {governance ? (
            <AppText variant="supporting" style={{ marginTop: 2 }}>
              {governance.description}
            </AppText>
          ) : null}
        </View>
      ) : null}

      {items.invite ? (
        <Button label="Invite member" variant="secondary" onPress={onInvite} />
      ) : null}
    </View>
  );
}
