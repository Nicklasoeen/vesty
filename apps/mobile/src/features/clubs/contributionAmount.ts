import { NOK_MINOR_PER_UNIT } from '../../lib/currency.ts';

export const CONTRIBUTION_AMOUNT_MAX_KRONER = 1_000_000;

export function parseContributionKronerInput(value: string): number | null {
  const trimmed = value.trim().replace(/\s/g, '');
  if (!/^[1-9]\d{0,6}$/.test(trimmed)) {
    return null;
  }

  const kroner = Number.parseInt(trimmed, 10);
  if (kroner < 1 || kroner > CONTRIBUTION_AMOUNT_MAX_KRONER) {
    return null;
  }

  return kroner * NOK_MINOR_PER_UNIT;
}

export function contributionKronerFromMinor(amountMinor: number): string {
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
    return '';
  }

  return String(Math.trunc(amountMinor / NOK_MINOR_PER_UNIT));
}

export function isValidContributionAmountMinor(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}
