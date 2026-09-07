import { formatNokFromMinor } from '../../lib/currency.ts';
import { presentInvestmentIdentity } from '../investments/presentInvestmentIdentity.ts';
import { presentSelectableOptionAppearance } from '../../ui/selectableOptionAppearance.ts';

import { parseContributionKronerInput } from './contributionAmount.ts';
import type { ContributionPolicyMode } from './contributionPolicy.ts';
import {
  compactAllocationPreview,
  getCoreV1Target,
  getCuratedPackage,
  type CuratedInvestmentPackage,
} from './curatedInvestmentPackages.ts';
import {
  canContinueCreateClub,
  parsedCreatorFlexibleAmountMinor,
  parsedEqualAmountMinor,
  trimmedClubName,
  type CreateClubDraft,
  type CreateClubStep,
} from './createClubWizard.ts';
import { GOVERNANCE_OPTIONS, governanceLabel, type GovernanceThresholdKind } from './governance.ts';
import { contributionStyleLabel } from './presentContribution.ts';

export const CREATE_CLUB_STEP_ORDER: readonly CreateClubStep[] = [
  'name',
  'governance',
  'style',
  'contribution',
  'review',
];

const STEP_TITLES: Record<CreateClubStep, string> = {
  name: 'Club name',
  governance: 'Governance',
  style: 'Investment style',
  contribution: 'Contribution style',
  review: 'Review',
};

const STEP_SUPPORTING: Record<CreateClubStep, string | null> = {
  name: 'What should your club be called?',
  governance: 'Choose how many members must agree before a proposal passes.',
  style: 'Choose a starting portfolio for the club.',
  contribution: 'Choose how your club contributes on each Investment Day.',
  review: null,
};

const LEGAL_INSTRUMENT_NAME = /ucits|\betf\b|vanguard ftse|ishares core|ishares nasdaq|\(usd\)|\(acc\)/i;

export function presentCreateClubProgress(step: CreateClubStep) {
  const index = CREATE_CLUB_STEP_ORDER.indexOf(step);

  return {
    eyebrow: 'Create club',
    progressLabel: `${index + 1} of ${CREATE_CLUB_STEP_ORDER.length}`,
    title: STEP_TITLES[step],
    supporting: STEP_SUPPORTING[step],
    stepIndex: index + 1,
    stepCount: CREATE_CLUB_STEP_ORDER.length,
  };
}

export function packageFriendlyHoldings(item: CuratedInvestmentPackage): {
  ticker: string;
  friendlyName: string;
  line: string;
}[] {
  return item.allocations.map((allocation) => {
    const target = getCoreV1Target(allocation.targetId);
    const identity = presentInvestmentIdentity({
      ticker: target.ticker,
      name: target.officialName,
      targetId: target.id,
    });

    return {
      ticker: identity.ticker,
      friendlyName: identity.friendlyName,
      line: `${identity.ticker} · ${identity.friendlyName}`,
    };
  });
}

export function presentCreateClubInvestmentOption(item: CuratedInvestmentPackage, selected: boolean) {
  const appearance = presentSelectableOptionAppearance(selected);

  return {
    title: item.displayName,
    position: item.relativePosition,
    description: item.shortDescription,
    allocationPreview: compactAllocationPreview(item),
    exposureLines: item.allocations.map((allocation) => `${allocation.allocationBps / 100}% ${allocation.exposureLabel}`),
    holdings: packageFriendlyHoldings(item),
    tappable: true,
    ...appearance,
  };
}

export function presentCreateClubContributionOptions() {
  return [
    {
      value: 'equal' as const,
      title: 'Same amount',
      description: 'Everyone contributes the same amount.',
      amountLabel: 'Club amount',
      amountHint: 'per Investment Day',
      privacy: null,
    },
    {
      value: 'flexible' as const,
      title: 'Flexible amounts',
      description: 'Each member privately chooses their own amount.',
      amountLabel: 'Your amount',
      amountHint: null,
      privacy: 'Only you can see your amount.',
    },
  ] as const;
}

export function presentCreateClubContributionSelection(mode: ContributionPolicyMode | null) {
  return {
    revealsClubAmount: mode === 'equal',
    revealsYourAmount: mode === 'flexible',
    clubAmountLabel: 'Club amount',
    yourAmountLabel: 'Your amount',
    privacy: mode === 'flexible' ? 'Only you can see your amount.' : null,
    ...presentSelectableOptionAppearance(mode != null),
  };
}

export function presentCreateClubContributionChoice(
  mode: ContributionPolicyMode,
  selectedMode: ContributionPolicyMode | null,
) {
  return {
    tappable: true,
    ...presentSelectableOptionAppearance(mode === selectedMode),
  };
}

export function presentCreateClubGovernanceOptions() {
  return GOVERNANCE_OPTIONS.map((option) => ({
    value: option.value,
    title: option.label,
    description: option.description,
    guidance: option.value === 'simple_majority' ? 'Good for most clubs' : null,
    tappable: true,
    accessibilityRole: 'radio' as const,
  }));
}

export function presentCreateClubGovernanceChoice(
  kind: GovernanceThresholdKind,
  selectedKind: GovernanceThresholdKind,
) {
  return {
    tappable: true,
    ...presentSelectableOptionAppearance(kind === selectedKind),
  };
}

export function presentCreateClubAmountPreview(input: string): string | null {
  const amountMinor = parseContributionKronerInput(input);
  return amountMinor == null ? null : formatNokFromMinor(amountMinor);
}

export function presentCreateClubContinue(draft: CreateClubDraft) {
  return {
    enabled: canContinueCreateClub(draft),
    label: draft.step === 'review' ? 'Create club' : 'Continue',
  };
}

export function presentCreateClubReview(draft: CreateClubDraft) {
  if (!draft.packageId || !draft.contributionMode) {
    throw new Error('Create club review requires a complete draft');
  }

  const selected = getCuratedPackage(draft.packageId);
  const amountMinor =
    draft.contributionMode === 'equal'
      ? parsedEqualAmountMinor(draft)
      : parsedCreatorFlexibleAmountMinor(draft);
  const amountLabel = amountMinor == null ? '' : formatNokFromMinor(amountMinor);
  const exposureLines = selected.allocations.map(
    (allocation) => `${allocation.allocationBps / 100}% ${allocation.exposureLabel}`,
  );
  const holdings = packageFriendlyHoldings(selected);

  return {
    clubName: trimmedClubName(draft.name),
    investmentStyleLabel: 'Investment style',
    investmentName: selected.displayName,
    exposureLines,
    holdings,
    contributionStyleLabel: 'Contribution style',
    contributionName: contributionStyleLabel(draft.contributionMode),
    contributionDetail:
      draft.contributionMode === 'equal' ? `${amountLabel} per Investment Day` : amountLabel,
    contributionPrivacy: draft.contributionMode === 'flexible' ? 'Only you can see your amount.' : null,
    governanceLabel: 'Governance',
    governanceName: governanceLabel(draft.governance),
    primaryLines: [
      trimmedClubName(draft.name),
      selected.displayName,
      ...exposureLines,
      contributionStyleLabel(draft.contributionMode),
      draft.contributionMode === 'equal' ? `${amountLabel} per Investment Day` : amountLabel,
      governanceLabel(draft.governance),
    ],
  };
}

export function createClubReviewContainsLegalInstrumentNames(text: string): boolean {
  return LEGAL_INSTRUMENT_NAME.test(text);
}
