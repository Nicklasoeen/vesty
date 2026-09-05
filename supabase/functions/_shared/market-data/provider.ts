import type {
  MarketDataProvider,
  ProviderHistoryResult,
  ProviderLatestResult,
  ResolveInstrumentResult,
} from './types.ts';
import { ProviderSyncError } from './types.ts';
import * as marketstack from './marketstack.ts';
import * as twelveData from './twelveData.ts';
import * as yahooUnofficial from './yahooUnofficial.ts';

export interface ProviderRequestOptions {
  apiKey?: string;
  fetchImpl?: typeof fetch;
  expectedCurrency?: string;
  now?: Date;
}

export function assertKnownProvider(value: string): MarketDataProvider {
  if (value === 'twelve_data' || value === 'yahoo_unofficial' || value === 'marketstack') {
    return value;
  }

  throw new ProviderSyncError('unknown_instrument', `Unsupported market-data provider ${value}`);
}

export async function fetchLatest(
  provider: MarketDataProvider,
  symbol: string,
  options: ProviderRequestOptions = {},
): Promise<ProviderLatestResult> {
  if (provider === 'twelve_data') {
    return twelveData.fetchLatest(symbol, options);
  }

  if (provider === 'marketstack') {
    return marketstack.fetchLatest(symbol, options);
  }

  return yahooUnofficial.fetchLatest(symbol, options);
}

export async function fetchHistory(
  provider: MarketDataProvider,
  symbol: string,
  options: ProviderRequestOptions = {},
): Promise<ProviderHistoryResult> {
  if (provider === 'twelve_data') {
    return twelveData.fetchHistory(symbol, options);
  }

  if (provider === 'marketstack') {
    return marketstack.fetchHistory(symbol, options);
  }

  return yahooUnofficial.fetchHistory(symbol, options);
}

export async function resolveInstrument(
  provider: MarketDataProvider,
  isin: string,
  options: ProviderRequestOptions = {},
): Promise<ResolveInstrumentResult | null> {
  if (provider === 'twelve_data') {
    return twelveData.resolveInstrument(isin, options);
  }

  return null;
}
