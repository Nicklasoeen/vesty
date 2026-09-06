import {
  compactAllocationPreview,
  getCuratedPackage,
  isCuratedPackageId,
  packageHoldingLines,
  type CuratedPackageId,
} from './curatedInvestmentPackages.ts';
import { isValidContributionAmountMinor, parseContributionKronerInput } from './contributionAmount.ts';
import type { ContributionPolicyMode } from './contributionPolicy.ts';
import { CLUB_NAME_MAX_LENGTH, V1_BASE_CURRENCY } from './genesisStrategy.ts';
import type { GovernanceThresholdKind } from './governance.ts';

export type CreateClubStep = 'name' | 'governance' | 'style' | 'contribution' | 'review';

export interface CreateClubDraft {
  step: CreateClubStep;
  name: string;
  governance: GovernanceThresholdKind;
  packageId: CuratedPackageId | null;
  contributionMode: ContributionPolicyMode | null;
  equalAmountInput: string;
  creatorFlexibleAmountInput: string;
}

export interface CreateClubRequest {
  name: string;
  governanceThresholdKind: GovernanceThresholdKind;
  packageId: CuratedPackageId;
  contributionMode: ContributionPolicyMode;
  equalAmountMinor: number | null;
  creatorFlexibleAmountMinor: number | null;
}

export const INITIAL_CREATE_CLUB_DRAFT: CreateClubDraft = {
  step: 'name',
  name: '',
  governance: 'simple_majority',
  packageId: null,
  contributionMode: null,
  equalAmountInput: '',
  creatorFlexibleAmountInput: '',
};

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

export function canContinueFromStyle(packageId: CuratedPackageId | null): boolean {
  return isCuratedPackageId(packageId);
}

export function parsedEqualAmountMinor(draft: Pick<CreateClubDraft, 'equalAmountInput'>): number | null {
  return parseContributionKronerInput(draft.equalAmountInput);
}

export function parsedCreatorFlexibleAmountMinor(
  draft: Pick<CreateClubDraft, 'creatorFlexibleAmountInput'>,
): number | null {
  return parseContributionKronerInput(draft.creatorFlexibleAmountInput);
}

export function canContinueFromContribution(draft: Pick<CreateClubDraft, 'contributionMode' | 'equalAmountInput' | 'creatorFlexibleAmountInput'>): boolean {
  if (draft.contributionMode === 'equal') {
    return isValidContributionAmountMinor(parsedEqualAmountMinor(draft));
  }
  if (draft.contributionMode === 'flexible') {
    return isValidContributionAmountMinor(parsedCreatorFlexibleAmountMinor(draft));
  }
  return false;
}

export function canSubmitCreateClub(draft: Pick<CreateClubDraft, 'name' | 'packageId' | 'contributionMode' | 'equalAmountInput' | 'creatorFlexibleAmountInput'>): boolean {
  return isClubNameValid(draft.name)
    && canContinueFromStyle(draft.packageId)
    && canContinueFromContribution(draft);
}

export function canContinueCreateClub(draft: CreateClubDraft): boolean {
  if (draft.step === 'name') {
    return isClubNameValid(draft.name);
  }
  if (draft.step === 'style') {
    return canContinueFromStyle(draft.packageId);
  }
  if (draft.step === 'contribution') {
    return canContinueFromContribution(draft);
  }
  return draft.step === 'governance' || draft.step === 'review';
}

export function advanceCreateClubStep(step: CreateClubStep): CreateClubStep {
  if (step === 'name') {
    return 'governance';
  }
  if (step === 'governance') {
    return 'style';
  }
  if (step === 'style') {
    return 'contribution';
  }
  if (step === 'contribution') {
    return 'review';
  }
  return 'review';
}

export function previousCreateClubStep(step: CreateClubStep): CreateClubStep | null {
  if (step === 'governance') {
    return 'name';
  }
  if (step === 'style') {
    return 'governance';
  }
  if (step === 'contribution') {
    return 'style';
  }
  if (step === 'review') {
    return 'contribution';
  }
  return null;
}

export function createClubRequest(draft: CreateClubDraft): CreateClubRequest {
  if (!canSubmitCreateClub(draft) || !draft.packageId || !draft.contributionMode) {
    throw new Error('Choose a contribution style to continue');
  }

  return {
    name: trimmedClubName(draft.name),
    governanceThresholdKind: draft.governance,
    packageId: draft.packageId,
    contributionMode: draft.contributionMode,
    equalAmountMinor: draft.contributionMode === 'equal' ? parsedEqualAmountMinor(draft) : null,
    creatorFlexibleAmountMinor:
      draft.contributionMode === 'flexible' ? parsedCreatorFlexibleAmountMinor(draft) : null,
  };
}

export function reviewPackageSummary(packageId: CuratedPackageId) {
  const selected = getCuratedPackage(packageId);
  return {
    id: selected.id,
    displayName: selected.displayName,
    shortDescription: selected.shortDescription,
    preview: compactAllocationPreview(selected),
    holdings: packageHoldingLines(selected),
    baseCurrency: V1_BASE_CURRENCY,
  };
}
