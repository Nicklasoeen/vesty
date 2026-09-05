export type FxProvider = 'norges_bank';

export interface FxObservation {
  rateDate: string;
  rate: string;
  baseCurrency: 'EUR';
  quoteCurrency: 'NOK';
}

export type FxFailureCode =
  | 'timeout'
  | 'unavailable'
  | 'malformed'
  | 'currency_mismatch'
  | 'missing_rate';

export class FxSyncError extends Error {
  readonly code: FxFailureCode;

  constructor(code: FxFailureCode, message: string) {
    super(message);
    this.name = 'FxSyncError';
    this.code = code;
  }
}
