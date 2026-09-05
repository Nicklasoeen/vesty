import assert from 'node:assert/strict';
import { test } from 'node:test';

import { classifyNavFreshness } from './freshness.ts';

test('missing NAV is unavailable', () => {
  assert.equal(classifyNavFreshness(null).status, 'unavailable');
});

test('weekday NAV from yesterday is fresh', () => {
  const result = classifyNavFreshness('2026-09-04', new Date('2026-09-05T12:00:00Z'));
  assert.equal(result.status, 'fresh');
  assert.equal(result.ageDays, 1);
});

test('Friday NAV stays fresh over the weekend', () => {
  const saturday = classifyNavFreshness('2026-09-04', new Date('2026-09-05T12:00:00Z'));
  const sunday = classifyNavFreshness('2026-09-04', new Date('2026-09-06T12:00:00Z'));
  assert.equal(saturday.status, 'fresh');
  assert.equal(sunday.status, 'fresh');
});

test('NAV older than the weekday plus holiday buffer is stale', () => {
  const result = classifyNavFreshness('2026-08-20', new Date('2026-09-05T12:00:00Z'));
  assert.equal(result.status, 'stale');
});
