/**
 * Integer-amount helpers. Callers must pass whole kroner (or whole minor
 * units) — never IEEE floating-point monetary values.
 */

/** Sum integer amounts. Addition of integers only. */
export function sumIntegerAmounts(amounts: readonly number[]): number {
  let total = 0;
  for (const amount of amounts) {
    total += amount;
  }
  return total;
}

/** 10_000 bps = 100%. */
export const BPS_PER_WHOLE = 10_000;

/** Format integer basis points as a whole-percent label (4000 → "40%"). */
export function formatBpsAsPercentLabel(bps: number): string {
  return `${Math.trunc(bps / 100)}%`;
}
