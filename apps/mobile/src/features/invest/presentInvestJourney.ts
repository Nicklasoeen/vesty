import { formatNokFromMinor } from '../../lib/currency.ts';

import { isReportableInvestmentDay } from './presentInvestmentDayCycle.ts';
import {
  canSubmitMonthlySavingAttestation,
  formatMonthlySavingDayLabel,
  formatScheduleDayOfMonth,
  presentMonthlySavingDetailRows,
  type MonthlySavingAttestationIssueKind,
  type MonthlySavingDetailRow,
  type MonthlySavingPhase,
  type MonthlySavingSetup,
} from './presentMonthlySavingSetup.ts';
import type { InvestmentDayPlan } from './types.ts';

export type InvestLocalBranch = 'choose' | 'monthly' | 'one_time' | null;

export type InvestReportStage = 'idle' | 'choices' | 'review' | 'pending' | 'not_through';

export type InvestAttestationIssue = MonthlySavingAttestationIssueKind | null;

export type OneTimeHandoffPhase = Extract<
  MonthlySavingPhase,
  'idle' | 'loading' | 'opened' | 'returned' | 'error'
>;

export type InvestJourneySurface =
  | 'no_club'
  | 'loading'
  | 'request_error'
  | 'intro'
  | 'choose'
  | 'setup_required'
  | 'setup'
  | 'needs_update'
  | 'opening_nordnet'
  | 'returned'
  | 'confirming'
  | 'attestation_timeout'
  | 'attestation_error'
  | 'attestation_conflict'
  | 'attestation_saved'
  | 'current'
  | 'unavailable'
  | 'one_time'
  | 'one_time_opening'
  | 'one_time_returned_reportable'
  | 'one_time_returned_outside_window'
  | 'investment_day_open'
  | 'investment_day_upcoming'
  | 'investment_day_closed'
  | 'investment_day_report'
  | 'investment_day_review'
  | 'investment_day_pending'
  | 'investment_day_completed'
  | 'investment_day_not_in_snapshot';

export interface InvestJourneyInput {
  hasClub: boolean;
  clubsLoading: boolean;
  setup: MonthlySavingSetup | null;
  setupLoading: boolean;
  setupError: string | null;
  monthlyPhase: MonthlySavingPhase;
  oneTimePhase: OneTimeHandoffPhase;
  introDismissed: boolean;
  localBranch: InvestLocalBranch;
  attested: boolean;
  attestationSaved: boolean;
  attestationIssue: InvestAttestationIssue;
  openedMonthlyUrl: boolean;
  plan: InvestmentDayPlan | null;
  planLoading: boolean;
  planError: string | null;
  planSetupRequired: boolean;
  reportStage: InvestReportStage;
  reportCompleted: boolean;
}

export interface InvestDayHero {
  day: string;
  month: string;
}

export interface InvestJourneyProgress {
  hidden: boolean;
  total: number;
  current: number;
  finished: boolean;
}

