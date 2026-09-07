import { formatNokFromMinor } from '../../lib/currency.ts';
import { presentInvestmentIdentity } from '../investments/presentInvestmentIdentity.ts';
import { presentSelectableOptionAppearance } from '../../ui/selectableOptionAppearance.ts';

import { parseContributionKronerInput } from './contributionAmount.ts';
import type { ContributionPolicyMode } from './contributionPolicy.ts';
import {
  compactAllocationPreview,
  getCoreV1Target,
  type CuratedInvestmentPackage,
} from './curatedInvestmentPackages.ts';
import {
  CREATE_CLUB_STEPS,
  canContinueCreateClub,
  createClubStepIndex,
  type CreateClubDraft,
  type CreateClubStep,
} from './createClubWizard.ts';
import type { SingleFundProduct } from './singleFundCatalog.ts';
import { presentCreateClubReviewAgreement } from './presentSingleFund.ts';
import { GOVERNANCE_OPTIONS, type GovernanceThresholdKind } from './governance.ts';

export const CREATE_CLUB_STEP_ORDER: readonly CreateClubStep[] = CREATE_CLUB_STEPS;

const STEP_TITLES: Record<CreateClubStep, string> = {
  name: 'Club name',
  mode: 'How do you want to invest?',
  fund: 'Choose a fund',
  contribution: 'Monthly contribution',
  governance: 'How decisions are made',
  review: 'Review',
};

const STEP_SUPPORTING: Record<CreateClubStep, string | null> = {
  name: 'What should your club be called?',
  mode: 'Choose the routine that fits your group.',
  fund: 'One fund. One purchase in each member’s own account.',
  contribution: 'Choose how members contribute.',
  governance: 'Choose how future proposals pass.',
  review: 'Confirm what your group has chosen.',
};

const LEGAL_INSTRUMENT_NAME = /ucits|\betf\b|vanguard ftse|ishares core|ishares nasdaq|\(usd\)|\(acc\)/i;

export function presentCreateClubProgress(step: CreateClubStep) {
  const index = createClubStepIndex(step);

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
      amountHint: 'per month, shared with members',
      privacy: null,
    },
    {
      value: 'flexible' as const,
      title: 'Flexible amounts',
      description: 'Each member privately chooses their own amount.',
      amountLabel: 'Your amount',
      amountHint: null,
      privacy: 'Only you can see your amount. Other members will not see it.',
    },
  ] as const;
}

export function presentCreateClubContributionSelection(mode: ContributionPolicyMode | null) {
  return {
    revealsClubAmount: mode === 'equal',
    revealsYourAmount: mode === 'flexible',
    clubAmountLabel: 'Club amount',
    yourAmountLabel: 'Your amount',
    privacy: mode === 'flexible' ? 'Only you can see your amount. Other members will not see it.' : null,
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

export function presentCreateClubCatalogPanel(state: 'idle' | 'loading' | 'ready' | 'empty' | 'error' | 'unavailable') {
  if (state === 'loading' || state === 'idle') {
    return {
      title: 'Loading funds…',
      body: null,
      retry: false,
    };
  }
  if (state === 'empty') {
    return {
      title: 'No funds are available right now',
      body: 'There are no verified funds for this setup.',
      retry: false,
    };
  }
  if (state === 'error') {
    return {
      title: 'Unable to load funds',
      body: 'Try again in a moment.',
      retry: true,
    };
  }
  return {
    title: 'This fund cannot be selected for a new club right now.',
    body: null,
    retry: false,
  };
}

export function presentCreateClubContinue(
  draft: CreateClubDraft,
  products: readonly SingleFundProduct[] = [],
) {
  return {
    enabled: canContinueCreateClub(draft, products),
    label: draft.step === 'review' ? 'Create club' : 'Continue',
  };
}

export function presentCreateClubReview(draft: CreateClubDraft, product: SingleFundProduct) {
  if (!draft.contributionMode) {
    throw new Error('Create club review requires a complete draft');
  }

  return presentCreateClubReviewAgreement(draft, product);
}

export function createClubReviewContainsLegalInstrumentNames(text: string): boolean {
  return LEGAL_INSTRUMENT_NAME.test(text);
}
