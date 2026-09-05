import {
  ProviderSyncError,
  type ProviderHistoryResult,
  type ProviderLatestResult,
  type ResolveInstrumentResult,
} from './types.ts';
import {
  assertLatestNotObviouslyStale,
  mapTwelveDataHttpError,
  parseTwelveDataFundsCatalog,
  parseTwelveDataQuote,
  parseTwelveDataTimeSeries,
} from './parseTwelveData.ts';

const TWELVE_DATA_URL = 'https://api.twelvedata.com';
const REQUEST_TIMEOUT_MS = 20_000;
const HISTORY_OUTPUT_SIZE = 1500;

export interface TwelveDataOptions {
  apiKey?: string;
  fetchImpl?: typeof fetch;
  expectedCurrency?: string;
  now?: Date;
}

function requireApiKey(options: TwelveDataOptions): string {
  const apiKey = options.apiKey ?? '';
  if (apiKey.trim() === '') {
    throw new ProviderSyncError('unauthorized', 'TWELVE_DATA_API_KEY is not configured');
  }

  return apiKey;
}

async function twelveDataGet(
  path: string,
  params: Record<string, string>,
  options: TwelveDataOptions,
): Promise<unknown> {
  const apiKey = requireApiKey(options);
  const url = new URL(`${TWELVE_DATA_URL}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set('apikey', apiKey);

  let response: Response;
  try {
    response = await (options.fetchImpl ?? fetch)(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      throw new ProviderSyncError('timeout', `Twelve Data timed out for ${path}`);
    }

    throw new ProviderSyncError('unavailable', `Twelve Data request failed for ${path}`);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ProviderSyncError('malformed', `Twelve Data returned non-JSON for ${path}`);
  }

  if (!response.ok) {
    throw mapTwelveDataHttpError(response.status, payload);
  }

  return payload;
}

export async function resolveInstrument(
  isin: string,
  options: TwelveDataOptions = {},
): Promise<ResolveInstrumentResult> {
  const payload = await twelveDataGet('/funds', { isin }, options);
  return parseTwelveDataFundsCatalog(payload, isin, options.expectedCurrency);
}

export async function fetchLatest(
  symbol: string,
  options: TwelveDataOptions = {},
): Promise<ProviderLatestResult> {
  const payload = await twelveDataGet('/quote', { symbol }, options);
  const history = parseTwelveDataQuote(payload, options.expectedCurrency);
  if (history.providerInstrumentId !== symbol) {
    throw new ProviderSyncError(
      'unknown_instrument',
      `Twelve Data quote symbol ${history.providerInstrumentId} does not match ${symbol}`,
    );
  }
  const observation = history.observations[history.observations.length - 1];
  assertLatestNotObviouslyStale(observation.priceDate, options.now);
  return {
    providerInstrumentId: history.providerInstrumentId,
    currency: history.currency,
    observation,
  };
}

export async function fetchHistory(
  symbol: string,
  options: TwelveDataOptions = {},
): Promise<ProviderHistoryResult> {
  const payload = await twelveDataGet(
    '/time_series',
    {
      symbol,
      interval: '1day',
      outputsize: String(HISTORY_OUTPUT_SIZE),
    },
    options,
  );
  const history = parseTwelveDataTimeSeries(payload, options.expectedCurrency);
  if (history.providerInstrumentId !== symbol) {
    throw new ProviderSyncError(
      'unknown_instrument',
      `Twelve Data history symbol ${history.providerInstrumentId} does not match ${symbol}`,
    );
  }
  return history;
}
