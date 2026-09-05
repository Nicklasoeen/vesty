export const MARKETSTACK_V1_SYMBOLS = ['VWCE.DE', 'EUNK.DE', 'IS3N.DE', 'SXR8.DE', 'SXRV.DE'] as const;

export type MarketstackV1Symbol = (typeof MARKETSTACK_V1_SYMBOLS)[number];

/**
 * Wide sanity bands around the 2026-09-03 verified Xetra closes.
 * These catch ADR-scale / wrong-listing collisions, not ordinary market moves.
 */
const MAGNITUDE_BOUNDS: Record<MarketstackV1Symbol, { min: number; max: number }> = {
  'VWCE.DE': { min: 30, max: 800 },
  'EUNK.DE': { min: 20, max: 500 },
  'IS3N.DE': { min: 8, max: 250 },
  'SXR8.DE': { min: 150, max: 3000 },
  'SXRV.DE': { min: 250, max: 6000 },
};

const ALLOWED_EXCHANGES = new Set(['XETR', 'XETRA']);

export function normalizeMarketstackSymbol(value: string): string {
  return value.trim().toUpperCase();
}

export function isMarketstackV1Symbol(value: string): value is MarketstackV1Symbol {
  return (MARKETSTACK_V1_SYMBOLS as readonly string[]).includes(normalizeMarketstackSymbol(value));
}

export function assertMarketstackV1Symbol(value: string): MarketstackV1Symbol {
  const normalized = normalizeMarketstackSymbol(value);
  if (!isMarketstackV1Symbol(normalized)) {
    throw new Error('unsupported_marketstack_symbol');
  }

  return normalized;
}

export function marketstackMagnitudeBounds(symbol: MarketstackV1Symbol): { min: number; max: number } {
  return MAGNITUDE_BOUNDS[symbol];
}

export function isAllowedMarketstackExchange(value: string | null): boolean {
  if (value == null || value.trim() === '') {
    return true;
  }

  return ALLOWED_EXCHANGES.has(value.trim().toUpperCase());
}
