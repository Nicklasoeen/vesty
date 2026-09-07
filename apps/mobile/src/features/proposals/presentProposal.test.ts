import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { getCuratedPackage } from '../clubs/curatedInvestmentPackages.ts';

import {
  PROPOSAL_EMPTY_BODY,
  PROPOSAL_EMPTY_TITLE,
  VOTE_AGAINST_LABEL,
  VOTE_FOR_LABEL,
  canCastProposalVote,
  presentProposalDetail,
  presentProposalListRow,
  presentProposalStatus,
  presentProposalTitle,
  presentVoteState,
  presentVotingProgress,
  presentVotingRule,
  proposalCopyContainsForbidden,
  proposalFirstName,
  splitProposalGroups,
  voteChoiceFromAction,
} from './presentProposal.ts';

function worldAmericaAllocations() {
  return getCuratedPackage('world_america').allocations.map((allocation) => ({
    targetName:
      allocation.targetId === '31000000-0000-4000-8000-000000000011'
        ? 'Vanguard FTSE All-World UCITS ETF - (USD) Acc'
        : allocation.targetId === '31000000-0000-4000-8000-000000000014'
          ? 'iShares Core S&P 500 UCITS ETF USD (Acc)'
          : allocation.targetId === '31000000-0000-4000-8000-000000000012'
            ? 'iShares Core MSCI Europe UCITS ETF EUR (Acc)'
            : 'iShares Core MSCI EM IMI UCITS ETF USD (Acc)',
    ticker:
      allocation.targetId === '31000000-0000-4000-8000-000000000011'
        ? 'VWCE'
        : allocation.targetId === '31000000-0000-4000-8000-000000000014'
          ? 'SXR8'
          : allocation.targetId === '31000000-0000-4000-8000-000000000012'
            ? 'EUNK'
            : 'IS3N',
    allocationBps: allocation.allocationBps,
  }));
}

function techForwardAllocations() {
  return getCuratedPackage('tech_forward').allocations.map((allocation) => ({
    targetName: allocation.targetId,
    ticker:
      allocation.targetId === '31000000-0000-4000-8000-000000000011'
        ? 'VWCE'
        : allocation.targetId === '31000000-0000-4000-8000-000000000015'
          ? 'SXRV'
          : allocation.targetId === '31000000-0000-4000-8000-000000000014'
            ? 'SXR8'
            : 'IS3N',
    allocationBps: allocation.allocationBps,
  }));
}

