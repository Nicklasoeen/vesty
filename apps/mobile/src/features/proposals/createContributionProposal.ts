import { isValidContributionAmountMinor, parseContributionKronerInput } from '../clubs/contributionAmount.ts';
import type { ContributionPolicyMode } from '../clubs/contributionPolicy.ts';
import { formatNokFromMinor } from '../../lib/currency.ts';

export const CONTRIBUTION_PROPOSAL_ACTIONS = [
  'change_amount',
  'switch_to_flexible',
  'switch_to_equal',
] as const;

export type ContributionProposalAction = (typeof CONTRIBUTION_PROPOSAL_ACTIONS)[number];

export interface ContributionProposalDraft {
  action: ContributionProposalAction | null;
  amountInput: string;
}

export interface ValidContributionProposalDraft {
  proposedMode: ContributionPolicyMode;
  proposedEqualAmountMinor: number | null;
}

export const SAME_AMOUNT_REQUIRED_ERROR = 'Enter how much everyone will contribute';
export const NEW_AMOUNT_REQUIRED_ERROR = 'Enter a new amount';
export const SAME_AMOUNT_UNCHANGED_ERROR = 'Enter a different amount from the current club amount';
export const CONTRIBUTION_CHANGE_NOT_ALLOWED_ERROR = 'This contribution change is not allowed';

export function availableContributionProposalActions(
  mode: ContributionPolicyMode,
): readonly ContributionProposalAction[] {
  if (mode === 'equal') {
    return ['change_amount', 'switch_to_flexible'];
  }

  return ['switch_to_equal'];
}

export function isContributionProposalAction(value: unknown): value is ContributionProposalAction {
  return (
    value === 'change_amount' || value === 'switch_to_flexible' || value === 'switch_to_equal'
  );
}

export function contributionProposalActionLabel(action: ContributionProposalAction): string {
  switch (action) {
    case 'change_amount':
      return 'Change the amount';
    case 'switch_to_flexible':
      return 'Switch to Flexible amounts';
    case 'switch_to_equal':
      return 'Switch to Same amount';
  }
}

export function contributionProposalActionDescription(action: ContributionProposalAction): string {
  switch (action) {
    case 'change_amount':
      return 'Keep the same amount for everyone, and propose a new number.';
    case 'switch_to_flexible':
      return 'Each member will be able to choose their own amount privately.';
    case 'switch_to_equal':
      return 'Everyone will contribute the same amount on future Investment Days.';
  }
}

export function equalToFlexibleTransitionCopy(): string {
  return 'Everyone will start with the club’s current amount. They can change their own amount afterwards.';
}

export function parseContributionProposalAmount(amountInput: string): number | null {
  return parseContributionKronerInput(amountInput);
}

export function validateContributionProposalDraft(input: {
  currentMode: ContributionPolicyMode;
  currentEqualAmountMinor: number | null;
  action: ContributionProposalAction | null;
  amountInput: string;
}): { ok: true; value: ValidContributionProposalDraft } | { ok: false; error: string } {
  const allowed = availableContributionProposalActions(input.currentMode);
  if (input.action == null || !allowed.includes(input.action)) {
    return { ok: false, error: CONTRIBUTION_CHANGE_NOT_ALLOWED_ERROR };
  }

  if (input.action === 'switch_to_flexible') {
    if (input.currentMode !== 'equal') {
      return { ok: false, error: CONTRIBUTION_CHANGE_NOT_ALLOWED_ERROR };
    }
    return { ok: true, value: { proposedMode: 'flexible', proposedEqualAmountMinor: null } };
  }

  const amountMinor = parseContributionProposalAmount(input.amountInput);
  if (!isValidContributionAmountMinor(amountMinor)) {
    return {
      ok: false,
      error: input.action === 'change_amount' ? NEW_AMOUNT_REQUIRED_ERROR : SAME_AMOUNT_REQUIRED_ERROR,
    };
  }

  if (input.action === 'change_amount') {
    if (input.currentMode !== 'equal') {
      return { ok: false, error: CONTRIBUTION_CHANGE_NOT_ALLOWED_ERROR };
    }
    if (amountMinor === input.currentEqualAmountMinor) {
      return { ok: false, error: SAME_AMOUNT_UNCHANGED_ERROR };
    }
    return { ok: true, value: { proposedMode: 'equal', proposedEqualAmountMinor: amountMinor } };
  }

  if (input.currentMode !== 'flexible') {
    return { ok: false, error: CONTRIBUTION_CHANGE_NOT_ALLOWED_ERROR };
  }

  return { ok: true, value: { proposedMode: 'equal', proposedEqualAmountMinor: amountMinor } };
}

export function canContinueContributionProposalDraft(input: {
  currentMode: ContributionPolicyMode;
  currentEqualAmountMinor: number | null;
  action: ContributionProposalAction | null;
  amountInput: string;
}): boolean {
  return validateContributionProposalDraft(input).ok;
}

export function currentEqualAmountLabel(amountMinor: number | null): string | null {
  return amountMinor == null ? null : `${formatNokFromMinor(amountMinor)} per Investment Day`;
}
