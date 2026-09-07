import { instrumentSecondaryLabel } from '@/lib/instrumentLabels';
import type { AllocationSlice, AvatarPerson } from '@/ui';

import type { GovernanceThresholdKind } from './governance';

export interface ClubMemberIdentity extends AvatarPerson {
  membershipId: string;
  displayName: string | null;
}

export type ClubInvestmentMode = 'legacy_package' | 'single_fund' | 'custom_portfolio';

export interface ClubSummary {
  clubId: string;
  membershipId: string;
  name: string;
  baseCurrency: string;
  governanceThresholdKind: GovernanceThresholdKind;
  investmentMode: ClubInvestmentMode;
  currentOwnerMembershipId: string;
  isOwner: boolean;
  members: ClubMemberIdentity[];
}

export interface CreatedClubResult {
  clubId: string;
  membershipId: string;
  strategyVersionId: string;
}

export interface CreatedInvitationResult {
  invitationId: string;
  inviteToken: string;
  expiresAt: string;
  clubName: string;
}

export interface AcceptedInvitationResult {
  clubId: string;
  membershipId: string;
}

export interface UpdatedClubNameResult {
  clubId: string;
  name: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

export function firstRpcRow(data: unknown): Record<string, unknown> | null {
  if (Array.isArray(data)) {
    return asRecord(data[0] ?? null);
  }
  return asRecord(data);
}

export function requireString(row: Record<string, unknown>, key: string): string {
  const value = asString(row[key]);
  if (!value) {
    throw new Error(`Missing ${key}`);
  }
  return value;
}

export function isGovernanceThresholdKind(value: unknown): value is GovernanceThresholdKind {
  return value === 'simple_majority' || value === 'supermajority' || value === 'unanimous';
}

export function isClubInvestmentMode(value: unknown): value is ClubInvestmentMode {
  return value === 'legacy_package' || value === 'single_fund' || value === 'custom_portfolio';
}

export function allocationsToSlices(
  rows: readonly {
    id: string;
    target_name: string;
    target_kind?: string | null;
    target_ticker?: string | null;
    instrument_currency?: string | null;
    allocation_bps: number;
    position: number;
  }[],
): AllocationSlice[] {
  return [...rows]
    .sort((left, right) => left.position - right.position)
    .map((row) => ({
      id: row.id,
      label: row.target_name,
      secondaryLabel: row.target_kind
        ? instrumentSecondaryLabel(row.target_kind, row.instrument_currency)
        : undefined,
      percentage: row.allocation_bps / 100,
      ticker: row.target_ticker?.trim() ? row.target_ticker.trim() : undefined,
    }));
}
