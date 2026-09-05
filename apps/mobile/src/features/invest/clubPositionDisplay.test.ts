import assert from 'node:assert/strict';
import test from 'node:test';

import { clubPositionDisplay } from './clubPositionDisplay.ts';

test('amount-only club rows show invested NOK and invite exact holdings', () => {
  const row = clubPositionDisplay({
    name: 'Vanguard FTSE All-World UCITS ETF - (USD) Acc',
    ticker: 'VWCE',
    totalInvestedMinor: 80000,
    totalQuantity: null,
    quantityStatus: 'unavailable',
    currentValue: null,
    currentValueCurrency: null,
    valuationStatus: 'quantity_incomplete',
  });

  assert.equal(row.title, 'VWCE');
  assert.equal(row.investedLabel, '800 kr invested');
  assert.equal(row.quantityLabel, null);
  assert.equal(row.currentValueLabel, null);
  assert.equal(row.badge, null);
  assert.equal(row.missingExactLabel, 'Exact holdings not added');
});

test('exact holdings rows show units and EUR value without calling it verified', () => {
  const row = clubPositionDisplay({
    name: 'Vanguard FTSE All-World UCITS ETF - (USD) Acc',
    ticker: 'VWCE',
    totalInvestedMinor: 80000,
    totalQuantity: '0.642381',
    quantityStatus: 'complete',
    currentValue: '107.95855086',
    currentValueCurrency: 'EUR',
    valuationStatus: 'available',
  });

  assert.equal(row.quantityLabel, '0.642381 units');
  assert.equal(row.currentValueLabel, '€107.95855086 current value');
  assert.equal(row.badge, 'Exact holdings');
  assert.equal(row.missingExactLabel, null);
});
