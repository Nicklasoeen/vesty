/**
 * Presentation-only Investment Day heading and local date/time.
 * Cycle freeze, reporting permission, and expected amounts stay authoritative on the server.
 */

import type { InvestmentDayViewerState } from '../invest/types.ts';

export function presentInvestmentDayHeading(input: {
  setupRequired?: boolean;
  viewerState?: InvestmentDayViewerState | string | null;
  cycleStatus?: string | null;
  investmentDayAt?: string | null;
  now?: Date;
}): string {
  if (input.setupRequired || input.viewerState === 'setup_required' || input.viewerState === 'setup_next') {
    return 'Your contribution';
  }

  if (input.viewerState === 'open' || input.cycleStatus === 'open') {
    return 'Current Investment Day';
  }

  if (input.viewerState === 'upcoming' || input.cycleStatus === 'upcoming') {
    return 'Next Investment Day';
  }

  if (input.investmentDayAt && isCalendarDateAfter(input.investmentDayAt, input.now ?? new Date())) {
    return 'Next Investment Day';
  }

  return 'Investment Day';
}

export function formatInvestmentDayWhen(iso: string | null | undefined): string {
  if (!iso) {
    return 'Date unavailable';
  }

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return 'Date unavailable';
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function presentInvestmentDayPlannedMinor(input: {
  viewerState?: InvestmentDayViewerState | string | null;
  setupRequired?: boolean;
  expectedAmountMinor?: number | null;
}): number | null {
  if (input.setupRequired) {
    return null;
  }
  if (
    input.viewerState === 'setup_required'
    || input.viewerState === 'setup_next'
    || input.viewerState === 'not_in_snapshot'
    || input.viewerState === 'missing'
    || input.viewerState === 'unavailable'
  ) {
    return null;
  }
  return input.expectedAmountMinor ?? null;
}

function isCalendarDateAfter(iso: string, now: Date): boolean {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return startOfLocalDay(date) > startOfLocalDay(now);
}

function startOfLocalDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}
