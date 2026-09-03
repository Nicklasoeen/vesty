/**
 * Display-only formatting for demo amounts (already integer NOK kroner).
 * Not a financial calculation module — no rounding of authoritative
 * monetary data happens here, only presentation of pre-computed demo values.
 */
const nokFormatter = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 });

export function formatNok(amount: number): string {
  return `${nokFormatter.format(Math.abs(amount))} kr`;
}

export function formatSignedNok(amount: number): string {
  const sign = amount > 0 ? '+' : amount < 0 ? '\u2212' : '';
  return `${sign}${formatNok(amount)}`;
}

export function formatSignedPercentage(value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '\u2212' : '';
  return `${sign}${Math.abs(value).toFixed(1)}%`;
}
