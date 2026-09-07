import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  presentContributionPolicyProposalChange,
  type ContributionPolicyProposal,
} from './contributionPolicyProposal.ts';

describe('presentContributionPolicyProposalChange', () => {
  it('keeps Equal to Equal as two shared amounts', () => {
    const change = presentContributionPolicyProposalChange({
      baseMode: 'equal',
      baseEqualAmountMinor: 200000,
      proposedMode: 'equal',
      proposedEqualAmountMinor: 300000,
    });

    assert.deepEqual(change, {
      fromStyle: 'equal',
      toStyle: 'equal',
      fromEqualAmountMinor: 200000,
      toEqualAmountMinor: 300000,
    });
  });

  it('shows Flexible to Equal without any private current amount', () => {
    const change = presentContributionPolicyProposalChange({
      baseMode: 'flexible',
      baseEqualAmountMinor: 180000,
      proposedMode: 'equal',
      proposedEqualAmountMinor: 250000,
    });

    assert.equal(change.fromStyle, 'flexible');
    assert.equal(change.toStyle, 'equal');
    assert.equal(change.fromEqualAmountMinor, null);
    assert.equal(change.toEqualAmountMinor, 250000);
  });

  it('never copies a leaked Flexible amount onto an Equal to Flexible change', () => {
    const change = presentContributionPolicyProposalChange({
      baseMode: 'equal',
      baseEqualAmountMinor: 200000,
      proposedMode: 'flexible',
      proposedEqualAmountMinor: 999999,
    });

    assert.equal(change.fromEqualAmountMinor, 200000);
    assert.equal(change.toEqualAmountMinor, null);
  });
});

describe('ContributionPolicyProposal read shape', () => {
  it('does not include private commitment fields', () => {
    const proposal: ContributionPolicyProposal = {
      id: 'proposal-1',
      clubId: 'club-1',
      proposerMembershipId: 'membership-1',
      status: 'open',
      resolutionReason: null,
      deadlineAt: null,
      openedAt: null,
      closedAt: null,
      approvedAt: null,
      createdAt: null,
      intendedEffectiveAt: null,
      electorateSize: 3,
      votingThresholdKind: null,
      requiredYesCount: 2,
      basePolicyVersionId: 'policy-1',
      baseMode: 'flexible',
      baseEqualAmountMinor: null,
      proposedMode: 'equal',
      proposedEqualAmountMinor: 250000,
    };

    assert.equal('commitment' in proposal, false);
    assert.equal('average' in proposal, false);
    assert.equal(proposal.baseEqualAmountMinor, null);
  });
});
