export const DNB_GLOBAL_INDEKS_A_PRODUCT_ID = '32000000-0000-4000-8000-000000000001';

export type SingleFundBrokerId = 'dnb' | 'nordnet';
export type SingleFundProductStatus = 'active' | 'inactive';
export type CatalogLoadState = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

export interface SingleFundBrokerListing {
  broker: SingleFundBrokerId;
  isVerified: boolean;
  productUrl: string;
  annualCostLabel: string;
  costSourceLabel: string;
  costSourceUrl: string;
  minimumNote: string | null;
}

export interface SingleFundProduct {
  id: string;
  legalName: string;
  displayName: string;
  managerName: string;
  shortDescription: string;
  riskIndicator: string;
  recommendedHorizon: string;
  currency: string;
  isin: string;
  kind: 'fund';
  status: SingleFundProductStatus;
  displayOrder: number;
  checkedOn: string;
  brokers: readonly SingleFundBrokerListing[];
}

export const DNB_GLOBAL_INDEKS_A: SingleFundProduct = {
  id: DNB_GLOBAL_INDEKS_A_PRODUCT_ID,
  legalName: 'DNB Global Indeks A',
  displayName: 'DNB Global Indeks A',
  managerName: 'DNB',
  shortDescription: 'Global index-tracking equity fund focused on developed markets',
  riskIndicator: '4 of 7',
  recommendedHorizon: 'At least 6 years',
  currency: 'NOK',
  isin: 'NO0010582984',
  kind: 'fund',
  status: 'active',
  displayOrder: 1,
  checkedOn: '2026-09-07',
  brokers: [
    {
      broker: 'dnb',
      isVerified: true,
      productUrl: 'https://www.dnb.no/sparing/fond/fond-liste/d/dnb-global-indeks-a-NO0010582984',
      annualCostLabel: '0.20% annual price through DNB',
      costSourceLabel: 'DNB fund page, checked 7 September 2026',
      costSourceUrl: 'https://www.dnb.no/sparing/fond/fond-liste/d/dnb-global-indeks-a-NO0010582984',
      minimumNote: 'DNB lists a 100 kr minimum on its own platform. Other brokers may differ.',
    },
    {
      broker: 'nordnet',
      isVerified: true,
      productUrl: 'https://www.nordnet.no/fond/liste/dnb-global-indeks-a-nok-7b4b0894',
      annualCostLabel: '0.25% total annual price at Nordnet',
      costSourceLabel: 'Nordnet fund page, checked 7 September 2026',
      costSourceUrl: 'https://www.nordnet.no/fond/liste/dnb-global-indeks-a-nok-7b4b0894',
      minimumNote: null,
    },
  ],
};

export function isSingleFundBrokerId(value: unknown): value is SingleFundBrokerId {
  return value === 'dnb' || value === 'nordnet';
}

export function findSingleFundProduct(
  products: readonly SingleFundProduct[],
  productId: string | null,
): SingleFundProduct | null {
  if (!productId) {
    return null;
  }
  return products.find((product) => product.id === productId) ?? null;
}

export function reconcileCatalogSelection(
  selectedId: string | null,
  products: readonly SingleFundProduct[],
): { catalogProductId: string | null; unavailableMessage: string | null } {
  if (!selectedId) {
    return { catalogProductId: null, unavailableMessage: null };
  }

  const selected = products.find((product) => product.id === selectedId && product.status === 'active');
  if (selected) {
    return { catalogProductId: selected.id, unavailableMessage: null };
  }

  return {
    catalogProductId: null,
    unavailableMessage: 'This fund is no longer available for new clubs. Choose another fund to continue.',
  };
}

export function parseSingleFundCatalog(rows: unknown): SingleFundProduct[] {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows.flatMap((row) => {
    const parsed = parseSingleFundProduct(row);
    return parsed ? [parsed] : [];
  });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseSingleFundProduct(value: unknown): SingleFundProduct | null {
  const row = asRecord(value);
  if (!row) {
    return null;
  }

  const id = typeof row.product_id === 'string' ? row.product_id : typeof row.id === 'string' ? row.id : null;
  const legalName = typeof row.legal_name === 'string' ? row.legal_name : null;
  const displayName = typeof row.display_name === 'string' ? row.display_name : legalName;
  const managerName = typeof row.manager_name === 'string' ? row.manager_name : null;
  const shortDescription = typeof row.short_description === 'string' ? row.short_description : null;
  const riskIndicator = typeof row.risk_indicator === 'string' ? row.risk_indicator : null;
  const recommendedHorizon = typeof row.recommended_horizon === 'string' ? row.recommended_horizon : null;
  const currency = typeof row.currency === 'string' ? row.currency : null;
  const isin = typeof row.isin === 'string' ? row.isin : null;
  const kind = row.kind;
  const status = row.status;
  const checkedOn = typeof row.checked_on === 'string' ? row.checked_on : null;

  if (
    !id
    || !legalName
    || !displayName
    || !managerName
    || !shortDescription
    || !riskIndicator
    || !recommendedHorizon
    || !currency
    || !isin
    || kind !== 'fund'
    || (status !== 'active' && status !== 'inactive')
    || !checkedOn
  ) {
    return null;
  }

  const displayOrder =
    typeof row.display_order === 'number' && Number.isInteger(row.display_order)
      ? row.display_order
      : typeof row.display_order === 'string' && /^\d+$/.test(row.display_order)
        ? Number.parseInt(row.display_order, 10)
        : 0;

  return {
    id,
    legalName,
    displayName,
    managerName,
    shortDescription,
    riskIndicator,
    recommendedHorizon,
    currency,
    isin,
    kind,
    status,
    displayOrder,
    checkedOn,
    brokers: parseBrokers(row.brokers),
  };
}

function parseBrokers(value: unknown): SingleFundBrokerListing[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    const row = asRecord(item);
    if (!row || !isSingleFundBrokerId(row.broker)) {
      return [];
    }
    if (
      typeof row.is_verified !== 'boolean'
      || typeof row.product_url !== 'string'
      || typeof row.annual_cost_label !== 'string'
      || typeof row.cost_source_label !== 'string'
      || typeof row.cost_source_url !== 'string'
    ) {
      return [];
    }

    return [
      {
        broker: row.broker,
        isVerified: row.is_verified,
        productUrl: row.product_url,
        annualCostLabel: row.annual_cost_label,
        costSourceLabel: row.cost_source_label,
        costSourceUrl: row.cost_source_url,
        minimumNote: typeof row.minimum_note === 'string' ? row.minimum_note : null,
      },
    ];
  });
}
