import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canAddExactHoldings,
  confidenceForHolding,
  exactHoldingsBadge,
  missingExactHoldingsLabel,
  shouldShowExactHoldingsForm,
  shouldShowQuantityFieldsOnInvestmentDay,
} from './holdingConfidence.ts';

test('default Investment Day never shows quantity fields', () => {
  assert.equal(shouldShowQuantityFieldsOnInvestmentDay(), false);
});

test('amount-only rows are reported contributions, not exact holdings', () => {
  assert.equal(
    confidenceForHolding({ quantityStatus: 'unavailable' }),
    'reported_contribution',
  );
  assert.equal(
    missingExactHoldingsLabel('reported_contribution'),
    'Exact holdings not added',
  );
  assert.equal(exactHoldingsBadge('reported_contribution'), null);
});

test('complete member-reported quantity is exact, not broker-verified', () => {
  assert.equal(
    confidenceForHolding({ quantityStatus: 'complete', verificationStatus: 'member_reported' }),
    'exact_member_reported',
  );
  assert.equal(exactHoldingsBadge('exact_member_reported'), 'Exact holdings');
  assert.equal(missingExactHoldingsLabel('exact_member_reported'), null);
});

test('partial quantity stays reported contribution until every buy has units', () => {
  assert.equal(confidenceForHolding({ quantityStatus: 'partial' }), 'reported_contribution');
});

test('exact holdings CTA is only after a completed curated day with missing quantity', () => {
  assert.equal(
    canAddExactHoldings({
      isCompleted: true,
      supportsExactHoldings: true,
      missingQuantity: true,
    }),
    true,
  );
  assert.equal(
    canAddExactHoldings({
      isCompleted: false,
      supportsExactHoldings: true,
      missingQuantity: true,
    }),
    false,
  );
  assert.equal(
    shouldShowExactHoldingsForm({
      isCompleted: true,
      supportsExactHoldings: true,
      missingQuantity: true,
      exactHoldingsOpen: false,
    }),
    false,
  );
  assert.equal(
    shouldShowExactHoldingsForm({
      isCompleted: true,
      supportsExactHoldings: true,
      missingQuantity: true,
      exactHoldingsOpen: true,
    }),
    true,
  );
});
