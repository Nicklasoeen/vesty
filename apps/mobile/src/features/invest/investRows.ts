import { findCoreV1Target } from '../clubs/curatedInvestmentPackages.ts';
import { instrumentSecondaryLabel } from '../../lib/instrumentLabels.ts';

import type { InvestmentDayPlan, InvestTargetRow } from './types.ts';

export function rowsFromPlan(plan: InvestmentDayPlan): InvestTargetRow[] {
  return [...plan.allocations]
    .sort((left, right) => left.position - right.position)
    .map((allocation) => {
      const transaction = plan.transactions.find(
        (item) => item.investmentTargetId === allocation.investmentTargetId,
      );
      const core = findCoreV1Target(allocation.investmentTargetId);
      return {
        id: allocation.investmentTargetId,
        label: core?.shortName ?? allocation.name,
        exposureLabel: core?.exposureLabel ?? null,
        ticker: allocation.ticker ?? core?.ticker ?? null,
        secondaryLabel: core?.shortName
          ?? instrumentSecondaryLabel(allocation.kind, allocation.instrumentCurrency),
        allocationBps: allocation.allocationBps,
        amountMinor: transaction?.amountMinor ?? allocation.amountMinor,
        quantity: transaction?.quantity ?? null,
        executionUnitPrice: transaction?.executionUnitPrice ?? null,
      };
    });
}
