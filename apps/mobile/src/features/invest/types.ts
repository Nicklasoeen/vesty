export interface InvestmentDayAllocation {
  investmentTargetId: string;
  name: string;
  kind: string;
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
  secondaryLabel?: string;
  allocationBps: number;
  amountMinor: number;
}
