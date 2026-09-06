import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { presentClubStrategy } from '@/features/club-dashboard/presentClubDashboard';
import type { ClubMemberIdentity } from '@/features/clubs/types';
import { useClubStrategy } from '@/features/clubs/useClubStrategy';
import { useTheme } from '@/theme';
import { AppText, Avatar, Button, IconButton } from '@/ui';

import {
  ProposalVoteError,
  presentProposalDetail,
  voteChoiceFromAction,
  type VoteAction,
  type VoteStateLabel,
} from './presentProposal';
import type { ClubProposalRecord } from './types';

interface ClubProposalDetailProps {
  clubId: string;
  proposal: ClubProposalRecord;
  members: readonly ClubMemberIdentity[];
  viewerMembershipId: string;
  sessionChoice: 'yes' | 'no' | null | undefined;
  alreadyVotedUnknownChoice: boolean;
  onBack: () => void;
  onCastVote: (choice: 'yes' | 'no') => Promise<void>;
}

function voteStateColor(
  state: VoteStateLabel,
  colors: { positive: string; negative: string; textSecondary: string },
): string {
  if (state === 'For') {
    return colors.positive;
  }
  if (state === 'Against') {
    return colors.negative;
  }
  return colors.textSecondary;
}

export function ClubProposalDetail({
  clubId,
  proposal,
  members,
  viewerMembershipId,
  sessionChoice,
  alreadyVotedUnknownChoice,
  onBack,
  onCastVote,
}: ClubProposalDetailProps) {
  const { colors, radius, spacing } = useTheme();
  const { allocations } = useClubStrategy(clubId);
  const currentStrategy = presentClubStrategy(allocations);
  const [voteError, setVoteError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<VoteAction | null>(null);
  const presented = presentProposalDetail({
    allocations: proposal.allocations,
    proposer: members.find((member) => member.membershipId === proposal.proposerMembershipId) ?? null,
    status: proposal.status,
    votingThresholdKind: proposal.votingThresholdKind,
    electorateSize: proposal.electorateSize,
    electorateMembershipIds: proposal.electorateMembershipIds,
    votes: proposal.votes,
    votesVisible: proposal.votesVisible,
    viewerMembershipId,
    sessionChoice,
    alreadyVotedUnknownChoice,
    deadlineAt: proposal.deadlineAt,
    intendedEffectiveAt: proposal.intendedEffectiveAt,
    currentStrategyName: currentStrategy.packageName,
    members,
  });
  const wrapVoters = presented.voters.length > 4;
  const progressRatio =
    proposal.votesVisible && proposal.electorateSize > 0
      ? Math.min(1, proposal.votes.length / proposal.electorateSize)
      : null;

  const submit = async (action: VoteAction) => {
    if (busyAction || !presented.canVote) {
      return;
    }
    setBusyAction(action);
    setVoteError(null);
    try {
      await onCastVote(voteChoiceFromAction(action));
    } catch (caught) {
      setVoteError(
        caught instanceof ProposalVoteError || caught instanceof Error
          ? caught.message
          : 'Unable to save your vote right now.',
      );
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginTop: spacing.sm,
          marginBottom: spacing.lg,
        }}
      >
        <IconButton icon="arrow-left" accessibilityLabel="Back to proposals" onPress={onBack} />
        <AppText variant="label" style={{ marginLeft: spacing.sm }}>
          Proposal
        </AppText>
      </View>

      <AppText variant="supporting">{presented.proposedBy}</AppText>
      <AppText variant="supporting" style={{ marginTop: spacing.md }}>
        {presented.titleLead}
      </AppText>
      {presented.titleEmphasis ? (
        <AppText variant="hero" accessibilityRole="header" style={{ marginTop: 2 }}>
          {presented.titleEmphasis}
        </AppText>
      ) : (
        <AppText variant="hero" accessibilityRole="header" style={{ marginTop: 2 }}>
          {presented.title}
        </AppText>
      )}
      {presented.description ? (
        <AppText variant="supporting" style={{ marginTop: spacing.sm }}>
          {presented.description}
        </AppText>
      ) : null}

      {presented.currentStrategyName || presented.proposedStrategyName ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: spacing.xl,
          }}
        >
          <View style={{ flex: 1 }}>
            <AppText variant="label">Current</AppText>
            <AppText variant="bodyStrong" style={{ marginTop: 2 }}>
              {presented.currentStrategyName ?? '—'}
            </AppText>
          </View>
          <AppText variant="supporting" style={{ marginHorizontal: spacing.sm }}>
            →
          </AppText>
          <View style={{ flex: 1 }}>
            <AppText variant="label">Proposed</AppText>
            <AppText variant="bodyStrong" style={{ marginTop: 2 }}>
              {presented.proposedStrategyName ?? presented.title}
            </AppText>
          </View>
        </View>
      ) : null}

      {presented.friendlyLines.length > 0 ? (
        <View style={{ marginTop: spacing.lg }}>
          {presented.friendlyLines.map((line) => (
            <AppText key={line} variant="supporting" style={{ marginTop: 2 }}>
              {line}
            </AppText>
          ))}
        </View>
      ) : null}

      <AppText variant="label" style={{ marginTop: spacing.xxl }}>
        Voting
      </AppText>
      <AppText variant="supporting" style={{ marginTop: spacing.xs }}>
        {presented.progress}
        {presented.votingRule ? `  ·  ${presented.votingRule} required` : ''}
      </AppText>
      {progressRatio != null ? (
        <View
          style={{
            height: 3,
            borderRadius: radius.full,
            backgroundColor: colors.border,
            marginTop: spacing.sm,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              width: `${Math.round(progressRatio * 100)}%`,
              height: '100%',
              backgroundColor: colors.mint,
            }}
          />
        </View>
      ) : null}

      {presented.voters.length > 0 ? (
        <ScrollView
          horizontal={wrapVoters}
          scrollEnabled={wrapVoters}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            marginTop: spacing.lg,
            gap: spacing.md,
            flexDirection: 'row',
            flexWrap: wrapVoters ? 'nowrap' : 'wrap',
          }}
        >
          {presented.voters.map((voter) => {
            const member = members.find((item) => item.membershipId === voter.membershipId);
            return (
              <View key={voter.membershipId} style={{ width: 72, alignItems: 'center' }}>
                <Avatar initials={voter.initials} imageSource={member?.imageSource} size="lg" />
                <AppText variant="meta" style={{ marginTop: spacing.xs }} numberOfLines={1}>
                  {voter.firstName}
                </AppText>
                <AppText
                  variant="supporting"
                  style={{ marginTop: 1, color: voteStateColor(voter.state, colors) }}
                >
                  {voter.state}
                </AppText>
              </View>
            );
          })}
        </ScrollView>
      ) : null}

      {presented.details.length > 0 ? (
        <View style={{ marginTop: spacing.xxl }}>
          {presented.details.map((row, index) => (
            <View
              key={row.label}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                paddingVertical: spacing.md,
                borderTopWidth: index === 0 ? 1 : 0,
                borderBottomWidth: 1,
                borderColor: colors.border,
              }}
            >
              <AppText variant="supporting">{row.label}</AppText>
              <AppText variant="body" style={{ marginLeft: spacing.lg, textAlign: 'right', flexShrink: 1 }}>
                {row.value}
              </AppText>
            </View>
          ))}
        </View>
      ) : null}

      {presented.viewerVoteCopy ? (
        <AppText variant="bodyStrong" style={{ marginTop: spacing.xl }}>
          {presented.viewerVoteCopy}
        </AppText>
      ) : null}

      {voteError ? (
        <AppText variant="supporting" color="negative" style={{ marginTop: spacing.md }}>
          {voteError}
        </AppText>
      ) : null}

      {presented.canVote ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl }}>
          <View style={{ flex: 1 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={presented.voteAgainstLabel}
              accessibilityState={{ disabled: busyAction != null, busy: busyAction === 'against' }}
              disabled={busyAction != null}
              onPress={() => {
                void submit('against');
              }}
              style={({ pressed }) => ({
                minHeight: 44,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: busyAction != null ? 0.4 : pressed ? 0.85 : 1,
              })}
            >
              <AppText variant="bodyStrong" color="negative">
                {presented.voteAgainstLabel}
              </AppText>
            </Pressable>
          </View>
          <View style={{ flex: 1 }}>
            <Button
              label={presented.voteForLabel}
              variant="primary"
              block
              busy={busyAction === 'for'}
              disabled={busyAction != null}
              onPress={() => {
                void submit('for');
              }}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}
