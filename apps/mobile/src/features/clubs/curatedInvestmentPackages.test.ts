import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CORE_V1_TARGETS,
  CURATED_INVESTMENT_PACKAGES,
  CURATED_PACKAGE_IDS,
  compactAllocationPreview,
  getCoreV1Target,
  getCuratedPackage,
  isCuratedPackageId,
  packageAllocationBpsTotal,
} from './curatedInvestmentPackages.ts';

test('ships exactly three active V1 packages with unique ids', () => {
  assert.equal(CURATED_INVESTMENT_PACKAGES.length, 3);
  assert.deepEqual(
    CURATED_INVESTMENT_PACKAGES.map((item) => item.id),
    [...CURATED_PACKAGE_IDS],
  );
  assert.equal(new Set(CURATED_PACKAGE_IDS).size, 3);
});

test('every package totals exactly 10000 basis points', () => {
  for (const item of CURATED_INVESTMENT_PACKAGES) {
    assert.equal(packageAllocationBpsTotal(item), 10000, item.id);
    const positions = item.allocations.map((allocation) => allocation.position);
    assert.deepEqual(positions, [...positions].sort((left, right) => left - right));
    assert.equal(new Set(positions).size, positions.length);
    assert.equal(new Set(item.allocations.map((allocation) => allocation.targetId)).size, item.allocations.length);
  }
});

test('every allocation references a known CORE V1 target', () => {
  const targetIds = new Set(CORE_V1_TARGETS.map((target) => target.id));
  assert.equal(targetIds.size, 5);
  for (const item of CURATED_INVESTMENT_PACKAGES) {
    for (const allocation of item.allocations) {
      assert.equal(getCoreV1Target(allocation.targetId).id, allocation.targetId);
      assert.ok(targetIds.has(allocation.targetId));
    }
  }
});

test('package lookup rejects unknown ids', () => {
  assert.equal(isCuratedPackageId('world_mix'), true);
  assert.equal(isCuratedPackageId('spotlight'), false);
  assert.equal(isCuratedPackageId('World Mix'), false);
  assert.throws(() => getCuratedPackage('spotlight' as 'world_mix'), /Unknown curated package/);
});

test('World Mix compact preview stays beginner-facing', () => {
  assert.equal(
    compactAllocationPreview(getCuratedPackage('world_mix')),
    '60% World · 25% Europe · 15% Emerging Markets',
  );
});
