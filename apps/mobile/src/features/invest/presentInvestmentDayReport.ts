import { formatNokFromMinor } from '../../lib/currency.ts';

import { presentAmountProvenanceCaption, type AmountProvenance } from './amountProvenance.ts';
import type { InvestmentDayReportChoice } from './investmentDayReport.ts';
import type { InvestTargetRow } from './types.ts';

export type InvestmentDayReportSubmitState =
  | 'idle'
  | 'loading'
  | 'timeout'
  | 'conflict'
  | 'idempotent'
  | 'success';

export interface InvestmentDayReportOptionPresentation {
  choice: InvestmentDayReportChoice;
  title: string;
  description: string;
}

export function presentPlannedInvestmentSummary(targets: readonly InvestTargetRow[]): string {
  return targets
    .map((target) => `${target.ticker ?? target.exposureLabel ?? target.label} · ${formatNokFromMinor(target.amountMinor)}`)
    .join('\n');
}

export type InvestmentDayReportOrigin = 'monthly' | 'one_time';

export function presentAsPlannedOption(
  expectedAmountMinor: number,
  targetCount: number,
): InvestmentDayReportOptionPresentation {
  return {
    choice: 'as_planned',
    title: 'Yes, as planned',
    description: `I checked that the purchase completed. ${formatNokFromMinor(expectedAmountMinor)} across ${targetCount} investments.`,
  };
}

export function presentWithChangesOption(): InvestmentDayReportOptionPresentation {
  return {
    choice: 'with_changes',
    title: 'Something was different',
    description: 'Report the amount you actually bought.',
  };
}

export function presentPendingOption(): InvestmentDayReportOptionPresentation {
  return {
    choice: 'pending',
    title: 'Still pending',
    description: 'Nothing is saved. Come back when the order fills.',
  };
}

export function presentSkippedOption(
  origin: InvestmentDayReportOrigin = 'monthly',
): InvestmentDayReportOptionPresentation {
  return {
    choice: 'skipped',
    title: origin === 'one_time' ? "I didn't invest this time" : "It didn't go through",
    description: 'This records a skipped Investment Day with no purchases.',
  };
}

export function presentReportChoices(
  expectedAmountMinor: number,
  targetCount: number,
  origin: InvestmentDayReportOrigin = 'monthly',
): readonly InvestmentDayReportOptionPresentation[] {
  return [
    presentAsPlannedOption(expectedAmountMinor, targetCount),
    presentWithChangesOption(),
    presentPendingOption(),
    presentSkippedOption(origin),
  ];
}

export function presentReportedVersusPlanned(actualMinor: number, plannedMinor: number): string {
  return `Reported ${formatNokFromMinor(actualMinor)} · Planned ${formatNokFromMinor(plannedMinor)}`;
}

export function presentReportSubmitLabel(
  choice: InvestmentDayReportChoice,
  submitState: InvestmentDayReportSubmitState,
): string {
  if (submitState === 'loading') {
    return 'Saving…';
  }
  if (choice === 'pending') {
    return 'Keep pending';
  }
  if (choice === 'skipped') {
    return "Confirm I didn't invest";
  }
  if (choice === 'with_changes') {
    return 'Confirm reported purchases';
  }
  return 'Confirm planned investments';
}

export function presentReportSubmitHint(choice: InvestmentDayReportChoice): string {
  if (choice === 'pending') {
    return 'Closes this report without saving anything on the server.';
  }
  if (choice === 'skipped') {
    return 'Saves that you skipped this Investment Day. No purchases are stored.';
  }
  if (choice === 'with_changes') {
    return 'Saves only the amounts you entered. Zero skips a planned investment.';
  }
  return 'Saves the frozen plan after you attest it. Opening a broker does not do this.';
}

export function presentReportError(
  submitState: InvestmentDayReportSubmitState,
  message: string | null,
): string | null {
  if (submitState === 'timeout') {
    return 'The report timed out. Try again. The same report is safe to send twice.';
  }
  if (submitState === 'conflict') {
    return 'This Investment Day was already reported with different details. A versioned correction is not available yet.';
  }
  if (submitState === 'idempotent') {
    return null;
  }
  return message;
}

export function presentCompletedHeadline(outcome: string): string {
  if (outcome === 'skipped') {
    return 'You skipped this Investment Day';
  }
  if (outcome === 'failed') {
    return 'This Investment Day was marked failed';
  }
  return 'Investment Day reported';
}

export function presentCompletedAmountCaption(
  outcome: string,
  provenance: AmountProvenance | null | undefined,
): string {
  if (outcome === 'skipped' || outcome === 'failed') {
    return 'No purchases were stored.';
  }
  return presentAmountProvenanceCaption(provenance) ?? 'Reported by you. Not broker-verified.';
}

export function presentPendingBanner(): { title: string; body: string } {
  return {
    title: 'Order pending',
    body: 'Nothing was reported. Your Investment Day stays open until you confirm what happened.',
  };
}

export function presentOptionalExecutionCaption(): string {
  return 'Units and price are optional. The planned amount is not used as a purchase price.';
}

export function presentLegacyHistoryCaption(): string {
  return 'Older amounts were assumed from the plan. They are not treated as verified purchases.';
}
