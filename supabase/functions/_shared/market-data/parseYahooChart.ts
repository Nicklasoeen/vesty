import { ProviderSyncError, type MarketObservation, type ProviderHistoryResult } from './types.ts';
import { assertCurrency, decimalStringFromNumber, priceDateFromUnix } from './validate.ts';

interface YahooChartQuote {
  close?: Array<number | null>;
}

interface YahooChartResult {
  meta?: {
    currency?: string;
    symbol?: string;
    instrumentType?: string;
    gmtoffset?: number;
    regularMarketTime?: number;
  };
  timestamp?: number[];
  indicators?: {
    quote?: YahooChartQuote[];
  };
}

export interface YahooChartResponse {
  chart?: {
    result?: YahooChartResult[] | null;
    error?: { code?: string; description?: string } | null;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function parseYahooChartResponse(
  payload: unknown,
  expectedCurrency?: string,
): ProviderHistoryResult {
  if (!isRecord(payload) || !isRecord(payload.chart)) {
    throw new ProviderSyncError('malformed', 'Yahoo response is not a chart document');
  }

  const chart = payload.chart as YahooChartResponse['chart'];
  if (chart?.error) {
    throw new ProviderSyncError(
      'unavailable',
      chart.error.description ?? chart.error.code ?? 'Yahoo chart error',
    );
  }

  const result = chart?.result?.[0];
  if (!result) {
    throw new ProviderSyncError('unknown_instrument', 'Yahoo returned no chart result');
  }

  const currency = result.meta?.currency;
  if (!currency) {
    throw new ProviderSyncError('malformed', 'Yahoo chart is missing currency');
  }

  try {
    assertCurrency(currency, expectedCurrency);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'invalid_currency';
    throw new ProviderSyncError(
      message === 'currency_mismatch' ? 'currency_mismatch' : 'malformed',
      `Yahoo currency ${currency} rejected`,
    );
  }

  const symbol = result.meta?.symbol;
  if (!symbol) {
    throw new ProviderSyncError('malformed', 'Yahoo chart is missing symbol');
  }

  const timestamps = result.timestamp ?? [];
  const closes = result.indicators?.quote?.[0]?.close ?? [];
  const gmtOffset = result.meta?.gmtoffset ?? 0;
  const observations: MarketObservation[] = [];

  for (let index = 0; index < timestamps.length; index += 1) {
    const close = closes[index];
    if (close == null) {
      continue;
    }

    try {
      observations.push({
        priceDate: priceDateFromUnix(timestamps[index], gmtOffset),
        price: decimalStringFromNumber(close),
        currency,
        priceType: 'nav',
        providerTimestamp: new Date(timestamps[index] * 1000).toISOString(),
      });
    } catch {
      // Skip a single malformed bar; reject later if nothing valid remains.
    }
  }

  if (observations.length === 0) {
    throw new ProviderSyncError('missing_price', 'Yahoo chart has no usable NAV closes');
  }

  return {
    providerInstrumentId: symbol,
    currency,
    observations,
  };
}

export function latestFromHistory(history: ProviderHistoryResult): MarketObservation {
  return history.observations[history.observations.length - 1];
}
