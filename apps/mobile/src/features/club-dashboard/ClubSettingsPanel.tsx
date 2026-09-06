import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { governanceLabel, GOVERNANCE_OPTIONS } from '@/features/clubs/governance';
import { clubDecidesContributionStyleCopy, presentClubContributionSummary, presentOwnFlexibleContribution } from '@/features/clubs/presentContribution';
import type { ClubSummary } from '@/features/clubs/types';
import { useClubContribution } from '@/features/clubs/useClubContribution';
import { useTheme } from '@/theme';
import { AppText, Avatar, Button, SectionHeader } from '@/ui';

import { clubMemberCountLabel, presentClubSettingsItems } from './presentClubDashboard';

interface ClubSettingsPanelProps {
  club: ClubSummary;
  onInvite: () => void;
  onEditName: () => void;
}

export function ClubSettingsPanel({ club, onInvite, onEditName }: ClubSettingsPanelProps) {
  const { spacing } = useTheme();
  const router = useRouter();
  const items = presentClubSettingsItems({ isOwner: club.isOwner });
  const governance = GOVERNANCE_OPTIONS.find((option) => option.value === club.governanceThresholdKind);
  const contribution = useClubContribution(club.clubId);
  const contributionSummary = contribution.policy
    ? presentClubContributionSummary(contribution.policy)
    : null;
  const ownContribution = contribution.policy?.mode === 'flexible'
    ? presentOwnFlexibleContribution(contribution.commitment)
    : null;

  return (
    <View>
      {items.details ? (
        <View style={{ marginBottom: spacing.lg }}>
          <SectionHeader title="Club details" />
          <AppText variant="subtitle">{club.name}</AppText>
          <AppText variant="supporting" style={{ marginTop: 2 }}>
            {clubMemberCountLabel(club.members.length)}
          </AppText>
          {items.editDetails ? (
            <View style={{ marginTop: spacing.md }}>
              <Button label="Edit name" variant="secondary" onPress={onEditName} />
            </View>
          ) : null}
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

      {items.contributions && contributionSummary ? (
        <View style={{ marginBottom: spacing.lg }}>
          <SectionHeader title={contributionSummary.title} />
          <AppText variant="bodyStrong">{contributionSummary.styleLabel}</AppText>
          <AppText variant="supporting" style={{ marginTop: 2 }}>
            {contributionSummary.detail}
          </AppText>
          {ownContribution ? (
            <View style={{ marginTop: spacing.md }}>
              <AppText variant="body">{ownContribution.label}</AppText>
              <AppText variant="supporting" style={{ marginTop: 2 }}>
                {ownContribution.amountLabel ?? 'Not set yet'}
              </AppText>
              <AppText variant="supporting" style={{ marginTop: 2 }}>
                {ownContribution.privacy}
              </AppText>
              <View style={{ marginTop: spacing.md }}>
                <Button
                  label={ownContribution.amountLabel ? 'Edit' : 'Set amount'}
                  variant="secondary"
                  onPress={() => {
                    router.push({
                      pathname: '/clubs/contribution-setup',
                      params: { clubId: club.clubId },
                    });
                  }}
                />
              </View>
            </View>
          ) : (
            <AppText variant="supporting" style={{ marginTop: spacing.sm }}>
              {clubDecidesContributionStyleCopy()}
            </AppText>
          )}
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
