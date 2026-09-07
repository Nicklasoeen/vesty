import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { presentAuthBootGate, restoreAuthSession } from './restoreAuthSession.ts';

describe('presentAuthBootGate', () => {
  it('shows the Vesty spinner only while initialization is in flight', () => {
    const gate = presentAuthBootGate({
      isInitializing: true,
      profileError: null,
      hasSession: false,
      profileLoading: true,
      profileLoadError: null,
      hasProfile: false,
    });

    assert.equal(gate.blocking, true);
    assert.equal(gate.appearance, 'spinner');
    assert.equal(gate.error, null);
  });

  it('keeps the spinner while a session exists but the profile has not resolved', () => {
    const gate = presentAuthBootGate({
      isInitializing: false,
      profileError: null,
      hasSession: true,
      profileLoading: true,
      profileLoadError: null,
      hasProfile: false,
    });

    assert.equal(gate.blocking, true);
    assert.equal(gate.appearance, 'spinner');
  });

  it('surfaces a retryable error instead of spinning after a restore failure', () => {
    const gate = presentAuthBootGate({
      isInitializing: false,
      profileError: 'Unable to reach Vesty right now',
      hasSession: false,
      profileLoading: false,
      profileLoadError: null,
      hasProfile: false,
    });

    assert.equal(gate.blocking, true);
    assert.equal(gate.appearance, 'error');
    assert.equal(gate.error, 'Unable to reach Vesty right now');
  });

  it('passes through to the app when auth and profile have settled', () => {
    const gate = presentAuthBootGate({
      isInitializing: false,
      profileError: null,
      hasSession: true,
      profileLoading: false,
      profileLoadError: null,
      hasProfile: true,
    });

    assert.equal(gate.blocking, false);
    assert.equal(gate.appearance, 'pass');
  });
});

describe('restoreAuthSession', () => {
  it('finishes ready when getSession and apply succeed', async () => {
    const result = await restoreAuthSession({
      getSession: async () => ({ data: { session: { user: { id: 'u1' } } }, error: null }),
      applySession: async () => undefined,
    });

    assert.deepEqual(result, { status: 'ready' });
  });

  it('still settles after getSession rejects, instead of leaving startup hanging', async () => {
    const result = await restoreAuthSession({
      getSession: async () => {
        throw new Error('Network request failed');
      },
      applySession: async () => {
        throw new Error('should not apply');
      },
    });

    assert.deepEqual(result, {
      status: 'failed',
      message: 'Unable to reach Vesty right now',
    });
  });

  it('settles when applySession throws', async () => {
    const result = await restoreAuthSession({
      getSession: async () => ({ data: { session: { user: { id: 'u1' } } }, error: null }),
      applySession: async () => {
        throw new Error('bootstrap failed');
      },
    });

    assert.equal(result.status, 'failed');
  });
});
