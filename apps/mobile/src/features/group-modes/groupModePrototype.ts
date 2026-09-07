import { CORE_V1_TARGETS, type CoreV1Target } from '../clubs/curatedInvestmentPackages.ts';
import type { ContributionPolicyMode } from '../clubs/contributionPolicy.ts';
import type { GovernanceThresholdKind } from '../clubs/governance.ts';

export const GROUP_MODE_STEPS = [
  'name',
  'mode',
  'investment',
  'contribution',
  'governance',
  'review',
] as const;

export type GroupModeStep = (typeof GROUP_MODE_STEPS)[number];
export type GroupMode = 'simple_saving' | 'custom_strategy';
export type BrokerPreference = 'dnb' | 'nordnet' | 'unknown';
export type CatalogState = 'ready' | 'loading' | 'empty' | 'error' | 'unavailable';
export type PrototypeSubmitState = 'idle' | 'loading' | 'error' | 'success';

export interface CustomAllocationDraft {
  targetId: string;
  percent: number;
}

export interface GroupModeDraft {
  step: GroupModeStep;
  clubName: string;
  mode: GroupMode | null;
  simpleFundSelected: boolean;
  brokerPreference: BrokerPreference;
  customAllocations: CustomAllocationDraft[];
  contributionMode: ContributionPolicyMode | null;
  equalAmountInput: string;
  flexibleAmountInput: string;
  governance: GovernanceThresholdKind;
}

export const INITIAL_GROUP_MODE_DRAFT: GroupModeDraft = {
  step: 'name',
  clubName: '',
  mode: null,
  simpleFundSelected: false,
  brokerPreference: 'unknown',
  customAllocations: [],
  contributionMode: null,
  equalAmountInput: '',
  flexibleAmountInput: '',
  governance: 'simple_majority',
};

export interface AllocationValidation {
  status: 'empty' | 'under' | 'valid' | 'over';
  totalPercent: number;
  remainingPercent: number;
  canContinue: boolean;
  message: string;
}

export function validateCustomAllocations(
  allocations: readonly CustomAllocationDraft[],
): AllocationValidation {
  const totalPercent = allocations.reduce((sum, item) => sum + item.percent, 0);
  if (allocations.length === 0) {
    return {
      status: 'empty',
      totalPercent,
      remainingPercent: 100,
      canContinue: false,
      message: 'Choose at least one investment to continue.',
    };
  }
  if (totalPercent < 100) {
    return {
      status: 'under',
      totalPercent,
      remainingPercent: 100 - totalPercent,
      canContinue: false,
      message: `${100 - totalPercent}% still needs to be allocated.`,
    };
  }
  if (totalPercent > 100) {
    return {
      status: 'over',
      totalPercent,
      remainingPercent: 100 - totalPercent,
      canContinue: false,
      message: `Reduce the allocation by ${totalPercent - 100}%.`,
    };
  }
  return {
    status: 'valid',
    totalPercent,
    remainingPercent: 0,
    canContinue: true,
    message: 'Your target allocation adds up to 100%.',
  };
}

export function selectGroupMode(draft: GroupModeDraft, mode: GroupMode): GroupModeDraft {
  if (mode !== 'simple_saving') {
    return draft;
  }
  if (draft.mode === mode) {
    return draft;
  }
  return {
    ...draft,
    mode,
    simpleFundSelected: false,
    customAllocations: [],
  };
}

export function toggleCustomTarget(
  allocations: readonly CustomAllocationDraft[],
  targetId: string,
): CustomAllocationDraft[] {
  if (allocations.some((item) => item.targetId === targetId)) {
    return allocations.filter((item) => item.targetId !== targetId);
  }
  if (allocations.length >= 5 || !CORE_V1_TARGETS.some((target) => target.id === targetId)) {
    return [...allocations];
  }
  return [...allocations, { targetId, percent: 0 }];
}

export function setCustomAllocationPercent(
  allocations: readonly CustomAllocationDraft[],
  targetId: string,
  percent: number,
): CustomAllocationDraft[] {
  const safePercent = Number.isFinite(percent) ? Math.max(0, Math.trunc(percent)) : 0;
  return allocations.map((item) =>
    item.targetId === targetId ? { ...item, percent: safePercent } : item,
  );
}

export function groupModeStepIndex(step: GroupModeStep): number {
  return GROUP_MODE_STEPS.indexOf(step);
}

export function nextGroupModeStep(step: GroupModeStep): GroupModeStep {
  const index = groupModeStepIndex(step);
  return GROUP_MODE_STEPS[Math.min(index + 1, GROUP_MODE_STEPS.length - 1)] ?? 'review';
}

export function previousGroupModeStep(step: GroupModeStep): GroupModeStep | null {
  const index = groupModeStepIndex(step);
  return index <= 0 ? null : GROUP_MODE_STEPS[index - 1] ?? null;
}

export function prototypeCanContinue(draft: GroupModeDraft, catalogState: CatalogState): boolean {
  if (draft.step === 'name') {
    return draft.clubName.trim().length > 0;
  }
  if (draft.step === 'mode') {
    return draft.mode !== null;
  }
  if (draft.step === 'investment') {
    if (catalogState !== 'ready') {
      return false;
    }
    return draft.mode === 'simple_saving'
      ? draft.simpleFundSelected
      : draft.mode === 'custom_strategy' &&
          validateCustomAllocations(draft.customAllocations).canContinue;
  }
  if (draft.step === 'contribution') {
    const input =
      draft.contributionMode === 'equal'
        ? draft.equalAmountInput
        : draft.contributionMode === 'flexible'
          ? draft.flexibleAmountInput
          : '';
    return /^\d+$/.test(input) && Number(input) > 0;
  }
  return true;
}

export function findPrototypeTarget(targetId: string): CoreV1Target {
  const target = CORE_V1_TARGETS.find((item) => item.id === targetId);
  if (!target) {
    throw new Error('Unknown prototype investment');
  }
  return target;
}

export function prototypeSubmitHasServerOperation(): false {
  return false;
}
