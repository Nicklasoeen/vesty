import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  isDevGalleryPath,
  shouldMountAuthenticatedAppProviders,
} from './presentRootSessionIsolation.ts';

describe('root session isolation', () => {
  it('keeps authenticated providers off the development gallery', () => {
    assert.equal(isDevGalleryPath('/dev/group-modes-gallery'), true);
    assert.equal(isDevGalleryPath('/dev/investment-day-handoff'), true);
    assert.equal(
      shouldMountAuthenticatedAppProviders({
        isDev: true,
        pathname: '/dev/group-modes-gallery',
      }),
      false,
    );
    assert.equal(
      shouldMountAuthenticatedAppProviders({
        isDev: true,
        pathname: '/dev/group-modes-gallery?scenario=review',
      }),
      false,
    );
  });

  it('mounts authenticated providers for the ordinary app in development', () => {
    assert.equal(shouldMountAuthenticatedAppProviders({ isDev: true, pathname: '/home' }), true);
    assert.equal(shouldMountAuthenticatedAppProviders({ isDev: true, pathname: '/clubs/new' }), true);
    assert.equal(shouldMountAuthenticatedAppProviders({ isDev: true, pathname: '/' }), true);
  });

  it('does not mount authenticated providers until the pathname is known in development', () => {
    assert.equal(shouldMountAuthenticatedAppProviders({ isDev: true, pathname: null }), false);
    assert.equal(shouldMountAuthenticatedAppProviders({ isDev: true, pathname: undefined }), false);
  });

  it('keeps a local auth context on /dev so leftover app layouts cannot crash', () => {
    assert.equal(
      shouldMountAuthenticatedAppProviders({
        isDev: true,
        pathname: '/dev/group-modes-gallery',
      }),
      false,
    );
  });

  it('always mounts authenticated providers when __DEV__ is false', () => {
    assert.equal(
      shouldMountAuthenticatedAppProviders({
        isDev: false,
        pathname: '/dev/group-modes-gallery',
      }),
      true,
    );
  });
});
