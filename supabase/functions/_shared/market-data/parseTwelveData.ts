import {
  ProviderSyncError,
  type MarketObservation,
  type ProviderHistoryResult,
  type ResolveInstrumentResult,
} from './types.ts';
import { assertCurrency, decimalStringFromUnknown, isoDateFromDateTime } from './validate.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function mapTwelveDataHttpError(status: number, payload: unknown): ProviderSyncError {
  const message = twelveDataMessage(payload) ?? `Twelve Data HTTP ${status}`;

  if (status === 401 || status === 403) {
    return new ProviderSyncError('unauthorized', message);
  }

  if (status === 429) {
    return new ProviderSyncError('rate_limited', message);
  }

  if (status === 404) {
    return new ProviderSyncError('unknown_instrument', message);
  }

  return new ProviderSyncError('unavailable', message);
}

export function assertTwelveDataOk(payload: unknown): Record<string, unknown> {
  if (!isRecord(payload)) {
    throw new ProviderSyncError('malformed', 'Twelve Data response is not an object');
  }

  if (payload.status === 'error' || typeof payload.code === 'number') {
    const code = typeof payload.code === 'number' ? payload.code : 0;
    throw mapTwelveDataHttpError(code || 400, payload);
  }

  return payload;
}

function twelveDataMessage(payload: unknown): string | null {
  if (!isRecord(payload)) {
    return null;
  }

  return typeof payload.message === 'string' ? payload.message : null;
}

export function parseTwelveDataQuote(
  payload: unknown,
  expectedCurrency?: string,
): ProviderHistoryResult {
  const body = assertTwelveDataOk(payload);
  const symbol = typeof body.symbol === 'string' ? body.symbol : null;
  const currency = typeof body.currency === 'string' ? body.currency : null;
  const close = body.close ?? body.price;
  const datetime = typeof body.datetime === 'string' ? body.datetime : null;
  const timestamp = typeof body.timestamp === 'number' ? body.timestamp : null;

  if (!symbol) {
    throw new ProviderSyncError('malformed', 'Twelve Data quote is missing symbol');
  }

  if (!currency) {
    throw new ProviderSyncError('malformed', 'Twelve Data quote is missing currency');
  }

  try {
    assertCurrency(currency, expectedCurrency);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'invalid_currency';
    throw new ProviderSyncError(
      message === 'currency_mismatch' ? 'currency_mismatch' : 'malformed',
      `Twelve Data currency ${currency} rejected`,
    );
  }

  if (close == null) {
    throw new ProviderSyncError('missing_price', 'Twelve Data quote is missing close/price');
  }

  if (!datetime) {
    throw new ProviderSyncError('malformed', 'Twelve Data quote is missing datetime');
  }

  let price: string;
  let priceDate: string;
  try {
    price = decimalStringFromUnknown(close);
    priceDate = isoDateFromDateTime(datetime);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'malformed';
    throw new ProviderSyncError(
      message === 'invalid_price' ? 'missing_price' : 'malformed',
      'Twelve Data quote price/date is invalid',
    );
  }

  const observation: MarketObservation = {
    priceDate,
    price,
    currency,
    priceType: 'nav',
    providerTimestamp: timestamp ? new Date(timestamp * 1000).toISOString() : null,
  };

  return {
    providerInstrumentId: symbol,
    currency,
    observations: [observation],
  };
}

export function parseTwelveDataTimeSeries(
  payload: unknown,
  expectedCurrency?: string,
): ProviderHistoryResult {
  const body = assertTwelveDataOk(payload);
  const meta = isRecord(body.meta) ? body.meta : {};
  const symbol = typeof meta.symbol === 'string' ? meta.symbol : null;
  const currency = typeof meta.currency === 'string' ? meta.currency : null;
  const values = Array.isArray(body.values) ? body.values : [];

  if (!symbol) {
    throw new ProviderSyncError('malformed', 'Twelve Data time series is missing symbol');
  }

  if (!currency) {
    throw new ProviderSyncError('malformed', 'Twelve Data time series is missing currency');
  }

  try {
    assertCurrency(currency, expectedCurrency);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'invalid_currency';
    throw new ProviderSyncError(
      message === 'currency_mismatch' ? 'currency_mismatch' : 'malformed',
      `Twelve Data currency ${currency} rejected`,
    );
  }

  const observations: MarketObservation[] = [];
  for (const row of values) {
    if (!isRecord(row) || typeof row.datetime !== 'string' || row.close == null) {
      continue;
    }

    try {
      observations.push({
        priceDate: isoDateFromDateTime(row.datetime),
        price: decimalStringFromUnknown(row.close),
        currency,
        priceType: 'nav',
        providerTimestamp: null,
      });
    } catch {
      // Skip a single malformed bar.
    }
  }

  if (observations.length === 0) {
    throw new ProviderSyncError('missing_price', 'Twelve Data time series has no usable closes');
  }

  observations.sort((left, right) => left.priceDate.localeCompare(right.priceDate));

  return {
    providerInstrumentId: symbol,
    currency,
    observations,
  };
}

export function parseTwelveDataFundsCatalog(
  payload: unknown,
  expectedIsin: string,
  expectedCurrency?: string,
): ResolveInstrumentResult {
  const body = assertTwelveDataOk(payload);
  const result = isRecord(body.result) ? body.result : {};
  const list = Array.isArray(result.list) ? result.list : [];
  const first = list[0];

  if (!isRecord(first) || typeof first.symbol !== 'string') {
    throw new ProviderSyncError(
      'unknown_instrument',
      `Twelve Data catalog has no instrument for ${expectedIsin}`,
    );
  }

  const currency = typeof first.currency === 'string' ? first.currency : '';
  try {
    assertCurrency(currency, expectedCurrency);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'invalid_currency';
    throw new ProviderSyncError(
      message === 'currency_mismatch' ? 'currency_mismatch' : 'malformed',
      `Twelve Data catalog currency ${currency} rejected`,
    );
  }

  const rawIsin = typeof first.isin === 'string' ? first.isin : null;
  const isin = rawIsin && rawIsin !== 'request_access_via_add_ons' ? rawIsin : null;
  if (isin && isin !== expectedIsin) {
    throw new ProviderSyncError(
      'unknown_instrument',
      `Twelve Data catalog ISIN ${isin} does not match ${expectedIsin}`,
    );
  }

  return {
    providerInstrumentId: first.symbol,
    name: typeof first.name === 'string' ? first.name : null,
    currency,
    isin,
  };
}

export function assertLatestNotObviouslyStale(priceDate: string, now = new Date(), maxAgeDays = 30) {
  const parsed = new Date(`${priceDate}T00:00:00Z`);
  const ageMs = now.getTime() - parsed.getTime();
  const ageDays = ageMs / (24 * 60 * 60 * 1000);
  if (ageDays > maxAgeDays) {
    throw new ProviderSyncError(
      'stale',
      `Latest NAV date ${priceDate} is older than ${maxAgeDays} days`,
    );
  }
}
