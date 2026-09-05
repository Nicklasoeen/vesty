export type InstrumentKind = 'fund' | 'etf' | 'stock';

export function isInstrumentKind(value: string): value is InstrumentKind {
  return value === 'fund' || value === 'etf' || value === 'stock';
}

export function instrumentKindLabel(kind: string): string {
  switch (kind) {
    case 'fund':
      return 'Fund';
    case 'etf':
      return 'ETF';
    case 'stock':
      return 'Stock';
    default:
      return 'Instrument';
  }
}

export function instrumentSecondaryLabel(kind: string, currency: string | null | undefined): string {
  const kindLabel = instrumentKindLabel(kind);
  if (!currency) {
    return kindLabel;
  }
  return `${kindLabel} \u00B7 ${currency}`;
}
