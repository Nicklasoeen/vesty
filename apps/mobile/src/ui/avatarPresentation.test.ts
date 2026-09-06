import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resolveAvatarContent, splitAvatarStack } from './avatarPresentation.ts';

describe('resolveAvatarContent', () => {
  it('uses a profile photo when one is available', () => {
    assert.equal(resolveAvatarContent({ imageSource: { uri: 'https://example.test/a.jpg' } }), 'image');
  });

  it('falls back to initials when the photo is missing', () => {
    assert.equal(resolveAvatarContent({}), 'initials');
  });

  it('falls back to initials when the photo fails to load', () => {
    const imageSource = { uri: 'https://example.test/broken.jpg' };
    assert.equal(resolveAvatarContent({ imageSource, failedSource: imageSource }), 'initials');
  });

  it('never treats overflow chips as photos', () => {
    assert.equal(
      resolveAvatarContent({ imageSource: { uri: 'https://example.test/a.jpg' }, overflow: true }),
      'initials',
    );
  });
});

describe('splitAvatarStack', () => {
  it('shows three faces and a +N overflow', () => {
    const people = ['a', 'b', 'c', 'd', 'e'];
    assert.deepEqual(splitAvatarStack(people), { visible: ['a', 'b', 'c'], overflowCount: 2 });
  });

  it('hides the overflow chip when everyone fits', () => {
    assert.deepEqual(splitAvatarStack(['a', 'b']), { visible: ['a', 'b'], overflowCount: 0 });
  });
});
