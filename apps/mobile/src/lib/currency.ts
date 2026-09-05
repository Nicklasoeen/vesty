/**
 * Display-only NOK formatting. Demo screens still pass whole kroner to
 * formatNok. Authoritative backend amounts are integer øre (minor units)
 * and must use formatNokFromMinor. No financial rounding happens here.
 */
const nokFormatter = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 });

export const NOK_MINOR_PER_UNIT = 100;

export function formatNok(amount: number): string {
  return `${nokFormatter.format(Math.abs(amount))} kr`;
}

export function formatNokFromMinor(amountMinor: number): string {
  const abs = Math.abs(amountMinor);
  const kroner = Math.trunc(abs / NOK_MINOR_PER_UNIT);
  const ore = abs % NOK_MINOR_PER_UNIT;
  if (ore === 0) {
    return `${nokFormatter.format(kroner)} kr`;
  }

  return `${nokFormatter.format(kroner)},${ore.toString().padStart(2, '0')} kr`;
}

export function formatSignedNok(amount: number): string {
  const sign = amount > 0 ? '+' : amount < 0 ? '\u2212' : '';
  return `${sign}${formatNok(amount)}`;
}

export function formatSignedNokFromMinor(amountMinor: number): string {
  const sign = amountMinor > 0 ? '+' : amountMinor < 0 ? '\u2212' : '';
  return `${sign}${formatNokFromMinor(amountMinor)}`;
}

export function formatSignedBps(bps: number): string {
  return formatSignedPercentage(bps / 100);
}

export function formatSignedPercentage(value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '\u2212' : '';
  return `${sign}${Math.abs(value).toFixed(1)}%`;
}
