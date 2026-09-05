import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ESTIMATED_VALUATION_INFO,
  portfolioValueCaption,
  portfolioValueChartLabel,
} from './valuationLabels.ts';

test('estimated and mixed captions never claim broker verification', () => {
  assert.equal(portfolioValueCaption('estimated'), 'Estimated');
  assert.equal(portfolioValueCaption('mixed'), 'Partly estimated');
  assert.equal(portfolioValueCaption('exact'), 'Based on reported holdings');
  assert.equal(portfolioValueCaption('unavailable'), null);
  assert.doesNotMatch(ESTIMATED_VALUATION_INFO, /verified|broker confirmed|exact/i);
});

test('chart legend uses estimated wording when the series is modelled', () => {
  assert.equal(portfolioValueChartLabel('estimated'), 'Estimated value');
  assert.equal(portfolioValueChartLabel('mixed'), 'Estimated value');
  assert.equal(portfolioValueChartLabel('exact'), 'Value');
});
