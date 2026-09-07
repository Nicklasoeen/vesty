import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { needsFlexibleContributionSetup, presentClubContributionSummary, presentOwnFlexibleContribution } from '../clubs/presentContribution.ts';

import {
  CONTRIBUTION_APPLIES_FUTURE_COPY,
  CONTRIBUTION_OUTDATED_COPY,
  CONTRIBUTION_PROPOSAL_EYEBROW,
  STRATEGY_PROPOSAL_EYEBROW,
  contributionProposalCopyContainsForbidden,
  isOutdatedContributionProposal,
  mergeClubProposalFeed,
  presentApprovedContributionResult,
  presentContributionCreateOptions,
  presentContributionProposalDetail,
  presentContributionProposalListRow,
  presentContributionProposalReview,
  presentContributionProposalStatus,
  presentContributionProposalTitle,
  shouldAttemptContributionFinalize,
} from './presentContributionProposal.ts';
import { presentProposalListRow, presentProposalTitle, splitProposalGroups } from './presentProposal.ts';

const members = [
  { membershipId: 'm1', displayName: 'Espen Holm', initials: 'EH' },
  { membershipId: 'm2', displayName: 'Anna', initials: 'A' },
  { membershipId: 'm3', displayName: 'Marius', initials: 'M' },
];

describe('unified proposal list presentation', () => {
  it('lets strategy and contribution proposals coexist with human titles', () => {
    const strategy = presentProposalListRow({
      allocations: [
        { targetName: 'World', allocationBps: 4000 },
        { targetName: 'Nasdaq', allocationBps: 3500 },
        { targetName: 'S&P', allocationBps: 1500 },
        { targetName: 'EM', allocationBps: 1000 },
      ],
      proposer: members[0] ?? null,
      status: 'open',
      electorateSize: 3,
      votesCast: 1,
      votesVisible: false,
      intendedEffectiveAt: null,
    });
    const contribution = presentContributionProposalListRow({
      baseMode: 'equal',
      proposedMode: 'equal',
      proposedEqualAmountMinor: 300000,
      proposer: members[0] ?? null,
      status: 'open',
      resolutionReason: null,
      electorateSize: 3,
      votesCast: 1,
      votesVisible: false,
    });

    assert.equal(strategy.eyebrow, STRATEGY_PROPOSAL_EYEBROW);
    assert.equal(contribution.eyebrow, CONTRIBUTION_PROPOSAL_EYEBROW);
    assert.match(strategy.title, /strategy/i);
    assert.equal(contribution.title, 'Change contribution to 3\u00a0000 kr');
    assert.equal(contribution.progress.includes('1 of 3'), false);
    assert.equal(strategy.progress.includes('1 of 3'), false);

    const groups = splitProposalGroups([
      { status: 'open' as const, kind: 'strategy' },
      { status: 'approved' as const, kind: 'contribution' },
    ]);
    assert.equal(groups.open.length, 1);
    assert.equal(groups.history.length, 1);
  });

  it('sorts a shared feed by open/create time without leaking Flexible amounts', () => {
    const merged = mergeClubProposalFeed([
      { id: 'older', openedAt: '2026-09-01T10:00:00.000Z', createdAt: '2026-09-01T09:00:00.000Z', closedAt: null },
      { id: 'newer', openedAt: '2026-09-06T10:00:00.000Z', createdAt: '2026-09-06T09:00:00.000Z', closedAt: null },
    ]);
    assert.deepEqual(merged.map((item) => item.id), ['newer', 'older']);

    const flexibleRow = presentContributionProposalListRow({
      baseMode: 'flexible',
      proposedMode: 'equal',
      proposedEqualAmountMinor: 250000,
      proposer: members[0] ?? null,
      status: 'open',
      resolutionReason: null,
      electorateSize: 3,
      votesCast: null,
      votesVisible: false,
    });
    assert.equal(flexibleRow.title, 'Switch to 2\u00a0500 kr for everyone');
    assert.doesNotMatch(flexibleRow.title, /999|average|private amount/i);
  });
});

