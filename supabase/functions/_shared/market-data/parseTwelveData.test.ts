import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ProviderSyncError } from './types.ts';
import {
  assertLatestNotObviouslyStale,
  mapTwelveDataHttpError,
  parseTwelveDataFundsCatalog,
  parseTwelveDataQuote,
  parseTwelveDataTimeSeries,
} from './parseTwelveData.ts';

const validQuote = {
  symbol: '0P00018V9L',
  name: 'KLP AksjeGlobal Indeks V',
  exchange: 'ISE',
  currency: 'NOK',
  datetime: '2026-09-03',
  timestamp: 1788418800,
  close: '3935.98000',
};

const validHistory = {
  meta: {
    symbol: '0P00018V9L',
    interval: '1day',
    currency: 'NOK',
    exchange: 'ISE',
    type: 'Mutual Fund',
  },
  values: [
    { datetime: '2026-09-03', close: '3935.98000' },
    { datetime: '2026-09-02', close: '3920.10000' },
  ],
  status: 'ok',
};

const validCatalog = {
  result: {
    count: 1,
    list: [
      {
        symbol: '0P00018V9L',
        name: 'KLP AksjeGlobal Indeks V',
        country: 'Ireland',
        currency: 'NOK',
        exchange: 'ISE',
        type: 'Mutual Fund',
        isin: 'request_access_via_add_ons',
      },
    ],
  },
  status: 'ok',
};

test('parses a valid Twelve Data NAV quote in NOK', () => {
  const history = parseTwelveDataQuote(validQuote, 'NOK');
  assert.equal(history.providerInstrumentId, '0P00018V9L');
  assert.equal(history.currency, 'NOK');
  assert.equal(history.observations[0].price, '3935.98');
  assert.equal(history.observations[0].priceDate, '2026-09-03');
  assert.equal(history.observations[0].priceType, 'nav');
});

test('parses a valid Twelve Data history series oldest-first', () => {
  const history = parseTwelveDataTimeSeries(validHistory, 'NOK');
  assert.equal(history.observations.length, 2);
  assert.equal(history.observations[0].priceDate, '2026-09-02');
  assert.equal(history.observations[1].priceDate, '2026-09-03');
  assert.equal(history.observations[1].price, '3935.98');
});

test('resolves catalog identity by ISIN query without requiring echoed ISIN', () => {
  const resolved = parseTwelveDataFundsCatalog(validCatalog, 'NO0010776040', 'NOK');
  assert.equal(resolved.providerInstrumentId, '0P00018V9L');
  assert.equal(resolved.currency, 'NOK');
  assert.equal(resolved.isin, null);
});

test('rejects a missing quote price', () => {
  assert.throws(
    () => parseTwelveDataQuote({ ...validQuote, close: null }, 'NOK'),
    (error: unknown) => error instanceof ProviderSyncError && error.code === 'missing_price',
  );
});

test('rejects a malformed quote date', () => {
  assert.throws(
    () => parseTwelveDataQuote({ ...validQuote, datetime: '03/09/2026' }, 'NOK'),
    (error: unknown) => error instanceof ProviderSyncError && error.code === 'malformed',
  );
});

test('rejects a currency mismatch instead of converting FX', () => {
  assert.throws(
    () => parseTwelveDataQuote(validQuote, 'USD'),
    (error: unknown) => error instanceof ProviderSyncError && error.code === 'currency_mismatch',
  );
});

test('rejects empty history', () => {
  assert.throws(
    () => parseTwelveDataTimeSeries({ ...validHistory, values: [] }, 'NOK'),
    (error: unknown) => error instanceof ProviderSyncError && error.code === 'missing_price',
  );
});

test('maps unauthorized and rate-limit errors', () => {
  const unauthorized = mapTwelveDataHttpError(401, { message: 'apikey is invalid or missing' });
  assert.equal(unauthorized.code, 'unauthorized');
  const limited = mapTwelveDataHttpError(429, { message: 'run out of credits' });
  assert.equal(limited.code, 'rate_limited');
});

test('maps a plan-gated mutual-fund 404 as unavailable', () => {
  const error = mapTwelveDataHttpError(404, {
    message: 'This symbol is available starting with the Grow or Venture plan. Consider upgrading now at https://twelvedata.com/pricing',
  });
  assert.equal(error.code, 'unavailable');
});

test('rejects an obviously stale latest NAV', () => {
  assert.throws(
    () => assertLatestNotObviouslyStale('2026-01-01', new Date('2026-09-05T12:00:00Z')),
    (error: unknown) => error instanceof ProviderSyncError && error.code === 'stale',
  );
});

test('rejects an empty catalog list', () => {
  assert.throws(
    () =>
      parseTwelveDataFundsCatalog(
        { result: { count: 0, list: [] }, status: 'ok' },
        'NO0010776040',
        'NOK',
      ),
    (error: unknown) => error instanceof ProviderSyncError && error.code === 'unknown_instrument',
  );
});

test('rejects a catalog ISIN that does not match the requested ISIN', () => {
  assert.throws(
    () =>
      parseTwelveDataFundsCatalog(
        {
          result: {
            count: 1,
            list: [
              {
                symbol: '0P00018V9L',
                name: 'Wrong fund',
                currency: 'NOK',
                isin: 'NO0010000000',
              },
            ],
          },
          status: 'ok',
        },
        'NO0010776040',
        'NOK',
      ),
    (error: unknown) => error instanceof ProviderSyncError && error.code === 'unknown_instrument',
  );
});

test('maps a provider error payload without inventing a price', () => {
  assert.throws(
    () => parseTwelveDataQuote({ code: 401, message: 'apikey is invalid or missing', status: 'error' }, 'NOK'),
    (error: unknown) => error instanceof ProviderSyncError && error.code === 'unauthorized',
  );
});
