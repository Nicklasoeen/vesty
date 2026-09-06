import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { typography } from './tokens.ts';

describe('typography roles', () => {
  it('keeps display strongest and stats quieter than the gain line', () => {
    assert.equal(typography.display.fontSize, 34);
    assert.ok((typography.display.fontSize ?? 0) > (typography.value.fontSize ?? 0));
    assert.ok((typography.value.fontSize ?? 0) > (typography.statValue.fontSize ?? 0));
    assert.ok((typography.statValue.fontSize ?? 0) > (typography.statLabel.fontSize ?? 0));
  });

  it('separates card eyebrows from supporting copy without uppercase', () => {
    assert.equal(typography.label.fontSize, 12);
    assert.equal(typography.supporting.fontSize, 12);
    assert.equal(typography.label.fontWeight, '500');
    assert.equal(typography.supporting.fontWeight, '400');
    assert.notEqual(typography.label.textTransform, 'uppercase');
    assert.equal(typography.eyebrow.textTransform, 'uppercase');
  });

  it('keeps section titles stronger than labels', () => {
    assert.ok((typography.subtitle.fontSize ?? 0) > (typography.label.fontSize ?? 0));
    assert.ok((typography.title.fontSize ?? 0) > (typography.subtitle.fontSize ?? 0));
  });
});
