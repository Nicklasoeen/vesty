import assert from 'node:assert/strict';
import test from 'node:test';

import { CORE_V1_TARGET_IDS } from '../clubs/curatedInvestmentPackages.ts';

import { presentReportedAmountLabel } from './amountProvenance.ts';
import {
  buildAsPlannedPurchaseLines,
  buildWithChangesPurchaseLines,
  canSubmitWithChanges,
  CLIENT_REPORT_ID_PATTERN,
  clientReportIdForCycle,
  createClientReportId,
  isInvestmentDayClosed,
  parseReportedPurchaseKronerInput,
  sumReportedAmountMinor,
} from './investmentDayReport.ts';
import { parseOptionalExecutionPriceInput, parseOptionalQuantityInput } from './investmentDayReporting.ts';
import {
  presentCompletedHeadline,
  presentReportChoices,
  presentReportedVersusPlanned,
} from './presentInvestmentDayReport.ts';

const WORLD_MIX_IDS = [
  CORE_V1_TARGET_IDS.vwce,
  CORE_V1_TARGET_IDS.eunk,
  CORE_V1_TARGET_IDS.is3n,
] as const;

test('closed outcomes include skipped and failed, not only confirmed', () => {
  assert.equal(isInvestmentDayClosed('confirmed'), true);
  assert.equal(isInvestmentDayClosed('skipped'), true);
  assert.equal(isInvestmentDayClosed('failed'), true);
  assert.equal(isInvestmentDayClosed('expected'), false);
});

test('zero or empty kroner input omits a purchase instead of using the plan', () => {
  assert.equal(parseReportedPurchaseKronerInput('').amountMinor, 0);
  assert.equal(parseReportedPurchaseKronerInput('0').amountMinor, 0);
  assert.equal(parseReportedPurchaseKronerInput('1400').amountMinor, 140000);
  assert.equal(parseReportedPurchaseKronerInput('abc').amountMinor, null);
});

test('with_changes of 1400 kr on a 2000 kr plan omits a zero target', () => {
  const amounts = {
    [CORE_V1_TARGET_IDS.vwce]: parseReportedPurchaseKronerInput('800'),
    [CORE_V1_TARGET_IDS.eunk]: parseReportedPurchaseKronerInput('600'),
    [CORE_V1_TARGET_IDS.is3n]: parseReportedPurchaseKronerInput('0'),
  };
  const emptyQty = {
    [CORE_V1_TARGET_IDS.vwce]: parseOptionalQuantityInput(''),
    [CORE_V1_TARGET_IDS.eunk]: parseOptionalQuantityInput(''),
    [CORE_V1_TARGET_IDS.is3n]: parseOptionalQuantityInput(''),
  };
  const emptyPrice = {
    [CORE_V1_TARGET_IDS.vwce]: parseOptionalExecutionPriceInput(''),
    [CORE_V1_TARGET_IDS.eunk]: parseOptionalExecutionPriceInput(''),
    [CORE_V1_TARGET_IDS.is3n]: parseOptionalExecutionPriceInput(''),
  };

  assert.equal(sumReportedAmountMinor(amounts, WORLD_MIX_IDS), 140000);
  assert.equal(canSubmitWithChanges(WORLD_MIX_IDS, amounts, emptyQty, emptyPrice), true);
  assert.deepEqual(
    buildWithChangesPurchaseLines(WORLD_MIX_IDS, amounts, emptyQty, emptyPrice),
    [
      { investmentTargetId: CORE_V1_TARGET_IDS.vwce, amountMinor: 80000 },
      { investmentTargetId: CORE_V1_TARGET_IDS.eunk, amountMinor: 60000 },
    ],
  );
});

test('as_planned lines never include amount_minor even when quantity is present', () => {
  const quantity = {
    [CORE_V1_TARGET_IDS.vwce]: parseOptionalQuantityInput('0.5'),
    [CORE_V1_TARGET_IDS.eunk]: parseOptionalQuantityInput(''),
    [CORE_V1_TARGET_IDS.is3n]: parseOptionalQuantityInput(''),
  };
  const prices = {
    [CORE_V1_TARGET_IDS.vwce]: parseOptionalExecutionPriceInput('167.54'),
    [CORE_V1_TARGET_IDS.eunk]: parseOptionalExecutionPriceInput(''),
    [CORE_V1_TARGET_IDS.is3n]: parseOptionalExecutionPriceInput(''),
  };

  assert.deepEqual(buildAsPlannedPurchaseLines(WORLD_MIX_IDS, quantity, prices), [
    {
      investmentTargetId: CORE_V1_TARGET_IDS.vwce,
      quantity: '0.5',
      executionUnitPrice: '167.54',
    },
  ]);
});

test('report choices put planned attestation first and keep pending off the server', () => {
  const choices = presentReportChoices(200000, 3);
  assert.equal(choices[0]?.choice, 'as_planned');
  assert.match(choices[0]?.description ?? '', /2\s000 kr/);
  assert.equal(choices[2]?.choice, 'pending');
  assert.match(choices[2]?.description ?? '', /Nothing is saved/i);
  assert.equal(presentCompletedHeadline('skipped'), 'You skipped this Investment Day');
  assert.equal(presentReportedVersusPlanned(140000, 200000), 'Reported 1\u00a0400 kr · Planned 2\u00a0000 kr');
});

test('legacy provenance is labelled as planned, not invested', () => {
  assert.equal(presentReportedAmountLabel(120000, 'legacy_plan_assumed'), '1\u00a0200 kr planned (assumed)');
  assert.equal(presentReportedAmountLabel(120000, 'member_attested_plan'), '1\u00a0200 kr attested plan');
  assert.equal(presentReportedAmountLabel(140000, 'member_reported_actual'), '1\u00a0400 kr reported');
});

test('mixed and unknown provenance are not labelled reported', () => {
  assert.equal(presentReportedAmountLabel(200000, 'mixed'), '2\u00a0000 kr mixed basis');
  assert.equal(presentReportedAmountLabel(200000, null), '2\u00a0000 kr unverified');
  assert.equal(presentReportedAmountLabel(200000, undefined), '2\u00a0000 kr unverified');
  assert.equal(presentReportedAmountLabel(200000, 'unknown_source'), '2\u00a0000 kr unverified');
  assert.equal(/reported/i.test(presentReportedAmountLabel(200000, 'mixed')), false);
  assert.equal(/reported/i.test(presentReportedAmountLabel(200000, null)), false);
});

test('client report ids are UUID v4 and reused for the same cycle', () => {
  const first = createClientReportId();
  const second = createClientReportId();
  assert.match(first, CLIENT_REPORT_ID_PATTERN);
  assert.match(second, CLIENT_REPORT_ID_PATTERN);
  assert.notEqual(first, second);

  const store: Record<string, string> = {};
  const cycleId = 'cycle-1';
  const retry = clientReportIdForCycle(store, cycleId);
  assert.match(retry, CLIENT_REPORT_ID_PATTERN);
  assert.equal(clientReportIdForCycle(store, cycleId), retry);
  assert.notEqual(clientReportIdForCycle(store, 'cycle-2'), retry);
});
