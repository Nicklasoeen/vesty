import { formatNokFromMinor } from '../../lib/currency.ts';

import type { ClubContributionPolicy, ContributionPolicyMode, MyContributionCommitment } from './contributionPolicy';

export const CONTRIBUTION_STYLE_OPTIONS = [
  {
    value: 'equal' as const,
    label: 'Same amount',
    description: 'Everyone contributes the same amount.',
  },
  {
    value: 'flexible' as const,
    label: 'Flexible amounts',
    description: 'Each member privately chooses their own amount.',
  },
] as const;

export function contributionStyleLabel(mode: ContributionPolicyMode): string {
  return mode === 'equal' ? 'Same amount' : 'Flexible amounts';
}

export function contributionStyleDescription(mode: ContributionPolicyMode): string {
  return mode === 'equal'
    ? 'Everyone contributes the same amount.'
    : 'Each member privately chooses their own amount.';
}

export function presentContributionPolicyTiming(input: {
  mode: ContributionPolicyMode;
  policyAmountMinor: number | null;
  frozenCycleAmountMinor: number | null;
}): {
  appliesCopy: string | null;
  policyAmountMinor: number | null;
  frozenAmountMinor: number | null;
} {
  const frozenAmountMinor = input.frozenCycleAmountMinor;
  const policyAmountMinor = input.policyAmountMinor;

  if (policyAmountMinor == null || frozenAmountMinor == null || policyAmountMinor === frozenAmountMinor) {
    return {
      appliesCopy: null,
      policyAmountMinor,
      frozenAmountMinor,
    };
  }

  return {
    appliesCopy:
      input.mode === 'flexible'
        ? 'Applies from your next Investment Day.'
        : 'Applies from the next Investment Day.',
    policyAmountMinor,
    frozenAmountMinor,
  };
}

export function presentClubContributionSummary(policy: ClubContributionPolicy): {
  title: string;
  styleLabel: string;
  detail: string;
} {
  if (policy.mode === 'equal' && policy.equalAmountMinor != null) {
    return {
      title: 'Contributions',
      styleLabel: 'Same amount',
      detail: `${formatNokFromMinor(policy.equalAmountMinor)} per Investment Day`,
    };
  }

  return {
    title: 'Contributions',
    styleLabel: 'Flexible amounts',
    detail: 'Each member chooses their amount privately',
  };
}

export function presentOwnFlexibleContribution(commitment: MyContributionCommitment | null): {
  label: string;
  amountLabel: string | null;
  privacy: string;
  appliesNext: string;
} {
  return {
    label: 'Your contribution',
    amountLabel: commitment ? formatNokFromMinor(commitment.amountMinor) : null,
    privacy: 'Only you can see your amount.',
    appliesNext: 'Applies from your next Investment Day.',
  };
}

export function clubDecidesContributionStyleCopy(): string {
  return 'Contribution style is decided by the club.';
}

export function needsFlexibleContributionSetup(
  policy: ClubContributionPolicy | null,
  commitment: MyContributionCommitment | null,
): boolean {
  return policy?.mode === 'flexible' && commitment == null;
}