export function presentInvestDayHero(iso: string | null | undefined): InvestDayHero | null {
  if (!iso) {
    return null;
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return {
    day: new Intl.DateTimeFormat('en-GB', { day: '2-digit' }).format(date),
    month: new Intl.DateTimeFormat('en-GB', { month: 'long' }).format(date),
  };
}

export function presentInvestScheduleBadge(dayOfMonth: number | null): string | null {
  if (!Number.isInteger(dayOfMonth) || dayOfMonth == null || dayOfMonth < 1 || dayOfMonth > 31) {
    return null;
  }
  return String(dayOfMonth).padStart(2, '0');
}

export function presentInvestJourneySurface(input: InvestJourneyInput): InvestJourneySurface {
  if (!input.hasClub && !input.clubsLoading) {
    return 'no_club';
  }

  if (input.clubsLoading || (input.hasClub && input.setupLoading && input.setup == null && !input.setupError)) {
    return 'loading';
  }

  if (input.setupError && input.setup == null) {
    return 'request_error';
  }

  if (input.monthlyPhase === 'confirming') {
    return 'confirming';
  }

  if (input.attestationIssue === 'timeout') {
    return 'attestation_timeout';
  }

  if (input.attestationIssue === 'conflict') {
    return 'attestation_conflict';
  }

  if (input.attestationIssue === 'error') {
    return 'attestation_error';
  }

  if (input.monthlyPhase === 'error') {
    return 'request_error';
  }

  if (input.monthlyPhase === 'loading') {
    return 'opening_nordnet';
  }

  if (input.monthlyPhase === 'returned') {
    return 'returned';
  }

  if (input.attestationSaved) {
    return 'attestation_saved';
  }

  if (input.oneTimePhase === 'loading' || input.oneTimePhase === 'opened') {
    return 'one_time_opening';
  }

  if (input.oneTimePhase === 'returned') {
    return isReportableInvestmentDay(input.plan)
      ? 'one_time_returned_reportable'
      : 'one_time_returned_outside_window';
  }

  if (input.oneTimePhase === 'error') {
    return 'request_error';
  }

  if (input.localBranch === 'one_time') {
    return 'one_time';
  }

  const setup = input.setup;
  if (!setup) {
    return input.planError && !input.plan ? 'request_error' : 'loading';
  }

  if (setup.status === 'setup_required' || (input.planSetupRequired && setup.recommendedAmountMinor == null)) {
    return 'setup_required';
  }

  if (setup.status === 'needs_update') {
    return 'needs_update';
  }

  if (setup.status === 'unavailable') {
    return 'unavailable';
  }

  if (setup.status === 'current') {
    return presentCurrentSurface(input);
  }

  if (setup.status === 'not_set_up') {
    if (input.localBranch === 'monthly') {
      return 'setup';
    }
    if (input.introDismissed || input.localBranch === 'choose') {
      return 'choose';
    }
    return 'intro';
  }

  return 'unavailable';
}

function presentCurrentSurface(input: InvestJourneyInput): InvestJourneySurface {
  const plan = input.plan;
  if (input.reportCompleted || plan?.isCompleted) {
    return 'investment_day_completed';
  }
  if (input.reportStage === 'pending') {
    return 'investment_day_pending';
  }
  if (input.reportStage === 'review') {
    return 'investment_day_review';
  }
  if (input.reportStage === 'not_through') {
    return 'investment_day_report';
  }
  if (isReportableInvestmentDay(plan)) {
    if (input.reportStage === 'choices') {
      return 'investment_day_report';
    }
    return 'investment_day_open';
  }
  if (!plan) {
    if (input.planLoading) {
      return 'current';
    }
    if (input.planError) {
      return 'current';
    }
    return 'current';
  }
  if (plan.viewerState === 'upcoming') {
    return 'investment_day_upcoming';
  }
  if (plan.viewerState === 'closed') {
    return 'investment_day_closed';
  }
  if (plan.viewerState === 'not_in_snapshot') {
    return 'investment_day_not_in_snapshot';
  }
  if (plan.viewerState === 'setup_required' || plan.viewerState === 'setup_next') {
    return 'setup_required';
  }
  return 'current';
}

export function presentInvestJourneyProgress(surface: InvestJourneySurface): InvestJourneyProgress {
  const reporting: InvestJourneySurface[] = [
    'investment_day_open',
    'investment_day_report',
    'investment_day_review',
    'investment_day_pending',
    'one_time_returned_reportable',
  ];
  if (
    surface === 'intro'
    || surface === 'loading'
    || surface === 'no_club'
    || surface === 'request_error'
    || surface === 'current'
    || surface === 'unavailable'
    || surface === 'setup_required'
    || surface === 'investment_day_upcoming'
    || surface === 'investment_day_closed'
    || surface === 'investment_day_completed'
    || surface === 'investment_day_not_in_snapshot'
    || surface === 'one_time_returned_outside_window'
  ) {
    return { hidden: true, total: 0, current: 0, finished: surface !== 'intro' && surface !== 'loading' };
  }

  if (reporting.includes(surface)) {
    const current = surface === 'investment_day_review' ? 2 : 1;
    return { hidden: false, total: 2, current, finished: false };
  }

  const stages: Partial<Record<InvestJourneySurface, number>> = {
    choose: 1,
    needs_update: 1,
    setup: 2,
    one_time: 2,
    opening_nordnet: 3,
    one_time_opening: 3,
    returned: 3,
    confirming: 4,
    attestation_timeout: 4,
    attestation_error: 4,
    attestation_conflict: 4,
    attestation_saved: 4,
  };
  const current = stages[surface] ?? 1;
  return {
    hidden: false,
    total: 4,
    current,
    finished: surface === 'attestation_saved',
  };
}

export function presentInvestCanConfirm(input: InvestJourneyInput): boolean {
  return canSubmitMonthlySavingAttestation({
    phase: input.monthlyPhase,
    openedMonthlyUrl: input.openedMonthlyUrl,
    attested: input.attested,
    attestationIssue: input.attestationIssue,
  });
}

export function presentInvestDetailRows(input: InvestJourneyInput): MonthlySavingDetailRow[] {
  if (!input.setup) {
    return [];
  }
  const surface = presentInvestJourneySurface(input);
  const update = input.setup.status === 'needs_update' || surface === 'needs_update';
  return presentMonthlySavingDetailRows(input.setup, update ? 'update' : 'setup');
}

export function presentInvestReportingAllowed(plan: InvestmentDayPlan | null): boolean {
  return isReportableInvestmentDay(plan);
}

export function presentInvestOneTimeAmountLabel(setup: MonthlySavingSetup | null): string | null {
  if (setup?.recommendedAmountMinor == null) {
    return null;
  }
  return formatNokFromMinor(setup.recommendedAmountMinor);
}

export function presentInvestReadySchedule(setup: MonthlySavingSetup): string | null {
  return formatScheduleDayOfMonth(setup.attestedScheduleDayOfMonth)
    ?? formatScheduleDayOfMonth(setup.scheduleDayOfMonth);
}

export function presentInvestReadyNextDay(setup: MonthlySavingSetup, plan: InvestmentDayPlan | null): string | null {
  return formatMonthlySavingDayLabel(plan?.investmentDayAt ?? setup.recommendedInvestmentDayAt);
}

export function presentInvestShowsIntro(input: InvestJourneyInput): boolean {
  return presentInvestJourneySurface(input) === 'intro';
}

export function presentInvestUsesMintIntro(surface: InvestJourneySurface): boolean {
  return surface === 'intro';
}

export function presentInvestBackTarget(surface: InvestJourneySurface): InvestLocalBranch | 'current' | 'setup' | null {
  switch (surface) {
    case 'choose':
      return null;
    case 'setup':
    case 'needs_update':
      return 'choose';
    case 'one_time':
    case 'one_time_returned_outside_window':
      return 'choose';
    case 'returned':
      return 'setup';
    case 'opening_nordnet':
    case 'one_time_opening':
      return 'setup';
    case 'investment_day_report':
    case 'investment_day_review':
    case 'investment_day_pending':
      return 'current';
    default:
      return null;
  }
}
