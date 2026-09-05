import {
  assertMarketstackV1Symbol,
  isAllowedMarketstackExchange,
  marketstackMagnitudeBounds,
  normalizeMarketstackSymbol,
  type MarketstackV1Symbol,
} from './marketstackAllowlist.ts';
import {
  ProviderSyncError,
  type MarketObservation,
  type ProviderHistoryResult,
} from './types.ts';
import { assertCurrency, decimalStringFromUnknown, isoDateFromDateTime } from './validate.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function marketstackMessage(payload: unknown): string | null {
  if (!isRecord(payload)) {
    return null;
  }

  if (typeof payload.message === 'string') {
    return payload.message;
  }

  const error = payload.error;
  if (isRecord(error)) {
    if (typeof error.message === 'string') {
      return error.message;
    }
    if (typeof error.info === 'string') {
      return error.info;
    }
    if (typeof error.type === 'string') {
      return error.type;
    }
  }

  return null;
}

export function mapMarketstackHttpError(status: number, payload: unknown): ProviderSyncError {
  const message = marketstackMessage(payload) ?? `Marketstack HTTP ${status}`;
  const type = isRecord(payload) && isRecord(payload.error) && typeof payload.error.type === 'string'
    ? payload.error.type
    : '';

  if (status === 401 || status === 403 || /invalid_access_key|missing_access_key|unauthorized/i.test(type)) {
    return new ProviderSyncError('unauthorized', 'Marketstack rejected the request');
  }

  if (status === 429 || /usage_limit_reached|rate_limit/i.test(type) || /usage_limit_reached/i.test(message)) {
    return new ProviderSyncError('rate_limited', 'Marketstack rate-limited the request');
  }

  if (status === 404) {
    return new ProviderSyncError('unknown_instrument', 'Marketstack has no data for the requested symbol');
  }

  return new ProviderSyncError('unavailable', 'Marketstack request failed');
}

export function assertMarketstackOk(payload: unknown): Record<string, unknown> {
  if (!isRecord(payload)) {
    throw new ProviderSyncError('malformed', 'Marketstack response is not an object');
  }

  if (payload.success === false || payload.error) {
    const type = isRecord(payload.error) && typeof payload.error.type === 'string' ? payload.error.type : '';
    if (/invalid_access_key|missing_access_key/i.test(type)) {
      throw new ProviderSyncError('unauthorized', 'Marketstack rejected the request');
    }
    if (/usage_limit_reached|rate_limit/i.test(type)) {
      throw new ProviderSyncError('rate_limited', 'Marketstack rate-limited the request');
    }
    throw new ProviderSyncError('unavailable', 'Marketstack request failed');
  }

  return payload;
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function resolveCurrency(
  rawCurrency: string | null,
  expectedCurrency: string | undefined,
): string {
  if (!rawCurrency) {
    if (!expectedCurrency) {
      throw new ProviderSyncError('malformed', 'Marketstack row is missing currency and no target currency was provided');
    }
    return assertCurrency(expectedCurrency);
  }

  const currency = rawCurrency.toUpperCase();
  try {
    return assertCurrency(currency, expectedCurrency);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'invalid_currency';
    throw new ProviderSyncError(
      message === 'currency_mismatch' ? 'currency_mismatch' : 'malformed',
      `Marketstack currency ${currency} rejected`,
    );
  }
}

function assertNotFutureDate(priceDate: string, now: Date): void {
  const today = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
  if (priceDate > today) {
    throw new ProviderSyncError('malformed', `Marketstack date ${priceDate} is in the future`);
  }
}

function parseCloseNumber(value: unknown): number {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error('invalid_price');
    }
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new Error('invalid_price');
    }
    return parsed;
  }

  throw new Error('invalid_price');
}

function parseEodRow(
  row: unknown,
  requested: MarketstackV1Symbol,
  expectedCurrency: string | undefined,
  now: Date,
): MarketObservation | 'ignore' {
  if (!isRecord(row)) {
    return 'ignore';
  }

  const rawSymbol = optionalString(row.symbol);
  if (!rawSymbol) {
    return 'ignore';
  }

  if (normalizeMarketstackSymbol(rawSymbol) !== requested) {
    return 'ignore';
  }

  const exchange = optionalString(row.exchange);
  if (!isAllowedMarketstackExchange(exchange)) {
    throw new ProviderSyncError(
      'unknown_instrument',
      `Marketstack exchange ${exchange} is not the approved Xetra listing`,
    );
  }

  const rawDate = optionalString(row.date);
  if (!rawDate) {
    return 'ignore';
  }

  let priceDate: string;
  try {
    priceDate = isoDateFromDateTime(rawDate);
    assertNotFutureDate(priceDate, now);
  } catch {
    return 'ignore';
  }

  let closeValue: number;
  let price: string;
  try {
    closeValue = parseCloseNumber(row.close);
    price = decimalStringFromUnknown(row.close);
  } catch {
    return 'ignore';
  }

  const bounds = marketstackMagnitudeBounds(requested);
  if (closeValue < bounds.min || closeValue > bounds.max) {
    throw new ProviderSyncError(
      'malformed',
      `Marketstack close is outside the approved magnitude band for ${requested}`,
    );
  }

  const currency = resolveCurrency(optionalString(row.price_currency), expectedCurrency);

  return {
    priceDate,
    price,
    currency,
    priceType: 'close',
    providerTimestamp: null,
  };
}

export function parseMarketstackEod(
  payload: unknown,
  requestedSymbol: string,
  expectedCurrency?: string,
  now = new Date(),
): ProviderHistoryResult {
  let requested: MarketstackV1Symbol;
  try {
    requested = assertMarketstackV1Symbol(requestedSymbol);
  } catch {
    throw new ProviderSyncError(
      'unknown_instrument',
      'Marketstack is not approved for this symbol',
    );
  }
  const body = assertMarketstackOk(payload);
  const rows = Array.isArray(body.data) ? body.data : [];
  const observations: MarketObservation[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const parsed = parseEodRow(row, requested, expectedCurrency, now);
    if (parsed === 'ignore') {
      continue;
    }
    if (seen.has(parsed.priceDate)) {
      continue;
    }
    seen.add(parsed.priceDate);
    observations.push(parsed);
  }

  if (observations.length === 0) {
    throw new ProviderSyncError(
      'missing_price',
      `Marketstack returned no persistable EOD rows for ${requested}`,
    );
  }

  observations.sort((left, right) => left.priceDate.localeCompare(right.priceDate));

  return {
    providerInstrumentId: requested,
    currency: observations[observations.length - 1].currency,
    observations,
  };
}

export function marketstackPagination(payload: unknown): { offset: number; limit: number; total: number; count: number } {
  const body = isRecord(payload) && isRecord(payload.pagination) ? payload.pagination : {};
  return {
    offset: typeof body.offset === 'number' ? body.offset : 0,
    limit: typeof body.limit === 'number' ? body.limit : 0,
    total: typeof body.total === 'number' ? body.total : 0,
    count: typeof body.count === 'number' ? body.count : 0,
  };
}
