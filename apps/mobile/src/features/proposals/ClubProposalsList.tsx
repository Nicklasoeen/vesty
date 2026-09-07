import { ActivityIndicator, Pressable, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import type { ClubMemberIdentity } from '@/features/clubs/types';
import { useTheme } from '@/theme';
import { AppText, AvatarStack, Button } from '@/ui';

import { presentContributionProposalListRow } from './presentContributionProposal';
import {
  PROPOSAL_EMPTY_BODY,
  PROPOSAL_EMPTY_TITLE,
  findProposalMember,
  orderProposalElectorate,
  presentProposalListRow,
  splitProposalGroups,
} from './presentProposal';
import type { ClubProposalRecord } from './types';

interface ClubProposalsListProps {
  members: readonly ClubMemberIdentity[];
  proposals: readonly ClubProposalRecord[];
  isLoading: boolean;
  error: string | null;
  onOpen: (proposalId: string) => void;
  onRetry: () => void;
  onCreate: () => void;
}

function ProposalRow({
  proposal,
  members,
  onOpen,
}: {
  proposal: ClubProposalRecord;
  members: readonly ClubMemberIdentity[];
  onOpen: (proposalId: string) => void;
}) {
  const { colors, spacing } = useTheme();
  const proposer = findProposalMember(members, proposal.proposerMembershipId);
  const row =
    proposal.kind === 'contribution' && proposal.contribution
      ? {
          ...presentContributionProposalListRow({
            baseMode: proposal.contribution.baseMode,
            proposedMode: proposal.contribution.proposedMode,
            proposedEqualAmountMinor: proposal.contribution.proposedEqualAmountMinor,
            proposer,
            status: proposal.status,
            resolutionReason: proposal.resolutionReason,
            electorateSize: proposal.electorateSize,
            votesCast: proposal.votesVisible ? proposal.votes.length : null,
            votesVisible: proposal.votesVisible,
          }),
          effectiveLabel: null as string | null,
        }
      : presentProposalListRow({
          allocations: proposal.allocations,
          proposer,
          status: proposal.status,
          electorateSize: proposal.electorateSize,
          votesCast: proposal.votesVisible ? proposal.votes.length : null,
          votesVisible: proposal.votesVisible,
          intendedEffectiveAt: proposal.intendedEffectiveAt,
        });
  const portraits = orderProposalElectorate(proposal.electorateMembershipIds, members)
    .map((membershipId) => findProposalMember(members, membershipId))
    .filter((member): member is ClubMemberIdentity => member != null)
    .map((member) => ({
      id: member.membershipId,
      initials: member.initials,
      imageSource: member.imageSource,
    }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[row.eyebrow, row.title, row.proposedBy, row.progress, row.statusLabel]
        .filter(Boolean)
        .join(', ')}
      onPress={() => onOpen(proposal.id)}
      style={({ pressed }) => ({
        paddingVertical: spacing.md,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, paddingRight: spacing.sm }}>
          <AppText variant="label">{row.eyebrow}</AppText>
          <AppText variant="bodyStrong" style={{ marginTop: 2 }}>
            {row.title}
          </AppText>
          <AppText variant="supporting" style={{ marginTop: 2 }}>
            {row.proposedBy}
          </AppText>
          {portraits.length > 0 ? (
            <AvatarStack people={portraits} maxVisible={4} size="sm" style={{ marginTop: spacing.sm }} />
          ) : null}
          <AppText variant="supporting" style={{ marginTop: spacing.sm }}>
            {row.progress}
            {row.statusLabel ? `  ·  ${row.statusLabel}` : ''}
          </AppText>
          {row.effectiveLabel ? (
            <AppText variant="supporting" style={{ marginTop: 2 }}>
              {row.effectiveLabel}
            </AppText>
          ) : null}
        </View>
        <Feather name="chevron-right" size={18} color={colors.textSecondary} style={{ marginTop: 2 }} />
      </View>
    </Pressable>
  );
}
export function ClubProposalsList({
  members,
  proposals,
  isLoading,
  error,
  onOpen,
  onRetry,
  onCreate,
}: ClubProposalsListProps) {
  const { colors, spacing } = useTheme();
  const groups = splitProposalGroups(proposals);

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <AppText variant="subtitle" accessibilityRole="header">
          Proposals
        </AppText>
        {!isLoading && !error ? (
          <Button label="New proposal" variant="secondary" size="sm" onPress={onCreate} />
        ) : null}
      </View>

      {isLoading ? (
        <View style={{ paddingVertical: spacing.xl, alignItems: 'center' }}>
          <ActivityIndicator accessibilityLabel="Loading proposals" color={colors.accent} />
        </View>
      ) : error ? (
        <View style={{ marginTop: spacing.md }}>
          <AppText variant="supporting">{error}</AppText>
          <View style={{ marginTop: spacing.md }}>
            <Button label="Try again" variant="secondary" onPress={onRetry} />
          </View>
        </View>
      ) : proposals.length === 0 ? (
        <View style={{ marginTop: spacing.md }}>
          <AppText variant="bodyStrong">{PROPOSAL_EMPTY_TITLE}</AppText>
          <AppText variant="supporting" style={{ marginTop: spacing.sm }}>
            {PROPOSAL_EMPTY_BODY}
          </AppText>
        </View>
      ) : (
        <View style={{ marginTop: spacing.xs }}>
          {groups.open.length > 0 && groups.history.length > 0 ? (
            <AppText variant="label" style={{ marginTop: spacing.sm }}>
              Open
            </AppText>
          ) : null}
          {groups.open.map((proposal, index) => (
            <View
              key={proposal.id}
              style={{
                borderTopWidth: index === 0 && groups.history.length === 0 ? 0 : 1,
                borderTopColor: colors.border,
              }}
            >
              <ProposalRow proposal={proposal} members={members} onOpen={onOpen} />
            </View>
          ))}
          {groups.history.length > 0 ? (
            <AppText variant="label" style={{ marginTop: spacing.lg }}>
              Past proposals
            </AppText>
          ) : null}
          {groups.history.map((proposal) => (
            <View key={proposal.id} style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
              <ProposalRow proposal={proposal} members={members} onOpen={onOpen} />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
