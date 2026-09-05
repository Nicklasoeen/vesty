export type MarketDataProvider = 'yahoo_unofficial' | 'twelve_data';

export type MarketPriceType = 'nav' | 'close' | 'delayed';

export interface MarketObservation {
  priceDate: string;
  price: string;
  currency: string;
  priceType: MarketPriceType;
  providerTimestamp: string | null;
}

export interface ProviderLatestResult {
  providerInstrumentId: string;
  currency: string;
  observation: MarketObservation;
}

export interface ProviderHistoryResult {
  providerInstrumentId: string;
  currency: string;
  observations: MarketObservation[];
}

export type ProviderFailureCode =
  | 'timeout'
  | 'unavailable'
  | 'malformed'
  | 'rate_limited'
  | 'unknown_instrument'
  | 'currency_mismatch'
  | 'missing_price';

export class ProviderSyncError extends Error {
  readonly code: ProviderFailureCode;

  constructor(code: ProviderFailureCode, message: string) {
    super(message);
    this.name = 'ProviderSyncError';
    this.code = code;
  }
}
