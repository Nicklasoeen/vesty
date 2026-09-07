import assert from 'node:assert/strict';
import test from 'node:test';

import { clubPositionDisplay } from './clubPositionDisplay.ts';

test('legacy plan-based amounts are labelled as assumed, not invested', () => {
  const row = clubPositionDisplay({
    name: 'Vanguard FTSE All-World UCITS ETF - (USD) Acc',
    ticker: 'VWCE',
    totalInvestedMinor: 80000,
    totalQuantity: null,
    quantityStatus: 'unavailable',
    currentValue: null,
    currentValueCurrency: null,
    valuationStatus: 'quantity_incomplete',
    amountProvenance: 'legacy_plan_assumed',
  });

  assert.equal(row.investedLabel, '800 kr planned (assumed)');
});

test('amount-only club rows show reported NOK without calling it invested', () => {
  const row = clubPositionDisplay({
    name: 'Vanguard FTSE All-World UCITS ETF - (USD) Acc',
    ticker: 'VWCE',
    totalInvestedMinor: 80000,
    totalQuantity: null,
    quantityStatus: 'unavailable',
    currentValue: null,
    currentValueCurrency: null,
    valuationStatus: 'quantity_incomplete',
    amountProvenance: 'member_reported_actual',
  });

  assert.equal(row.title, 'VWCE');
  assert.equal(row.investedLabel, '800 kr reported');
  assert.equal(row.quantityLabel, null);
  assert.equal(row.currentValueLabel, null);
  assert.equal(row.badge, null);
  assert.equal(row.missingExactLabel, 'Exact holdings not added');
});

test('mixed and unknown club amounts are not labelled reported', () => {
  const mixed = clubPositionDisplay({
    name: 'VWCE',
    ticker: 'VWCE',
    totalInvestedMinor: 80000,
    totalQuantity: null,
    quantityStatus: 'unavailable',
    currentValue: null,
    currentValueCurrency: null,
    valuationStatus: 'quantity_incomplete',
    amountProvenance: 'mixed',
  });
  const unknown = clubPositionDisplay({
    name: 'VWCE',
    ticker: 'VWCE',
    totalInvestedMinor: 80000,
    totalQuantity: null,
    quantityStatus: 'unavailable',
    currentValue: null,
    currentValueCurrency: null,
    valuationStatus: 'quantity_incomplete',
    amountProvenance: null,
  });

  assert.equal(mixed.investedLabel, '800 kr mixed basis');
  assert.equal(unknown.investedLabel, '800 kr unverified');
  assert.equal(/reported/i.test(mixed.investedLabel), false);
  assert.equal(/reported/i.test(unknown.investedLabel), false);
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

test('estimated NOK value is labelled estimated and does not invent units', () => {
  const row = clubPositionDisplay({
    name: 'Vanguard FTSE All-World UCITS ETF - (USD) Acc',
    ticker: 'VWCE',
    totalInvestedMinor: 120000,
    totalQuantity: null,
    quantityStatus: 'unavailable',
    currentValue: null,
    currentValueCurrency: null,
    valuationStatus: 'quantity_incomplete',
    estimatedCurrentValueMinor: 137500,
    valuationConfidence: 'estimated',
  });

  assert.equal(row.quantityLabel, null);
  assert.equal(row.currentValueLabel, '1\u00a0375 kr current value');
  assert.equal(row.badge, 'Estimated');
  assert.equal(row.missingExactLabel, 'Exact holdings not added');
});
