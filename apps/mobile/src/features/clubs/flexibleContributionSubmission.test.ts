import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  presentFlexibleContributionSubmitLabel,
  runFlexibleContributionSubmission,
} from './flexibleContributionSubmission.ts';

function deferred(): {
  promise: Promise<void>;
  resolve: () => void;
} {
  let resolvePromise: (() => void) | undefined;
  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve;
  });

  return {
    promise,
    resolve: () => resolvePromise?.(),
  };
}

describe('Flexible contribution submission', () => {
  it('returns the button to idle after success and permits another save', async () => {
    let isSubmitting = false;
    let error: string | null = null;
    let saveCount = 0;
    const firstSave = deferred();
    const submit = async () => {
      saveCount += 1;
      if (saveCount === 1) {
        await firstSave.promise;
      }
    };
    const callbacks = {
      onSubmittingChange: (next: boolean) => {
        isSubmitting = next;
      },
      onErrorChange: (next: string | null) => {
        error = next;
      },
    };

    const pending = runFlexibleContributionSubmission(200000, submit, callbacks);

    assert.equal(isSubmitting, true);
    assert.equal(presentFlexibleContributionSubmitLabel(isSubmitting, false, 'Set amount'), 'Saving…');

    firstSave.resolve();
    await pending;

    assert.equal(isSubmitting, false);
    assert.equal(error, null);
    assert.equal(presentFlexibleContributionSubmitLabel(isSubmitting, false, 'Set amount'), 'Set amount');

    await runFlexibleContributionSubmission(250000, submit, callbacks);

    assert.equal(saveCount, 2);
    assert.equal(isSubmitting, false);
  });

  it('returns to idle and preserves the error after a failed save', async () => {
    let isSubmitting = false;
    let error: string | null = null;

    await runFlexibleContributionSubmission(
      200000,
      async () => {
        throw new Error('Local save failed');
      },
      {
        onSubmittingChange: (next) => {
          isSubmitting = next;
        },
        onErrorChange: (next) => {
          error = next;
        },
      },
    );

    assert.equal(isSubmitting, false);
    assert.equal(error, 'Local save failed');
    assert.equal(presentFlexibleContributionSubmitLabel(isSubmitting, false, 'Set amount'), 'Set amount');
  });
});
