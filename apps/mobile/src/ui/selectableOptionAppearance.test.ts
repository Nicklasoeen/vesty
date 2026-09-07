import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { presentSelectableOptionAppearance } from './selectableOptionAppearance.ts';

describe('presentSelectableOptionAppearance', () => {
  it('makes an unselected choice look tappable, not like a heading', () => {
    const presented = presentSelectableOptionAppearance(false);

    assert.equal(presented.selected, false);
    assert.equal(presented.indicator, 'empty');
    assert.equal(presented.surfaceToken, 'surface');
    assert.equal(presented.borderToken, 'border');
    assert.equal(presented.titleEmphasis, 'default');
    assert.equal(presented.accessibilityRole, 'radio');
  });

  it('uses mint fill, accent border, and a filled indicator when selected', () => {
    const presented = presentSelectableOptionAppearance(true);

    assert.equal(presented.selected, true);
    assert.equal(presented.indicator, 'filled');
    assert.equal(presented.surfaceToken, 'mintSoft');
    assert.equal(presented.borderToken, 'accent');
    assert.equal(presented.titleEmphasis, 'strong');
    assert.notEqual(presented.surfaceToken, 'surface');
    assert.notEqual(presented.borderToken, 'border');
  });
});