describe('proposal presentation', () => {
  it('builds a friendly strategy-change title without legal ETF names', () => {
    const presented = presentProposalTitle(techForwardAllocations());
    assert.equal(presented.title, 'Change strategy to Tech Forward');
    assert.equal(presented.titleLead, 'Change strategy to');
    assert.equal(presented.titleEmphasis, 'Tech Forward');
    assert.ok(presented.description);
    assert.deepEqual(presented.friendlyLines, [
      '40% Global equities',
      '35% Nasdaq 100',
      '15% S&P 500',
      '10% Emerging markets',
    ]);
    assert.equal(/ucits|etf · eur|31000000/i.test(presented.title), false);
  });

  it('maps backend statuses to consumer labels', () => {
    assert.equal(presentProposalStatus('open'), 'Open');
    assert.equal(presentProposalStatus('approved'), 'Approved');
    assert.equal(presentProposalStatus('rejected'), 'Not approved');
    assert.equal(presentProposalStatus('expired'), 'Expired');
    assert.equal(presentProposalStatus('cancelled'), 'Cancelled');
    assert.equal(presentProposalStatus('draft'), null);
  });

  it('maps vote choices to For / Against / Pending', () => {
    assert.equal(presentVoteState('yes'), 'For');
    assert.equal(presentVoteState('no'), 'Against');
    assert.equal(presentVoteState(null), 'Pending');
  });

  it('translates governance thresholds without inventing numbers', () => {
    assert.equal(presentVotingRule('simple_majority'), 'Majority');
    assert.equal(presentVotingRule('supermajority'), '75% majority');
    assert.equal(presentVotingRule('unanimous'), 'Unanimous');
    assert.equal(presentVotingRule(null), null);
  });

  it('hides open vote counts until the backend makes votes visible', () => {
    assert.equal(
      presentVotingProgress({ electorateSize: 5, votesCast: 2, votesVisible: false }),
      '5 members vote',
    );
    assert.equal(
      presentVotingProgress({ electorateSize: 5, votesCast: 3, votesVisible: true }),
      '3 of 5 voted',
    );
  });

  it('splits open proposals from history and keeps drafts out of groups', () => {
    const groups = splitProposalGroups([
      { status: 'open' as const },
      { status: 'approved' as const },
      { status: 'draft' as const },
    ]);
    assert.equal(groups.open.length, 1);
    assert.equal(groups.history.length, 1);
  });

  it('only allows a vote when the proposal is open and the member is eligible', () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    assert.equal(
      canCastProposalVote({
        status: 'open',
        inElectorate: true,
        alreadyVoted: false,
        deadlineAt: future,
      }),
      true,
    );
    assert.equal(
      canCastProposalVote({
        status: 'approved',
        inElectorate: true,
        alreadyVoted: false,
        deadlineAt: future,
      }),
      false,
    );
    assert.equal(
      canCastProposalVote({
        status: 'open',
        inElectorate: true,
        alreadyVoted: true,
        deadlineAt: future,
      }),
      false,
    );
  });

  it('never uses pooled-money or market-order language', () => {
    const presented = presentProposalTitle(worldAmericaAllocations());
    const visible = [
      presented.title,
      presentProposalStatus('open'),
      presentVoteState('yes'),
      presentVoteState('no'),
      presentVotingRule('simple_majority'),
      presentVotingProgress({ electorateSize: 5, votesCast: null, votesVisible: false }),
      PROPOSAL_EMPTY_TITLE,
      PROPOSAL_EMPTY_BODY,
      'Vote for',
      'Vote against',
      `Proposed by ${proposalFirstName('Nicklas Berg')}`,
    ].join(' ');

    assert.equal(proposalCopyContainsForbidden(visible), false);
    assert.equal(proposalCopyContainsForbidden('Market Buy'), true);
    assert.equal(proposalCopyContainsForbidden('Buying Power'), true);
    assert.equal(proposalCopyContainsForbidden('shares per member'), true);
    assert.equal(proposalFirstName('Nicklas Berg'), 'Nicklas');
  });

  it('presents a compact list row with proposer and honest open progress', () => {
    const row = presentProposalListRow({
      allocations: techForwardAllocations(),
      proposer: { membershipId: 'm1', displayName: 'Nicklas Berg', initials: 'NB' },
      status: 'open',
      electorateSize: 5,
      votesCast: 2,
      votesVisible: false,
      intendedEffectiveAt: null,
    });

    assert.equal(row.eyebrow, 'Strategy');
    assert.equal(row.title, 'Change strategy to Tech Forward');
    assert.equal(row.proposedBy, 'Proposed by Nicklas');
    assert.equal(row.progress, '5 members vote');
    assert.equal(row.statusLabel, 'Open');
    assert.equal(row.effectiveLabel, null);
    assert.equal(row.progress.includes('2 of 5'), false);
  });

  it('presents closed history with vote counts and effective date copy', () => {
    const row = presentProposalListRow({
      allocations: techForwardAllocations(),
      proposer: { membershipId: 'm1', displayName: 'Nicklas Berg', initials: 'NB' },
      status: 'approved',
      electorateSize: 5,
      votesCast: 4,
      votesVisible: true,
      intendedEffectiveAt: '2026-09-05T12:00:00.000Z',
    });

    assert.equal(row.statusLabel, 'Approved');
    assert.equal(row.progress, '4 of 5 voted');
    assert.match(row.effectiveLabel ?? '', /Effective from /);
    assert.equal(/strategy_version|31000000|ucits/i.test(row.title), false);
  });

  it('exposes Vote for / Vote against only for an eligible open voter', () => {
    const members = [{ membershipId: 'm1', displayName: 'Nicklas Berg', initials: 'NB' }];
    const presented = presentProposalDetail({
      allocations: techForwardAllocations(),
      proposer: members[0] ?? null,
      status: 'open',
      votingThresholdKind: 'simple_majority',
      electorateSize: 1,
      electorateMembershipIds: ['m1'],
      votes: [],
      votesVisible: false,
      viewerMembershipId: 'm1',
      sessionChoice: undefined,
      alreadyVotedUnknownChoice: false,
      deadlineAt: new Date(Date.now() + 60_000).toISOString(),
      intendedEffectiveAt: null,
      currentStrategyName: 'World + America',
      members,
    });

    assert.equal(presented.canVote, true);
    assert.equal(presented.voteForLabel, 'Vote for');
    assert.equal(presented.voteAgainstLabel, 'Vote against');
    assert.equal(presented.voters[0]?.state, 'Pending');
  });

  it('maps vote actions to backend choices without order language', () => {
    assert.equal(voteChoiceFromAction('for'), 'yes');
    assert.equal(voteChoiceFromAction('against'), 'no');
    assert.equal(VOTE_FOR_LABEL, 'Vote for');
    assert.equal(VOTE_AGAINST_LABEL, 'Vote against');
    assert.equal(proposalCopyContainsForbidden(`${VOTE_FOR_LABEL} ${VOTE_AGAINST_LABEL}`), false);
  });

  it('keeps open member states pending except the viewer session vote', () => {
    const members = [
      { membershipId: 'm1', displayName: 'Nicklas Berg', initials: 'NB' },
      { membershipId: 'm2', displayName: 'Espen', initials: 'E' },
      { membershipId: 'm3', displayName: 'Anna', initials: 'A' },
      { membershipId: 'm4', displayName: 'Marius', initials: 'M' },
    ];
    const presented = presentProposalDetail({
      allocations: techForwardAllocations(),
      proposer: members[0] ?? null,
      status: 'open',
      votingThresholdKind: 'simple_majority',
      electorateSize: 4,
      electorateMembershipIds: members.map((member) => member.membershipId),
      votes: [],
      votesVisible: false,
      viewerMembershipId: 'm2',
      sessionChoice: 'yes',
      alreadyVotedUnknownChoice: false,
      deadlineAt: new Date(Date.now() + 60_000).toISOString(),
      intendedEffectiveAt: '2026-09-05T12:00:00.000Z',
      currentStrategyName: 'World + America',
      members,
    });

    assert.equal(presented.title, 'Change strategy to Tech Forward');
    assert.equal(presented.proposedBy, 'Proposed by Nicklas');
    assert.equal(presented.currentStrategyName, 'World + America');
    assert.equal(presented.proposedStrategyName, 'Tech Forward');
    assert.equal(presented.votingRule, 'Majority');
    assert.equal(presented.progress, '4 members vote');
    assert.equal(presented.canVote, false);
    assert.equal(presented.viewerVoteCopy, 'You voted For');
    assert.deepEqual(
      presented.voters.map((voter) => voter.state),
      ['Pending', 'For', 'Pending', 'Pending'],
    );
    assert.deepEqual(
      presented.details.map((row) => row.label),
      ['Current strategy', 'Proposed strategy', 'Voting rule', 'Status', 'Effective'],
    );
    assert.equal(presented.details.find((row) => row.label === 'Status')?.value, 'Open');
    assert.equal(presented.statusLabel, 'Open');
  });

  it('shows For / Against / Pending from readable closed votes', () => {
    const members = [
      { membershipId: 'm1', displayName: 'Nicklas Berg', initials: 'NB' },
      { membershipId: 'm2', displayName: 'Espen', initials: 'E' },
      { membershipId: 'm3', displayName: 'Anna', initials: 'A' },
      { membershipId: 'm4', displayName: 'Marius', initials: 'M' },
    ];
    const presented = presentProposalDetail({
      allocations: techForwardAllocations(),
      proposer: members[0] ?? null,
      status: 'approved',
      votingThresholdKind: 'simple_majority',
      electorateSize: 4,
      electorateMembershipIds: members.map((member) => member.membershipId),
      votes: [
        { membershipId: 'm1', choice: 'yes' },
        { membershipId: 'm2', choice: 'yes' },
        { membershipId: 'm4', choice: 'no' },
      ],
      votesVisible: true,
      viewerMembershipId: 'm3',
      sessionChoice: undefined,
      alreadyVotedUnknownChoice: false,
      deadlineAt: '2026-09-01T12:00:00.000Z',
      intendedEffectiveAt: '2026-09-05T12:00:00.000Z',
      currentStrategyName: 'World + America',
      members,
    });

    assert.deepEqual(
      presented.voters.map((voter) => `${voter.firstName} ${voter.state}`),
      ['Nicklas For', 'Espen For', 'Anna Pending', 'Marius Against'],
    );
    assert.equal(presented.progress, '3 of 4 voted');
    assert.equal(presented.canVote, false);
    assert.equal(presented.viewerVoteCopy, null);
  });

  it('uses the required empty-state copy and no demo examples', () => {
    assert.equal(PROPOSAL_EMPTY_TITLE, 'No proposals yet.');
    assert.equal(
      PROPOSAL_EMPTY_BODY,
      'When your club makes a decision together,\nproposals will appear here.',
    );
    assert.equal(/example|tech forward|nicklas/i.test(PROPOSAL_EMPTY_BODY), false);
  });
});
