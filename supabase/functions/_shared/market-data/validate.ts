const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_CURRENCY = /^[A-Z]{3}$/;

export function decimalStringFromNumber(value: number, maxScale = 8): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error('invalid_price');
  }

  const fixed = value.toFixed(maxScale);
  const trimmed = fixed.replace(/\.?0+$/, '');
  if (trimmed === '' || trimmed === '0') {
    throw new Error('invalid_price');
  }

  return trimmed.includes('.') ? trimmed : `${trimmed}.0`;
}

export function assertIsoDate(value: string): string {
  const match = ISO_DATE.exec(value);
  if (!match) {
    throw new Error('malformed_date');
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error('malformed_date');
  }

  return value;
}

export function assertCurrency(value: string, expected?: string): string {
  if (!ISO_CURRENCY.test(value)) {
    throw new Error('invalid_currency');
  }

  if (expected && value !== expected) {
    throw new Error('currency_mismatch');
  }

  return value;
}

export function priceDateFromUnix(unixSeconds: number, gmtOffsetSeconds = 0): string {
  if (!Number.isFinite(unixSeconds) || unixSeconds <= 0) {
    throw new Error('malformed_date');
  }

  const shifted = new Date((unixSeconds + gmtOffsetSeconds) * 1000);
  if (Number.isNaN(shifted.getTime())) {
    throw new Error('malformed_date');
  }

  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shifted.getUTCDate()).padStart(2, '0');
  return assertIsoDate(`${year}-${month}-${day}`);
}
