/**
 * Presentation-only Investment Day heading.
 * Cycle freeze and expected amounts stay authoritative on the server.
 */

export function presentInvestmentDayHeading(input: {
  setupRequired?: boolean;
  cycleStatus?: string | null;
  investmentDayAt?: string | null;
  now?: Date;
}): string {
  if (input.setupRequired) {
    return 'Your contribution';
  }

  if (input.cycleStatus === 'open') {
    return 'Current Investment Day';
  }

  if (input.cycleStatus === 'upcoming') {
    return 'Next Investment Day';
  }

  if (input.investmentDayAt && isCalendarDateAfter(input.investmentDayAt, input.now ?? new Date())) {
    return 'Next Investment Day';
  }

  return 'Investment Day';
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
