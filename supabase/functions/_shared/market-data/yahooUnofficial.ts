import { ProviderSyncError, type ProviderHistoryResult } from './types.ts';
import { latestFromHistory, parseYahooChartResponse } from './parseYahooChart.ts';

const YAHOO_CHART_URL = 'https://query1.finance.yahoo.com/v8/finance/chart';
const REQUEST_TIMEOUT_MS = 20_000;

export interface YahooFetchOptions {
  fetchImpl?: typeof fetch;
  expectedCurrency?: string;
}

async function fetchYahooChart(
  symbol: string,
  range: '5d' | 'max',
  options: YahooFetchOptions,
): Promise<ProviderHistoryResult> {
  const url =
    `${YAHOO_CHART_URL}/${encodeURIComponent(symbol)}` +
    `?interval=1d&range=${range}&includePrePost=false`;

  let response: Response;
  try {
    response = await (options.fetchImpl ?? fetch)(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'VestyMarketData/1.0',
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      throw new ProviderSyncError('timeout', `Yahoo timed out for ${symbol}`);
    }

    throw new ProviderSyncError('unavailable', `Yahoo request failed for ${symbol}`);
  }

  if (response.status === 429) {
    throw new ProviderSyncError('rate_limited', `Yahoo rate-limited ${symbol}`);
  }

  if (response.status === 404) {
    throw new ProviderSyncError('unknown_instrument', `Yahoo has no chart for ${symbol}`);
  }

  if (!response.ok) {
    throw new ProviderSyncError('unavailable', `Yahoo HTTP ${response.status} for ${symbol}`);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ProviderSyncError('malformed', `Yahoo returned non-JSON for ${symbol}`);
  }

  return parseYahooChartResponse(payload, options.expectedCurrency);
}

export async function fetchLatest(
  symbol: string,
  options: YahooFetchOptions = {},
) {
  const history = await fetchYahooChart(symbol, '5d', options);
  return {
    providerInstrumentId: history.providerInstrumentId,
    currency: history.currency,
    observation: latestFromHistory(history),
  };
}

export async function fetchHistory(
  symbol: string,
  options: YahooFetchOptions = {},
): Promise<ProviderHistoryResult> {
  return fetchYahooChart(symbol, 'max', options);
}
