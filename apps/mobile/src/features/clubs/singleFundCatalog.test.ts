import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DNB_GLOBAL_INDEKS_A,
  DNB_GLOBAL_INDEKS_A_PRODUCT_ID,
  parseSingleFundCatalog,
  reconcileCatalogSelection,
} from './singleFundCatalog.ts';

describe('single-fund catalog', () => {
  it('parses the server catalog without exposing a target id', () => {
    const products = parseSingleFundCatalog([
      {
        product_id: DNB_GLOBAL_INDEKS_A_PRODUCT_ID,
        legal_name: 'DNB Global Indeks A',
        display_name: 'DNB Global Indeks A',
        manager_name: 'DNB',
        short_description: 'Global index-tracking equity fund focused on developed markets',
        risk_indicator: '4 of 7',
        recommended_horizon: 'At least 6 years',
        currency: 'NOK',
        isin: 'NO0010582984',
        kind: 'fund',
        status: 'active',
        display_order: 1,
        checked_on: '2026-09-07',
        brokers: [
          {
            broker: 'dnb',
            is_verified: true,
            product_url: DNB_GLOBAL_INDEKS_A.brokers[0]!.productUrl,
            annual_cost_label: DNB_GLOBAL_INDEKS_A.brokers[0]!.annualCostLabel,
            cost_source_label: DNB_GLOBAL_INDEKS_A.brokers[0]!.costSourceLabel,
            cost_source_url: DNB_GLOBAL_INDEKS_A.brokers[0]!.costSourceUrl,
            minimum_note: DNB_GLOBAL_INDEKS_A.brokers[0]!.minimumNote,
          },
        ],
      },
    ]);

    assert.equal(products[0]?.id, DNB_GLOBAL_INDEKS_A_PRODUCT_ID);
    assert.equal('investmentTargetId' in (products[0] ?? {}), false);
  });

  it('clears a selected fund that disappeared from the catalog', () => {
    const kept = reconcileCatalogSelection(DNB_GLOBAL_INDEKS_A_PRODUCT_ID, [DNB_GLOBAL_INDEKS_A]);
    assert.equal(kept.catalogProductId, DNB_GLOBAL_INDEKS_A_PRODUCT_ID);
    assert.equal(kept.unavailableMessage, null);

    const cleared = reconcileCatalogSelection(DNB_GLOBAL_INDEKS_A_PRODUCT_ID, []);
    assert.equal(cleared.catalogProductId, null);
    assert.match(cleared.unavailableMessage ?? '', /no longer available/);
  });
});