describe('contribution proposal titles', () => {
  it('uses beginner copy for each supported change', () => {
    assert.equal(
      presentContributionProposalTitle({
        baseMode: 'equal',
        proposedMode: 'equal',
        proposedEqualAmountMinor: 300000,
      }).title,
      'Change contribution to 3\u00a0000 kr',
    );
    assert.equal(
      presentContributionProposalTitle({
        baseMode: 'equal',
        proposedMode: 'flexible',
        proposedEqualAmountMinor: null,
      }).title,
      'Switch to flexible contributions',
    );
    assert.equal(
      presentContributionProposalTitle({
        baseMode: 'flexible',
        proposedMode: 'equal',
        proposedEqualAmountMinor: 250000,
      }).title,
      'Switch to 2\u00a0500 kr for everyone',
    );
  });
});

describe('create options stay privacy-safe', () => {
  it('does not expose private member data from Flexible clubs', () => {
    const options = presentContributionCreateOptions({
      currentMode: 'flexible',
      currentEqualAmountMinor: 180000,
    });
    assert.deepEqual(options.actions, ['switch_to_equal']);
    assert.equal(options.showsMemberAmounts, false);
    assert.doesNotMatch(options.currentDetail, /\d/);
    assert.equal(options.currentStyle, 'Flexible amounts');
  });
});

describe('contribution proposal detail', () => {
  it('presents Same to Same with proposer identity and no open tally', () => {
    const presented = presentContributionProposalDetail({
      baseMode: 'equal',
      baseEqualAmountMinor: 200000,
      proposedMode: 'equal',
      proposedEqualAmountMinor: 300000,
      proposer: members[0] ?? null,
      status: 'open',
      resolutionReason: null,
      votingThresholdKind: 'simple_majority',
      electorateSize: 3,
      electorateMembershipIds: members.map((member) => member.membershipId),
      votes: [],
      votesVisible: false,
      viewerMembershipId: 'm2',
      sessionChoice: undefined,
      alreadyVotedUnknownChoice: false,
      deadlineAt: new Date(Date.now() + 60_000).toISOString(),
      members,
    });

    assert.equal(presented.proposedBy, 'Espen proposes');
    assert.equal(presented.title, 'Change contribution to 3\u00a0000 kr');
    assert.equal(presented.currentSummary, 'Same amount · 2\u00a0000 kr');
    assert.equal(presented.proposedSummary, 'Same amount · 3\u00a0000 kr');
    assert.equal(presented.progress, '3 members vote');
    assert.equal(presented.canVote, true);
    assert.deepEqual(
      presented.voters.map((voter) => voter.state),
      ['Pending', 'Pending', 'Pending'],
    );
    assert.equal(presented.appliesCopy, CONTRIBUTION_APPLIES_FUTURE_COPY);
    assert.equal(contributionProposalCopyContainsForbidden(presented.explanation), false);
  });

  it('presents Same to Flexible without implying an immediate payment', () => {
    const presented = presentContributionProposalDetail({
      baseMode: 'equal',
      baseEqualAmountMinor: 200000,
      proposedMode: 'flexible',
      proposedEqualAmountMinor: null,
      proposer: members[0] ?? null,
      status: 'open',
      resolutionReason: null,
      votingThresholdKind: 'simple_majority',
      electorateSize: 3,
      electorateMembershipIds: members.map((member) => member.membershipId),
      votes: [],
      votesVisible: false,
      viewerMembershipId: 'm1',
      sessionChoice: undefined,
      alreadyVotedUnknownChoice: false,
      deadlineAt: new Date(Date.now() + 60_000).toISOString(),
      members,
    });

    assert.equal(presented.title, 'Switch to flexible contributions');
    assert.equal(presented.proposedSummary, 'Flexible amounts');
    assert.match(presented.explanation, /2\s?000 kr/);
    assert.match(presented.explanation, /future Investment Days/);
    assert.doesNotMatch(presented.explanation, /immediately|payment|bank/i);
  });

  it('presents Flexible to Same without private current amounts', () => {
    const presented = presentContributionProposalDetail({
      baseMode: 'flexible',
      baseEqualAmountMinor: 180000,
      proposedMode: 'equal',
      proposedEqualAmountMinor: 250000,
      proposer: members[0] ?? null,
      status: 'open',
      resolutionReason: null,
      votingThresholdKind: 'unanimous',
      electorateSize: 3,
      electorateMembershipIds: members.map((member) => member.membershipId),
      votes: [],
      votesVisible: false,
      viewerMembershipId: 'm1',
      sessionChoice: 'yes',
      alreadyVotedUnknownChoice: false,
      deadlineAt: new Date(Date.now() + 60_000).toISOString(),
      members,
    });

    assert.equal(presented.currentSummary, 'Flexible amounts');
    assert.equal(presented.proposedSummary, 'Same amount · 2\u00a0500 kr');
    assert.doesNotMatch(presented.currentSummary, /\d/);
    assert.equal(presented.canVote, false);
    assert.equal(presented.viewerVoteCopy, 'You voted For');
    assert.deepEqual(
      presented.voters.map((voter) => voter.state),
      ['For', 'Pending', 'Pending'],
    );
  });
});

