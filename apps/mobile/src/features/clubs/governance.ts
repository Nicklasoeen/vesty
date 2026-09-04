export type GovernanceThresholdKind = 'simple_majority' | 'supermajority' | 'unanimous';

export interface GovernanceOption {
  value: GovernanceThresholdKind;
  label: string;
  description: string;
}

export const GOVERNANCE_OPTIONS: readonly GovernanceOption[] = [
  {
    value: 'simple_majority',
    label: 'Simple majority',
    description: 'More than half of members must approve.',
  },
  {
    value: 'supermajority',
    label: '75% majority',
    description: 'At least 75% of members must approve.',
  },
  {
    value: 'unanimous',
    label: 'Unanimous',
    description: 'Every eligible member must approve.',
  },
] as const;

export function governanceLabel(kind: GovernanceThresholdKind): string {
  return GOVERNANCE_OPTIONS.find((option) => option.value === kind)?.label ?? kind;
}
