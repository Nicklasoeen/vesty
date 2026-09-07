import { formatInvestmentDayWhen, presentInvestmentDayHeading } from '../home/presentInvestmentDay.ts';

import type { InvestmentDayPlan, InvestmentDayViewerState } from './types.ts';

export interface InvestmentDayCycleCopy {
  title: string;
  whenLabel: string;
  body: string;
  retryLabel: string | null;
  showReportActions: boolean;
  showContributionSetup: boolean;
  setupAppliesNext: boolean;
}

export function presentInvestmentDayCycleCopy(input: {
  viewerState: InvestmentDayViewerState | string;
  clubName?: string | null;
  investmentDayAt?: string | null;
  reportingOpensAt?: string | null;
  reportingClosesAt?: string | null;
  reportingAllowed?: boolean;
}): InvestmentDayCycleCopy {
  const title = presentInvestmentDayHeading({
    viewerState: input.viewerState,
    investmentDayAt: input.investmentDayAt,
  });
  const when = formatInvestmentDayWhen(input.reportingOpensAt ?? input.investmentDayAt);

  switch (input.viewerState) {
    case 'upcoming':
      return {
        title,
        whenLabel: when,
        body: `Reporting opens ${when}. You can review the plan now. Reporting starts when the server opens this Investment Day.`,
        retryLabel: null,
        showReportActions: false,
        showContributionSetup: false,
        setupAppliesNext: false,
      };
    case 'open':
      return {
        title,
        whenLabel: when,
        body: input.reportingAllowed
          ? 'Report what you purchased after you have placed the order.'
          : 'This Investment Day is open for the club. Your report is already saved, or reporting is not available for you.',
        retryLabel: null,
        showReportActions: Boolean(input.reportingAllowed),
        showContributionSetup: false,
        setupAppliesNext: false,
      };
    case 'closed':
      return {
        title,
        whenLabel: formatInvestmentDayWhen(input.reportingClosesAt ?? input.investmentDayAt),
        body: 'The reporting window has closed. A late report cannot be saved for this Investment Day.',
        retryLabel: null,
        showReportActions: false,
        showContributionSetup: false,
        setupAppliesNext: false,
      };
    case 'missing':
    case 'unavailable':
      return {
        title,
        whenLabel: 'Not generated yet',
        body: 'This Investment Day is not available yet. Pull to refresh. Opening this screen never creates a new period.',
        retryLabel: 'Try again',
        showReportActions: false,
        showContributionSetup: false,
        setupAppliesNext: false,
      };
    case 'not_in_snapshot':
      return {
        title,
        whenLabel: when,
        body: 'You were not part of this Investment Day when it was frozen. Later joins apply from a future Investment Day.',
        retryLabel: null,
        showReportActions: false,
        showContributionSetup: false,
        setupAppliesNext: false,
      };
    case 'setup_next':
      return {
        title,
        whenLabel: when,
        body: 'Your contribution was not set when this Investment Day was frozen. Set your amount now — it applies from your next Investment Day.',
        retryLabel: null,
        showReportActions: false,
        showContributionSetup: true,
        setupAppliesNext: true,
      };
    case 'setup_required':
      return {
        title,
        whenLabel: when,
        body: 'Set your contribution before this Investment Day is frozen.',
        retryLabel: null,
        showReportActions: false,
        showContributionSetup: true,
        setupAppliesNext: false,
      };
    default:
      return {
        title,
        whenLabel: when,
        body: 'Unable to load this Investment Day.',
        retryLabel: 'Try again',
        showReportActions: false,
        showContributionSetup: false,
        setupAppliesNext: false,
      };
  }
}

export function isReportableInvestmentDay(plan: InvestmentDayPlan | null): boolean {
  return Boolean(plan?.reportingAllowed && plan.cycleId && plan.viewerState === 'open');
}
