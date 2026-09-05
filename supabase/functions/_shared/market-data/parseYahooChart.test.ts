import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ProviderSyncError } from './types.ts';
import { decimalStringFromNumber, priceDateFromUnix } from './validate.ts';
import { latestFromHistory, parseYahooChartResponse } from './parseYahooChart.ts';

const validChart = {
  chart: {
    result: [
      {
        meta: {
          currency: 'NOK',
          symbol: '0P00018V9L.IR',
          instrumentType: 'MUTUALFUND',
          gmtoffset: 0,
        },
        timestamp: [1788418800],
        indicators: {
          quote: [{ close: [3935.9794921875] }],
        },
      },
    ],
    error: null,
  },
};

test('parses a valid Yahoo NAV bar in NOK', () => {
  const history = parseYahooChartResponse(validChart, 'NOK');
  assert.equal(history.currency, 'NOK');
  assert.equal(history.providerInstrumentId, '0P00018V9L.IR');
  assert.equal(history.observations.length, 1);
  assert.equal(history.observations[0].priceType, 'nav');
  assert.equal(history.observations[0].priceDate, priceDateFromUnix(1788418800, 0));
  assert.equal(history.observations[0].price, decimalStringFromNumber(3935.9794921875));
  assert.equal(latestFromHistory(history).price, history.observations[0].price);
});

test('rejects a missing price series', () => {
  assert.throws(
    () =>
      parseYahooChartResponse(
        {
          chart: {
            result: [
              {
                meta: { currency: 'NOK', symbol: '0P00018V9L.IR' },
                timestamp: [1788418800],
                indicators: { quote: [{ close: [null] }] },
              },
            ],
          },
        },
        'NOK',
      ),
    (error: unknown) => error instanceof ProviderSyncError && error.code === 'missing_price',
  );
});

test('rejects a currency mismatch instead of converting FX', () => {
  assert.throws(
    () => parseYahooChartResponse(validChart, 'USD'),
    (error: unknown) => error instanceof ProviderSyncError && error.code === 'currency_mismatch',
  );
});

test('rejects a missing instrument result', () => {
  assert.throws(
    () => parseYahooChartResponse({ chart: { result: [], error: null } }, 'NOK'),
    (error: unknown) => error instanceof ProviderSyncError && error.code === 'unknown_instrument',
  );
});

test('rejects a malformed date unix timestamp', () => {
  assert.throws(() => priceDateFromUnix(Number.NaN), /malformed_date/);
});

test('rejects a non-positive price', () => {
  assert.throws(() => decimalStringFromNumber(0), /invalid_price/);
  assert.throws(() => decimalStringFromNumber(-1), /invalid_price/);
  assert.throws(() => decimalStringFromNumber(Number.NaN), /invalid_price/);
});
