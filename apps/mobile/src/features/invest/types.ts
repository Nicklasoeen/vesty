export interface InvestmentDayAllocation {
  investmentTargetId: string;
  name: string;
  kind: string;
  ticker: string | null;
  instrumentCurrency: string | null;
  allocationBps: number;
  position: number;
  amountMinor: number;
}

export interface InvestmentDayTransaction {
  id: string;
  investmentTargetId: string;
  amountMinor: number;
  currency: string;
  transactionType: string;
  source: string;
  verificationStatus: string;
  amountProvenance: string | null;
  quantity: string | null;
  executionUnitPrice: string | null;
  executionUnitPriceCurrency: string | null;
}

export type InvestmentDayViewerState =
  | 'missing'
  | 'unavailable'
  | 'upcoming'
  | 'open'
  | 'closed'
  | 'not_in_snapshot'
  | 'setup_next'
  | 'setup_required';

export const INVESTMENT_DAY_VIEWER_STATES: readonly InvestmentDayViewerState[] = [
  'missing',
  'unavailable',
  'upcoming',
  'open',
  'closed',
  'not_in_snapshot',
  'setup_next',
  'setup_required',
];

export interface InvestmentDayPlan {
  clubId: string;
  clubName: string;
  membershipId: string;
  cycleId: string | null;
  investmentDayAt: string | null;
  cycleStatus: string | null;
  viewerState: InvestmentDayViewerState;
  reportingAllowed: boolean;
  reportingOpensAt: string | null;
  reportingClosesAt: string | null;
  participationId: string | null;
  participationOutcome: string;
  expectedAmountMinor: number | null;
  currency: string | null;
  allocations: InvestmentDayAllocation[];
  transactions: InvestmentDayTransaction[];
  isCompleted: boolean;
}

export interface InvestTargetRow {
  id: string;
  label: string;
  exposureLabel: string | null;
  ticker: string | null;
  secondaryLabel?: string;
  allocationBps: number;
  amountMinor: number;
  quantity: string | null;
  executionUnitPrice: string | null;
}
