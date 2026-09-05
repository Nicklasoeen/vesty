import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatDecimalString,
  formatEuroDecimal,
  formatQuantityLabel,
  trimDecimalString,
} from './decimalDisplay.ts';

test('trims trailing zeros without scientific notation', () => {
  assert.equal(trimDecimalString('1.50000000'), '1.5');
  assert.equal(trimDecimalString('12'), '12');
  assert.equal(trimDecimalString('123.000001'), '123.000001');
  assert.equal(trimDecimalString('0.123456'), '0.123456');
});

test('formats quantity with preserved decimals', () => {
  assert.equal(formatQuantityLabel('1.284762'), '1.284762 units');
  assert.equal(formatQuantityLabel('12'), '12 units');
});

test('formats euro amounts without inventing extra precision', () => {
  assert.equal(formatEuroDecimal('168.06'), '€168.06');
  assert.equal(formatEuroDecimal('47.534'), '€47.534');
  assert.equal(formatEuroDecimal('1458'), '€1\u00a0458.00');
  assert.equal(formatDecimalString('215.91510172', { minFractionDigits: 2, maxFractionDigits: 8 }), '215.91510172');
});