describe('contribution proposal review', () => {
  it('explains future-only application', () => {
    const review = presentContributionProposalReview({
      currentMode: 'equal',
      currentEqualAmountMinor: 200000,
      proposedMode: 'flexible',
      proposedEqualAmountMinor: null,
    });
    assert.equal(review.currentStyle, 'Same amount');
    assert.equal(review.proposedStyle, 'Flexible amounts');
    assert.match(review.appliesCopy, /hasn't started yet/);
    assert.match(review.transitionCopy ?? '', /2\s?000 kr/);
    assert.doesNotMatch(review.transitionCopy ?? '', /commitment|immediately/i);
  });
});

describe('voting privacy and finalize timing', () => {
  it('does not invent an open tally and only finalizes after deadline or a vote path', () => {
    const presented = presentContributionProposalDetail({
      baseMode: 'equal',
      baseEqualAmountMinor: 200000,
      proposedMode: 'equal',
      proposedEqualAmountMinor: 300000,
      proposer: members[0] ?? null,
      status: 'open',
      resolutionReason: null,
      votingThresholdKind: 'simple_majority',
      electorateSize: 3,
      electorateMembershipIds: members.map((member) => member.membershipId),
      votes: [
        { membershipId: 'm1', choice: 'yes' },
        { membershipId: 'm2', choice: 'no' },
      ],
      votesVisible: false,
      viewerMembershipId: 'm3',
      sessionChoice: undefined,
      alreadyVotedUnknownChoice: false,
      deadlineAt: new Date(Date.now() + 60_000).toISOString(),
      members,
    });

    assert.equal(presented.progress, '3 members vote');
    assert.deepEqual(
      presented.voters.map((voter) => voter.state),
      ['Pending', 'Pending', 'Pending'],
    );
    assert.equal(
      shouldAttemptContributionFinalize({
        kind: 'contribution',
        status: 'open',
        deadlineAt: new Date(Date.now() + 60_000).toISOString(),
      }),
      false,
    );
    assert.equal(
      shouldAttemptContributionFinalize({
        kind: 'contribution',
        status: 'open',
        deadlineAt: new Date(Date.now() - 60_000).toISOString(),
      }),
      true,
    );
    assert.equal(
      shouldAttemptContributionFinalize({
        kind: 'strategy',
        status: 'open',
        deadlineAt: new Date(Date.now() - 60_000).toISOString(),
      }),
      false,
    );
  });
});

describe('terminal contribution statuses', () => {
  it('maps Approved, Not approved, Expired, Cancelled, and Outdated', () => {
    assert.equal(
      presentContributionProposalStatus({ status: 'approved', resolutionReason: 'vote_approved' }),
      'Approved',
    );
    assert.equal(
      presentContributionProposalStatus({ status: 'rejected', resolutionReason: 'vote_rejected' }),
      'Not approved',
    );
    assert.equal(
      presentContributionProposalStatus({ status: 'expired', resolutionReason: 'expired' }),
      'Expired',
    );
    assert.equal(
      presentContributionProposalStatus({ status: 'cancelled', resolutionReason: 'cancelled' }),
      'Cancelled',
    );
    assert.equal(
      presentContributionProposalStatus({ status: 'rejected', resolutionReason: 'stale_base' }),
      'Outdated',
    );
    assert.equal(isOutdatedContributionProposal('stale_base'), true);
    assert.equal(isOutdatedContributionProposal('vote_rejected'), false);

    const outdated = presentContributionProposalDetail({
      baseMode: 'equal',
      baseEqualAmountMinor: 200000,
      proposedMode: 'equal',
      proposedEqualAmountMinor: 300000,
      proposer: members[0] ?? null,
      status: 'rejected',
      resolutionReason: 'stale_base',
      votingThresholdKind: 'simple_majority',
      electorateSize: 3,
      electorateMembershipIds: members.map((member) => member.membershipId),
      votes: [
        { membershipId: 'm1', choice: 'yes' },
        { membershipId: 'm2', choice: 'yes' },
      ],
      votesVisible: true,
      viewerMembershipId: 'm3',
      sessionChoice: undefined,
      alreadyVotedUnknownChoice: false,
      deadlineAt: '2026-09-01T12:00:00.000Z',
      members,
    });
    assert.equal(outdated.statusLabel, 'Outdated');
    assert.equal(outdated.description, CONTRIBUTION_OUTDATED_COPY);
    assert.doesNotMatch(`${outdated.statusLabel} ${outdated.description}`, /not approved|rejected/i);

    const rejectedDespiteYesTally = presentContributionProposalDetail({
      baseMode: 'equal',
      baseEqualAmountMinor: 200000,
      proposedMode: 'equal',
      proposedEqualAmountMinor: 300000,
      proposer: members[0] ?? null,
      status: 'rejected',
      resolutionReason: 'vote_rejected',
      votingThresholdKind: 'simple_majority',
      electorateSize: 3,
      electorateMembershipIds: members.map((member) => member.membershipId),
      votes: [
        { membershipId: 'm1', choice: 'yes' },
        { membershipId: 'm2', choice: 'yes' },
      ],
      votesVisible: true,
      viewerMembershipId: 'm3',
      sessionChoice: undefined,
      alreadyVotedUnknownChoice: false,
      deadlineAt: '2026-09-01T12:00:00.000Z',
      members,
    });
    assert.equal(rejectedDespiteYesTally.statusLabel, 'Not approved');
    assert.equal(isOutdatedContributionProposal('vote_rejected'), false);

    const approved = presentApprovedContributionResult({
      baseMode: 'equal',
      baseEqualAmountMinor: 200000,
      proposedMode: 'equal',
      proposedEqualAmountMinor: 300000,
    });
    assert.equal(approved, '2\u00a0000 kr → 3\u00a0000 kr');
  });
});

describe('post-approval club UI presentation', () => {
  it('shows the initialized private amount after Same to Flexible', () => {
    const policy = presentClubContributionSummary({
      clubId: 'club-a',
      policyVersionId: 'policy-2',
      mode: 'flexible',
      currency: 'NOK',
      equalAmountMinor: null,
    });
    const own = presentOwnFlexibleContribution({
      clubId: 'club-a',
      membershipId: 'm1',
      commitmentVersionId: 'c2',
      versionNumber: 1,
      amountMinor: 200000,
      currency: 'NOK',
      createdAt: '2026-09-06T00:00:00.000Z',
    });

    assert.equal(policy.styleLabel, 'Flexible amounts');
    assert.equal(own.label, 'Your contribution');
    assert.match(own.amountLabel ?? '', /2\s?000 kr/);
    assert.equal(
      needsFlexibleContributionSetup(
        {
          clubId: 'club-a',
          policyVersionId: 'policy-2',
          mode: 'flexible',
          currency: 'NOK',
          equalAmountMinor: null,
        },
        {
          clubId: 'club-a',
          membershipId: 'm1',
          commitmentVersionId: 'c2',
          versionNumber: 1,
          amountMinor: 200000,
          currency: 'NOK',
          createdAt: '2026-09-06T00:00:00.000Z',
        },
      ),
      false,
    );
  });

  it('hides the personal editor after Flexible to Same', () => {
    const policy = presentClubContributionSummary({
      clubId: 'club-a',
      policyVersionId: 'policy-3',
      mode: 'equal',
      currency: 'NOK',
      equalAmountMinor: 250000,
    });
    assert.equal(policy.styleLabel, 'Same amount');
    assert.match(policy.detail, /2\s?500 kr/);
    assert.equal(
      needsFlexibleContributionSetup(
        {
          clubId: 'club-a',
          policyVersionId: 'policy-3',
          mode: 'equal',
          currency: 'NOK',
          equalAmountMinor: 250000,
        },
        {
          clubId: 'club-a',
          membershipId: 'm1',
          commitmentVersionId: 'old',
          versionNumber: 1,
          amountMinor: 180000,
          currency: 'NOK',
          createdAt: '2026-08-01T00:00:00.000Z',
        },
      ),
      false,
    );
  });
});

describe('strategy proposal regression', () => {
  it('keeps the existing strategy title helper', () => {
    const presented = presentProposalTitle([
      { targetName: 'World', ticker: 'VWCE', allocationBps: 10000 },
    ]);
    assert.match(presented.title, /strategy/i);
    assert.equal(contributionProposalCopyContainsForbidden('Market buy your next payment'), true);
  });
});
