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
  quantity: string | null;
  executionUnitPrice: string | null;
  executionUnitPriceCurrency: string | null;
}

export interface InvestmentDayPlan {
  clubId: string;
  clubName: string;
  membershipId: string;
  cycleId: string;
  investmentDayAt: string;
  cycleStatus: string;
  participationId: string;
  participationOutcome: string;
  expectedAmountMinor: number;
  currency: string;
  allocations: InvestmentDayAllocation[];
  transactions: InvestmentDayTransaction[];
  isCompleted: boolean;
}

export interface InvestTargetRow {
  id: string;
  label: string;
  ticker: string | null;
  secondaryLabel?: string;
  allocationBps: number;
  amountMinor: number;
  quantity: string | null;
  executionUnitPrice: string | null;
}
