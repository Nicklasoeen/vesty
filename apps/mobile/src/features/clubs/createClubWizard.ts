import { isValidContributionAmountMinor, parseContributionKronerInput } from './contributionAmount.ts';
import type { ContributionPolicyMode } from './contributionPolicy.ts';
import { CLUB_NAME_MAX_LENGTH, V1_BASE_CURRENCY } from './genesisStrategy.ts';
import type { GovernanceThresholdKind } from './governance.ts';
import { findSingleFundProduct, type SingleFundProduct } from './singleFundCatalog.ts';

export const CREATE_CLUB_STEPS = [
  'name',
  'mode',
  'fund',
  'contribution',
  'governance',
  'review',
] as const;

export type CreateClubStep = (typeof CREATE_CLUB_STEPS)[number];
export type ClubInvestmentModeChoice = 'single_fund' | 'custom_portfolio';
export type StoredClubInvestmentMode = 'legacy_package' | 'single_fund' | 'custom_portfolio';

export interface CreateClubDraft {
  step: CreateClubStep;
  name: string;
  mode: ClubInvestmentModeChoice | null;
  catalogProductId: string | null;
  contributionMode: ContributionPolicyMode | null;
  equalAmountInput: string;
  creatorFlexibleAmountInput: string;
  governance: GovernanceThresholdKind;
  clientCreationId: string;
}

export interface CreateClubRequest {
  name: string;
  investmentMode: 'single_fund';
  catalogProductId: string;
  governanceThresholdKind: GovernanceThresholdKind;
  contributionMode: ContributionPolicyMode;
  equalAmountMinor: number | null;
  creatorFlexibleAmountMinor: number | null;
  baseCurrency: typeof V1_BASE_CURRENCY;
  clientCreationId: string;
}

export function createEmptyCreateClubDraft(clientCreationId: string): CreateClubDraft {
  return {
    step: 'name',
    name: '',
    mode: null,
    catalogProductId: null,
    contributionMode: null,
    equalAmountInput: '',
    creatorFlexibleAmountInput: '',
    governance: 'simple_majority',
    clientCreationId,
  };
}

export const INITIAL_CREATE_CLUB_DRAFT: CreateClubDraft = createEmptyCreateClubDraft(
  '00000000-0000-4000-8000-000000000000',
);

export function trimmedClubName(name: string): string {
  return name.trim();
}

export function isClubNameValid(name: string): boolean {
  const trimmed = trimmedClubName(name);
  return trimmed.length > 0 && trimmed.length <= CLUB_NAME_MAX_LENGTH;
}

export function canSubmitClubRename(currentName: string, draftName: string): boolean {
  return isClubNameValid(draftName) && trimmedClubName(draftName) !== trimmedClubName(currentName);
}

export function selectCreateClubMode(
  draft: CreateClubDraft,
  mode: ClubInvestmentModeChoice,
): CreateClubDraft {
  if (mode !== 'single_fund') {
    return draft;
  }
  if (draft.mode === mode) {
    return draft;
  }
  return {
    ...draft,
    mode,
    catalogProductId: null,
  };
}

export function parsedEqualAmountMinor(draft: Pick<CreateClubDraft, 'equalAmountInput'>): number | null {
  return parseContributionKronerInput(draft.equalAmountInput);
}

export function parsedCreatorFlexibleAmountMinor(
  draft: Pick<CreateClubDraft, 'creatorFlexibleAmountInput'>,
): number | null {
  return parseContributionKronerInput(draft.creatorFlexibleAmountInput);
}

export function canContinueFromContribution(
  draft: Pick<CreateClubDraft, 'contributionMode' | 'equalAmountInput' | 'creatorFlexibleAmountInput'>,
): boolean {
  if (draft.contributionMode === 'equal') {
    return isValidContributionAmountMinor(parsedEqualAmountMinor(draft));
  }
  if (draft.contributionMode === 'flexible') {
    return isValidContributionAmountMinor(parsedCreatorFlexibleAmountMinor(draft));
  }
  return false;
}

export function canContinueCreateClub(
  draft: CreateClubDraft,
  products: readonly SingleFundProduct[] = [],
): boolean {
  if (draft.step === 'name') {
    return isClubNameValid(draft.name);
  }
  if (draft.step === 'mode') {
    return draft.mode === 'single_fund';
  }
  if (draft.step === 'fund') {
    return draft.mode === 'single_fund' && findSingleFundProduct(products, draft.catalogProductId)?.status === 'active';
  }
  if (draft.step === 'contribution') {
    return canContinueFromContribution(draft);
  }
  return draft.step === 'governance' || draft.step === 'review';
}

export function canSubmitCreateClub(
  draft: CreateClubDraft,
  products: readonly SingleFundProduct[] = [],
): boolean {
  return (
    isClubNameValid(draft.name)
    && draft.mode === 'single_fund'
    && Boolean(draft.clientCreationId)
    && findSingleFundProduct(products, draft.catalogProductId)?.status === 'active'
    && canContinueFromContribution(draft)
  );
}

export function createClubStepIndex(step: CreateClubStep): number {
  return CREATE_CLUB_STEPS.indexOf(step);
}

export function advanceCreateClubStep(step: CreateClubStep): CreateClubStep {
  const index = createClubStepIndex(step);
  return CREATE_CLUB_STEPS[Math.min(index + 1, CREATE_CLUB_STEPS.length - 1)] ?? 'review';
}

export function previousCreateClubStep(step: CreateClubStep): CreateClubStep | null {
  const index = createClubStepIndex(step);
  return index <= 0 ? null : CREATE_CLUB_STEPS[index - 1] ?? null;
}

export function createClubRequest(
  draft: CreateClubDraft,
  products: readonly SingleFundProduct[],
): CreateClubRequest {
  const product = findSingleFundProduct(products, draft.catalogProductId);
  if (!canSubmitCreateClub(draft, products) || !draft.contributionMode || !product) {
    throw new Error('Choose a contribution style to continue');
  }

  return {
    name: trimmedClubName(draft.name),
    investmentMode: 'single_fund',
    catalogProductId: product.id,
    governanceThresholdKind: draft.governance,
    contributionMode: draft.contributionMode,
    equalAmountMinor: draft.contributionMode === 'equal' ? parsedEqualAmountMinor(draft) : null,
    creatorFlexibleAmountMinor:
      draft.contributionMode === 'flexible' ? parsedCreatorFlexibleAmountMinor(draft) : null,
    baseCurrency: V1_BASE_CURRENCY,
    clientCreationId: draft.clientCreationId,
  };
}
