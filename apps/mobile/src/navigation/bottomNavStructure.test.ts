import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { BOTTOM_NAV_SLOTS, BOTTOM_NAV_TAB_KEYS } from './bottomNavStructure.ts';

describe('bottom navigation structure', () => {
  it('keeps Home Club Invest Activity, with + as an action slot', () => {
    assert.deepEqual(BOTTOM_NAV_TAB_KEYS, ['home', 'club', 'invest', 'activity']);
    assert.deepEqual(BOTTOM_NAV_SLOTS, ['home', 'club', 'action', 'invest', 'activity']);
    assert.equal(BOTTOM_NAV_TAB_KEYS.includes('action' as (typeof BOTTOM_NAV_TAB_KEYS)[number]), false);
  });

  it('does not rename destinations to Explore, Portfolio, or You', () => {
    assert.equal(BOTTOM_NAV_TAB_KEYS.includes('explore' as never), false);
    assert.equal(BOTTOM_NAV_TAB_KEYS.includes('portfolio' as never), false);
    assert.equal(BOTTOM_NAV_TAB_KEYS.includes('you' as never), false);
  });
});
