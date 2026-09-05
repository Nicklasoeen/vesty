/**
 * Display-only decimal formatting. Stored values stay exact decimal strings.
 * Do not use the output of these helpers as an authoritative financial input.
 */

const DECIMAL_STRING = /^(0|[1-9]\d*)(\.\d+)?$/;

export function isExactDecimalString(value: string): boolean {
  return DECIMAL_STRING.test(value);
}

/**
 * Trim trailing fractional zeros without using binary float.
 * "1.50000000" → "1.5", "12" → "12", "123.000001" → "123.000001"
 */
export function trimDecimalString(value: string): string {
  if (!isExactDecimalString(value)) {
    return value;
  }

  if (!value.includes('.')) {
    return value;
  }

  const trimmed = value.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  return trimmed;
}

export function formatDecimalString(
  value: string,
  options?: { minFractionDigits?: number; maxFractionDigits?: number },
): string {
  const minFractionDigits = options?.minFractionDigits ?? 0;
  const maxFractionDigits = options?.maxFractionDigits ?? 8;

  if (!isExactDecimalString(value)) {
    return value;
  }

  const [rawInteger = '0', rawFraction = ''] = value.split('.');
  const limitedFraction = rawFraction.slice(0, maxFractionDigits);
  const paddedFraction =
    limitedFraction.length >= minFractionDigits
      ? limitedFraction
      : limitedFraction.padEnd(minFractionDigits, '0');
  const fraction = paddedFraction.replace(/0+$/, '').padEnd(minFractionDigits, '0');
  const groupedInteger = rawInteger.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');

  if (fraction.length === 0) {
    return groupedInteger;
  }

  return `${groupedInteger}.${fraction}`;
}

export function formatQuantityLabel(quantity: string): string {
  return `${formatDecimalString(quantity, { maxFractionDigits: 8 })} units`;
}

export function formatEuroDecimal(value: string): string {
  return `\u20ac${formatDecimalString(value, { minFractionDigits: 2, maxFractionDigits: 8 })}`;
}
