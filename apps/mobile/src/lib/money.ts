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

export interface AllocationLine {
  id: string;
  allocationBps: number;
  position: number;
}

export type AllocatedLine<T extends AllocationLine> = T & {
  amountMinor: number;
};

/**
 * Split an integer minor-unit total across basis-point lines so the parts
 * sum exactly to the total. Largest remainder, then lower position.
 * Matches private.allocate_minor_by_bps. Investment Day display still uses
 * the server-computed amounts from the confirm/ensure RPC.
 */
export function allocateMinorByBps<T extends AllocationLine>(
  totalMinor: number,
  lines: readonly T[],
): AllocatedLine<T>[] {
  if (!Number.isInteger(totalMinor) || totalMinor <= 0) {
    throw new Error('Allocation total must be a positive integer');
  }
  if (lines.length === 0) {
    throw new Error('Allocation lines are required');
  }

  const bases = lines.map((line) => {
    const exact = totalMinor * line.allocationBps;
    return {
      line,
      amountMinor: Math.trunc(exact / BPS_PER_WHOLE),
      remainder: exact % BPS_PER_WHOLE,
    };
  });

  let leftover = totalMinor - sumIntegerAmounts(bases.map((item) => item.amountMinor));
  const order = bases
    .map((item, index) => ({ index, remainder: item.remainder, position: item.line.position }))
    .sort((left, right) => {
      if (right.remainder !== left.remainder) {
        return right.remainder - left.remainder;
      }
      return left.position - right.position;
    });

  let cursor = 0;
  while (leftover > 0) {
    const target = order[cursor % order.length];
    if (!target) {
      break;
    }
    const row = bases[target.index];
    if (row) {
      row.amountMinor += 1;
    }
    leftover -= 1;
    cursor += 1;
  }

  return bases.map((item) => ({ ...item.line, amountMinor: item.amountMinor }));
}
