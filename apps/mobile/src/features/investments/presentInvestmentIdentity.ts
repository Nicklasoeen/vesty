import { CORE_V1_TARGETS } from '../clubs/curatedInvestmentPackages.ts';

export type InvestmentMarkKey = 'vanguard' | 'ishares';

export interface CuratedInstrumentPresentation {
  ticker: string;
  friendlyName: string;
  issuer: 'Vanguard' | 'iShares';
  markKey: InvestmentMarkKey;
  officialName: string;
}

export const CURATED_INSTRUMENT_PRESENTATION = {
  VWCE: {
    ticker: 'VWCE',
    friendlyName: 'Global equities',
    issuer: 'Vanguard',
    markKey: 'vanguard',
    officialName: 'Vanguard FTSE All-World UCITS ETF - (USD) Acc',
  },
  SXR8: {
    ticker: 'SXR8',
    friendlyName: 'S&P 500',
    issuer: 'iShares',
    markKey: 'ishares',
    officialName: 'iShares Core S&P 500 UCITS ETF USD (Acc)',
  },
  EUNK: {
    ticker: 'EUNK',
    friendlyName: 'European equities',
    issuer: 'iShares',
    markKey: 'ishares',
    officialName: 'iShares Core MSCI Europe UCITS ETF EUR (Acc)',
  },
  IS3N: {
    ticker: 'IS3N',
    friendlyName: 'Emerging markets',
    issuer: 'iShares',
    markKey: 'ishares',
    officialName: 'iShares Core MSCI EM IMI UCITS ETF USD (Acc)',
  },
  SXRV: {
    ticker: 'SXRV',
    friendlyName: 'Nasdaq 100',
    issuer: 'iShares',
    markKey: 'ishares',
    officialName: 'iShares NASDAQ 100 UCITS ETF USD (Acc)',
  },
} as const satisfies Record<string, CuratedInstrumentPresentation>;

export type CuratedInstrumentTicker = keyof typeof CURATED_INSTRUMENT_PRESENTATION;

export interface InvestmentIdentityPresentation {
  ticker: string;
  friendlyName: string;
  issuer: string | null;
  markKey: InvestmentMarkKey | null;
  officialName: string | null;
  fallbackInitials: string;
  isCurated: boolean;
}

const TARGETS_BY_ID = new Map(CORE_V1_TARGETS.map((target) => [target.id, target]));

function normalizeTicker(value: string | null | undefined): string | null {
  const ticker = value?.trim().toUpperCase();
  return ticker ? ticker : null;
}

function looksLikeLegalProductName(name: string): boolean {
  return /ucits|\betf\b|\(acc\)|\(dist\)|isin/i.test(name);
}

function tickerInitials(ticker: string): string {
  const letters = ticker.replace(/[^A-Z0-9]/gi, '');
  if (letters.length >= 2) {
    return letters.slice(0, 2).toUpperCase();
  }
  return (letters || '?').toUpperCase();
}

function curatedFromTicker(ticker: string): CuratedInstrumentPresentation | null {
  if (ticker in CURATED_INSTRUMENT_PRESENTATION) {
    return CURATED_INSTRUMENT_PRESENTATION[ticker as CuratedInstrumentTicker];
  }
  return null;
}

/**
 * Beginner-facing identity for Club / Invest surfaces.
 * Curated V1 ETFs use an explicit mapping — never heuristic legal-name parsing.
 */
export function presentInvestmentIdentity(input: {
  ticker?: string | null;
  name?: string | null;
  targetId?: string | null;
}): InvestmentIdentityPresentation {
  const ticker = normalizeTicker(input.ticker);
  const target = input.targetId ? TARGETS_BY_ID.get(input.targetId) ?? null : null;
  const fromTicker = ticker ? curatedFromTicker(ticker) : null;
  const fromTarget = target ? curatedFromTicker(target.ticker) : null;
  const fromOfficialName = CORE_V1_TARGETS.find(
    (item) => item.officialName === input.name || item.shortName === input.name,
  );
  const curated = fromTicker ?? fromTarget ?? (fromOfficialName ? curatedFromTicker(fromOfficialName.ticker) : null);

  if (curated) {
    return {
      ticker: curated.ticker,
      friendlyName: curated.friendlyName,
      issuer: curated.issuer,
      markKey: curated.markKey,
      officialName: curated.officialName,
      fallbackInitials: tickerInitials(curated.ticker),
      isCurated: true,
    };
  }

  const rawName = input.name?.trim() || null;
  const resolvedTicker = ticker ?? (rawName && !looksLikeLegalProductName(rawName) ? rawName : null) ?? '—';
  const friendlyName =
    rawName && !looksLikeLegalProductName(rawName) && rawName !== resolvedTicker
      ? rawName
      : resolvedTicker;

  return {
    ticker: resolvedTicker,
    friendlyName,
    issuer: null,
    markKey: null,
    officialName: rawName && looksLikeLegalProductName(rawName) ? rawName : null,
    fallbackInitials: tickerInitials(resolvedTicker === '—' ? '?' : resolvedTicker),
    isCurated: false,
  };
}

export function investmentIdentityAccessibilityLabel(identity: InvestmentIdentityPresentation): string {
  if (identity.friendlyName && identity.friendlyName !== identity.ticker) {
    return `${identity.ticker}, ${identity.friendlyName}`;
  }
  return identity.ticker;
}
