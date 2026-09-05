import assert from 'node:assert/strict';
import test from 'node:test';

import { CORE_V1_TARGET_IDS } from '../clubs/curatedInvestmentPackages.ts';

import {
  buildExecutionReports,
  canConfirmQuantityReports,
  confirmationModeForTargetIds,
  parseOptionalExecutionPriceInput,
  parseQuantityInput,
} from './investmentDayReporting.ts';

const WORLD_MIX_IDS = [
  CORE_V1_TARGET_IDS.vwce,
  CORE_V1_TARGET_IDS.eunk,
  CORE_V1_TARGET_IDS.is3n,
] as const;

test('curated V1 ETF sets require quantity confirmation', () => {
  assert.equal(confirmationModeForTargetIds(WORLD_MIX_IDS), 'quantity_required');
  assert.equal(
    confirmationModeForTargetIds(['31000000-0000-4000-8000-000000000001']),
    'amount_only',
  );
});

test('quantity input rejects empty, zero, negative, and scientific notation', () => {
  assert.equal(parseQuantityInput('').canonical, null);
  assert.equal(parseQuantityInput('0').canonical, null);
  assert.equal(parseQuantityInput('-1').canonical, null);
  assert.equal(parseQuantityInput('1e-2').canonical, null);
  assert.equal(parseQuantityInput('0.123456789').canonical, null);
});

test('quantity input accepts fractional ETF units', () => {
  assert.equal(parseQuantityInput('0.642381').canonical, '0.642381');
  assert.equal(parseQuantityInput('1.5').canonical, '1.5');
  assert.equal(parseQuantityInput('12').canonical, '12');
  assert.equal(parseQuantityInput('123.000001').canonical, '123.000001');
  assert.equal(parseQuantityInput(' 0,123456 ').canonical, '0.123456');
});

test('execution price is optional and must be positive when present', () => {
  assert.equal(parseOptionalExecutionPriceInput('').canonical, null);
  assert.equal(parseOptionalExecutionPriceInput('').error, null);
  assert.equal(parseOptionalExecutionPriceInput('167.54').canonical, '167.54');
  assert.equal(parseOptionalExecutionPriceInput('0').canonical, null);
});

test('confirm stays disabled until every allocated quantity is valid', () => {
  const fields = {
    [CORE_V1_TARGET_IDS.vwce]: parseQuantityInput('0.642381'),
    [CORE_V1_TARGET_IDS.eunk]: parseQuantityInput(''),
    [CORE_V1_TARGET_IDS.is3n]: parseQuantityInput('12'),
  };

  assert.equal(canConfirmQuantityReports(WORLD_MIX_IDS, fields), false);

  const complete = {
    ...fields,
    [CORE_V1_TARGET_IDS.eunk]: parseQuantityInput('1.5'),
  };

  assert.equal(canConfirmQuantityReports(WORLD_MIX_IDS, complete), true);
});

test('invalid optional execution price blocks confirm', () => {
  const fields = {
    [CORE_V1_TARGET_IDS.vwce]: parseQuantityInput('1'),
    [CORE_V1_TARGET_IDS.eunk]: parseQuantityInput('1'),
    [CORE_V1_TARGET_IDS.is3n]: parseQuantityInput('1'),
  };
  const prices = {
    [CORE_V1_TARGET_IDS.vwce]: parseOptionalExecutionPriceInput('abc'),
  };

  assert.equal(canConfirmQuantityReports(WORLD_MIX_IDS, fields, prices), false);
});

test('buildExecutionReports sends quantity strings and omits empty prices', () => {
  const fields = {
    [CORE_V1_TARGET_IDS.vwce]: parseQuantityInput('0.642381'),
    [CORE_V1_TARGET_IDS.eunk]: parseQuantityInput('1.5'),
    [CORE_V1_TARGET_IDS.is3n]: parseQuantityInput('12'),
  };
  const prices = {
    [CORE_V1_TARGET_IDS.vwce]: parseOptionalExecutionPriceInput('167.54'),
    [CORE_V1_TARGET_IDS.eunk]: parseOptionalExecutionPriceInput(''),
  };

  assert.deepEqual(buildExecutionReports(WORLD_MIX_IDS, fields, prices), [
    {
      investmentTargetId: CORE_V1_TARGET_IDS.vwce,
      quantity: '0.642381',
      executionUnitPrice: '167.54',
    },
    {
      investmentTargetId: CORE_V1_TARGET_IDS.eunk,
      quantity: '1.5',
    },
    {
      investmentTargetId: CORE_V1_TARGET_IDS.is3n,
      quantity: '12',
    },
  ]);
});
