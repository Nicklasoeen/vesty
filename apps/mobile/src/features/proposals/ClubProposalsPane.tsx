import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import type { ClubContributionPolicy } from '@/features/clubs/contributionPolicy';
import type { ClubSummary } from '@/features/clubs/types';
import { useTheme } from '@/theme';
import { AppText, Button } from '@/ui';

import { ClubProposalDetail } from './ClubProposalDetail';
import { ClubProposalsList } from './ClubProposalsList';
import { CreateContributionProposalForm } from './CreateContributionProposalForm';
import { CreateProposalKindPanel } from './CreateProposalKindPanel';
import { ReviewContributionProposal } from './ReviewContributionProposal';
import {
  validateContributionProposalDraft,
  type ContributionProposalDraft,
  type ValidContributionProposalDraft,
} from './createContributionProposal';
import type { useClubProposals } from './useClubProposals';

type ProposalsView = 'list' | 'kind' | 'create' | 'review' | 'detail';

interface ClubProposalsPaneProps {
  club: ClubSummary;
  proposalsState: ReturnType<typeof useClubProposals>;
  policy: ClubContributionPolicy | null;
  policyLoading: boolean;
  policyError: string | null;
  onRetryPolicy: () => void;
  onFocusChange?: (focused: boolean) => void;
  onPolicyMaybeChanged?: () => void;
}

const EMPTY_DRAFT: ContributionProposalDraft = {
  action: null,
  amountInput: '',
};

export function ClubProposalsPane({
  club,
  proposalsState,
  policy,
  policyLoading,
  policyError,
  onRetryPolicy,
  onFocusChange,
  onPolicyMaybeChanged,
}: ClubProposalsPaneProps) {
  const { colors, spacing } = useTheme();
  const [view, setView] = useState<ProposalsView>('list');
  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ContributionProposalDraft>(EMPTY_DRAFT);
  const [proposed, setProposed] = useState<ValidContributionProposalDraft | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const selectedProposal =
    proposalsState.proposals.find((proposal) => proposal.id === selectedProposalId) ?? null;
  const sessionVote = selectedProposal ? proposalsState.sessionVotes[selectedProposal.id] : undefined;

  const focused = view !== 'list';

  useEffect(() => {
    onFocusChange?.(focused);
    return () => onFocusChange?.(false);
  }, [focused, onFocusChange]);

  const resetCreate = () => {
    setDraft(EMPTY_DRAFT);
    setProposed(null);
    setFormError(null);
    setSubmitError(null);
    setBusy(false);
  };

  if (view === 'detail' && selectedProposal) {
    return (
      <ClubProposalDetail
        clubId={club.clubId}
        proposal={selectedProposal}
        members={club.members}
        viewerMembershipId={club.membershipId}
        sessionChoice={sessionVote?.choice}
        alreadyVotedUnknownChoice={sessionVote != null && sessionVote.choice == null}
        onBack={() => {
          setSelectedProposalId(null);
          setView('list');
        }}
        onCastVote={async (choice) => {
          await proposalsState.castVote(selectedProposal.id, club.membershipId, choice);
          onPolicyMaybeChanged?.();
        }}
        onResolve={async () => {
          await proposalsState.resolveContributionProposal(selectedProposal.id);
          onPolicyMaybeChanged?.();
        }}
      />
    );
  }

  if (view === 'kind') {
    return (
      <CreateProposalKindPanel
        onBack={() => setView('list')}
        onSelectContribution={() => {
          resetCreate();
          setView('create');
        }}
      />
    );
  }

  if (view === 'create') {
    if (policyLoading) {
      return (
        <View style={{ paddingVertical: spacing.xl, alignItems: 'center' }}>
          <ActivityIndicator accessibilityLabel="Loading contribution settings" color={colors.accent} />
        </View>
      );
    }
    if (!policy || policyError) {
      return (
        <View style={{ marginTop: spacing.md }}>
          <AppText variant="supporting">{policyError ?? 'Unable to load contribution settings'}</AppText>
          <View style={{ marginTop: spacing.md }}>
            <Button label="Try again" variant="secondary" onPress={onRetryPolicy} />
          </View>
          <View style={{ marginTop: spacing.md }}>
            <Button label="Back" variant="secondary" onPress={() => setView('kind')} />
          </View>
        </View>
      );
    }

    return (
      <CreateContributionProposalForm
        policy={policy}
        draft={draft}
        error={formError}
        onChange={(next) => {
          setDraft(next);
          setFormError(null);
        }}
        onBack={() => {
          resetCreate();
          setView('kind');
        }}
        onContinue={() => {
          const validated = validateContributionProposalDraft({
            currentMode: policy.mode,
            currentEqualAmountMinor: policy.equalAmountMinor,
            action: draft.action,
            amountInput: draft.amountInput,
          });
          if (!validated.ok) {
            setFormError(validated.error);
            return;
          }
          setProposed(validated.value);
          setView('review');
        }}
      />
    );
  }

  if (view === 'review' && policy && proposed) {
    return (
      <ReviewContributionProposal
        policy={policy}
        proposed={proposed}
        error={submitError}
        busy={busy}
        onBack={() => {
          setSubmitError(null);
          setView('create');
        }}
        onOpen={() => {
          if (busy) {
            return;
          }
          setBusy(true);
          setSubmitError(null);
          void proposalsState
            .createAndOpenContributionProposal({
              basePolicyVersionId: policy.policyVersionId,
              proposedMode: proposed.proposedMode,
              proposedEqualAmountMinor: proposed.proposedEqualAmountMinor,
            })
            .then((proposalId) => {
              resetCreate();
              onPolicyMaybeChanged?.();
              setSelectedProposalId(proposalId);
              setView('detail');
            })
            .catch((caught: unknown) => {
              setSubmitError(caught instanceof Error ? caught.message : 'Unable to open this proposal');
              setBusy(false);
            });
        }}
      />
    );
  }

  return (
    <ClubProposalsList
      members={club.members}
      proposals={proposalsState.proposals}
      isLoading={proposalsState.isLoading}
      error={proposalsState.error}
      onOpen={(proposalId) => {
        setSelectedProposalId(proposalId);
        setView('detail');
      }}
      onRetry={() => {
        void proposalsState.refresh();
      }}
      onCreate={() => setView('kind')}
    />
  );
}
