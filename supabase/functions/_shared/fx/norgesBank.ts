import { parseNorgesBankEurNok } from './parseNorgesBank.ts';
import { FxSyncError, type FxObservation } from './types.ts';

const NORGES_BANK_EXR_URL = 'https://data.norges-bank.no/api/data/EXR/B.EUR.NOK.SP';
const HISTORY_DAYS = 365;

export interface NorgesBankFetchOptions {
  fetchImpl?: typeof fetch;
  now?: Date;
}

function isoDateUtc(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function shiftUtcDays(value: Date, days: number): Date {
  const next = new Date(value.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.trim() === '') {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new FxSyncError('malformed', 'Norges Bank returned non-JSON');
  }
}

function mapHttpError(status: number): FxSyncError {
  if (status === 404) {
    return new FxSyncError('missing_rate', 'Norges Bank has no EUR/NOK observations for the requested window');
  }

  return new FxSyncError('unavailable', `Norges Bank request failed (${status})`);
}

async function fetchEurNokWindow(
  startPeriod: string,
  endPeriod: string,
  options: NorgesBankFetchOptions,
): Promise<FxObservation[]> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const url = new URL(NORGES_BANK_EXR_URL);
  url.searchParams.set('format', 'sdmx-json');
  url.searchParams.set('startPeriod', startPeriod);
  url.searchParams.set('endPeriod', endPeriod);
  url.searchParams.set('locale', 'en');

  let response: Response;
  try {
    response = await fetchImpl(url, {
      headers: {
        Accept: 'application/json',
      },
    });
  } catch {
    throw new FxSyncError('timeout', 'Norges Bank request failed');
  }

  const payload = await readJson(response);
  if (!response.ok) {
    throw mapHttpError(response.status);
  }

  return parseNorgesBankEurNok(payload, options.now ?? new Date());
}

export async function fetchLatestEurNok(options: NorgesBankFetchOptions = {}): Promise<FxObservation[]> {
  const now = options.now ?? new Date();
  const endPeriod = isoDateUtc(now);
  const startPeriod = isoDateUtc(shiftUtcDays(now, -14));
  return fetchEurNokWindow(startPeriod, endPeriod, { ...options, now });
}

export async function fetchHistoryEurNok(options: NorgesBankFetchOptions = {}): Promise<FxObservation[]> {
  const now = options.now ?? new Date();
  const endPeriod = isoDateUtc(now);
  const startPeriod = isoDateUtc(shiftUtcDays(now, -(HISTORY_DAYS - 1)));
  return fetchEurNokWindow(startPeriod, endPeriod, { ...options, now });
}

export const norgesBankLicense = 'norges_bank_nlod_2_0';
export const norgesBankHistoryDays = HISTORY_DAYS;
