import { assertIsoDate } from './validate.ts';

export type NavFreshnessStatus = 'fresh' | 'stale' | 'unavailable';

export interface NavFreshness {
  status: NavFreshnessStatus;
  priceDate: string | null;
  ageDays: number | null;
}

function utcDate(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function previousWeekday(value: Date): Date {
  const date = utcDate(value);
  const day = date.getUTCDay();
  const shift = day === 0 ? 2 : day === 6 ? 1 : 0;
  date.setUTCDate(date.getUTCDate() - shift);
  return date;
}

function daysBetween(later: Date, earlier: Date): number {
  return Math.round((later.getTime() - earlier.getTime()) / (24 * 60 * 60 * 1000));
}

/**
 * Daily mutual-fund NAV is delayed. Weekends and a short holiday gap
 * are not treated as provider failure.
 */
export function classifyNavFreshness(
  priceDate: string | null | undefined,
  now = new Date(),
  holidayBufferDays = 3,
): NavFreshness {
  if (!priceDate) {
    return { status: 'unavailable', priceDate: null, ageDays: null };
  }

  try {
    assertIsoDate(priceDate);
  } catch {
    return { status: 'unavailable', priceDate, ageDays: null };
  }

  const asOf = new Date(`${priceDate}T00:00:00Z`);
  const today = utcDate(now);
  const lastWeekday = previousWeekday(today);
  const ageDays = daysBetween(today, asOf);

  if (asOf.getTime() > today.getTime()) {
    return { status: 'unavailable', priceDate, ageDays };
  }

  const staleAfter = new Date(lastWeekday);
  staleAfter.setUTCDate(staleAfter.getUTCDate() - holidayBufferDays);

  if (asOf.getTime() >= staleAfter.getTime()) {
    return { status: 'fresh', priceDate, ageDays };
  }

  return { status: 'stale', priceDate, ageDays };
}
