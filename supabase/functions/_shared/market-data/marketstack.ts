import { assertMarketstackV1Symbol } from './marketstackAllowlist.ts';
import { mapMarketstackHttpError, marketstackPagination, parseMarketstackEod } from './parseMarketstack.ts';
import { assertLatestNotObviouslyStale } from './parseTwelveData.ts';
import {
  ProviderSyncError,
  type ProviderHistoryResult,
  type ProviderLatestResult,
} from './types.ts';

const MARKETSTACK_URL = 'https://api.marketstack.com/v2';
const REQUEST_TIMEOUT_MS = 20_000;
const HISTORY_DAYS = 365;
const PAGE_LIMIT = 1000;
const MAX_PAGES = 4;

export interface MarketstackOptions {
  apiKey?: string;
  fetchImpl?: typeof fetch;
  expectedCurrency?: string;
  now?: Date;
}

function requireApiKey(options: MarketstackOptions): string {
  const apiKey = options.apiKey ?? '';
  if (apiKey.trim() === '') {
    throw new ProviderSyncError('unauthorized', 'MARKETSTACK_API_KEY is not configured');
  }

  return apiKey;
}

function isoDateUtc(value: Date): string {
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}`;
}

function historyWindow(now: Date): { dateFrom: string; dateTo: string } {
  const dateTo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dateFrom = new Date(dateTo);
  dateFrom.setUTCDate(dateFrom.getUTCDate() - HISTORY_DAYS);
  return {
    dateFrom: isoDateUtc(dateFrom),
    dateTo: isoDateUtc(dateTo),
  };
}

async function marketstackGet(
  path: string,
  params: Record<string, string>,
  options: MarketstackOptions,
): Promise<unknown> {
  const apiKey = requireApiKey(options);
  const url = new URL(`${MARKETSTACK_URL}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set('access_key', apiKey);

  let response: Response;
  try {
    response = await (options.fetchImpl ?? fetch)(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      throw new ProviderSyncError('timeout', `Marketstack timed out for ${path}`);
    }

    throw new ProviderSyncError('unavailable', `Marketstack request failed for ${path}`);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ProviderSyncError('malformed', `Marketstack returned non-JSON for ${path}`);
  }

  if (!response.ok) {
    throw mapMarketstackHttpError(response.status, payload);
  }

  return payload;
}

function requireAllowlistedSymbol(symbol: string): ReturnType<typeof assertMarketstackV1Symbol> {
  try {
    return assertMarketstackV1Symbol(symbol);
  } catch {
    throw new ProviderSyncError('unknown_instrument', 'Marketstack is not approved for this symbol');
  }
}

export async function fetchLatest(
  symbol: string,
  options: MarketstackOptions = {},
): Promise<ProviderLatestResult> {
  const requested = requireAllowlistedSymbol(symbol);
  const payload = await marketstackGet(
    '/eod/latest',
    { symbols: requested },
    options,
  );
  const history = parseMarketstackEod(payload, requested, options.expectedCurrency, options.now);
  const observation = history.observations[history.observations.length - 1];
  assertLatestNotObviouslyStale(observation.priceDate, options.now);
  return {
    providerInstrumentId: requested,
    currency: history.currency,
    observation,
  };
}

export async function fetchHistory(
  symbol: string,
  options: MarketstackOptions = {},
): Promise<ProviderHistoryResult> {
  const requested = requireAllowlistedSymbol(symbol);
  const now = options.now ?? new Date();
  const { dateFrom, dateTo } = historyWindow(now);
  const observations = [];

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const payload = await marketstackGet(
      '/eod',
      {
        symbols: requested,
        date_from: dateFrom,
        date_to: dateTo,
        limit: String(PAGE_LIMIT),
        offset: String(page * PAGE_LIMIT),
        sort: 'ASC',
      },
      options,
    );
    const parsed = parseMarketstackEod(payload, requested, options.expectedCurrency, now);
    observations.push(...parsed.observations);

    const pagination = marketstackPagination(payload);
    const nextOffset = pagination.offset + (pagination.limit || PAGE_LIMIT);
    if (pagination.total <= 0 || nextOffset >= pagination.total) {
      break;
    }
  }

  if (observations.length === 0) {
    throw new ProviderSyncError('missing_price', `Marketstack history is empty for ${requested}`);
  }

  const unique = new Map<string, (typeof observations)[number]>();
  for (const observation of observations) {
    unique.set(observation.priceDate, observation);
  }

  const ordered = [...unique.values()].sort((left, right) => left.priceDate.localeCompare(right.priceDate));

  return {
    providerInstrumentId: requested,
    currency: ordered[ordered.length - 1].currency,
    observations: ordered,
  };
}
