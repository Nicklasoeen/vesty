import {
  compactAllocationPreview,
  getCuratedPackage,
  isCuratedPackageId,
  packageHoldingLines,
  type CuratedPackageId,
} from './curatedInvestmentPackages.ts';
import { CLUB_NAME_MAX_LENGTH, V1_BASE_CURRENCY } from './genesisStrategy.ts';
import type { GovernanceThresholdKind } from './governance.ts';

export type CreateClubStep = 'name' | 'governance' | 'style' | 'review';

export interface CreateClubDraft {
  step: CreateClubStep;
  name: string;
  governance: GovernanceThresholdKind;
  packageId: CuratedPackageId | null;
}

export interface CreateClubRequest {
  name: string;
  governanceThresholdKind: GovernanceThresholdKind;
  packageId: CuratedPackageId;
}

export const INITIAL_CREATE_CLUB_DRAFT: CreateClubDraft = {
  step: 'name',
  name: '',
  governance: 'simple_majority',
  packageId: null,
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

export function canSubmitCreateClub(draft: Pick<CreateClubDraft, 'name' | 'packageId'>): boolean {
  return isClubNameValid(draft.name) && canContinueFromStyle(draft.packageId);
}

export function canContinueCreateClub(draft: CreateClubDraft): boolean {
  if (draft.step === 'name') {
    return isClubNameValid(draft.name);
  }
  if (draft.step === 'style') {
    return canContinueFromStyle(draft.packageId);
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
  if (step === 'review') {
    return 'style';
  }
  return null;
}

export function createClubRequest(draft: CreateClubDraft): CreateClubRequest {
  if (!canSubmitCreateClub(draft) || !draft.packageId) {
    throw new Error('Choose an investment style to continue');
  }

  return {
    name: trimmedClubName(draft.name),
    governanceThresholdKind: draft.governance,
    packageId: draft.packageId,
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
