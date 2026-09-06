export type ContributionPolicyMode = 'equal' | 'flexible';

export interface ClubContributionPolicy {
  clubId: string;
  policyVersionId: string;
  mode: ContributionPolicyMode;
  currency: string;
  equalAmountMinor: number | null;
}

export interface MyContributionCommitment {
  clubId: string;
  membershipId: string;
  commitmentVersionId: string;
  versionNumber: number;
  amountMinor: number;
  currency: string;
  createdAt: string;
}

export function isContributionPolicyMode(value: unknown): value is ContributionPolicyMode {
  return value === 'equal' || value === 'flexible';
}

export function presentClubContributionPolicy(input: {
  clubId: string;
  policyVersionId: string;
  mode: ContributionPolicyMode;
  currency: string;
  equalAmountMinor: number | null;
}): ClubContributionPolicy {
  return {
    clubId: input.clubId,
    policyVersionId: input.policyVersionId,
    mode: input.mode,
    currency: input.currency,
    equalAmountMinor: input.mode === 'flexible' ? null : input.equalAmountMinor,
  };
}

export const CONTRIBUTION_SETUP_REQUIRED = 'CONTRIBUTION_SETUP_REQUIRED';

export class ContributionSetupRequiredError extends Error {
  readonly code = CONTRIBUTION_SETUP_REQUIRED;

  constructor() {
    super(CONTRIBUTION_SETUP_REQUIRED);
    this.name = 'ContributionSetupRequiredError';
  }
}

export function isContributionSetupRequiredError(error: unknown): boolean {
  return error instanceof ContributionSetupRequiredError
    || (error instanceof Error && error.message === CONTRIBUTION_SETUP_REQUIRED);
}
