import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ProviderSyncError } from './types.ts';
import { fetchHistory, fetchLatest, resolveInstrument } from './twelveData.ts';

const fixtureKey = 'test-key-not-a-secret';

const validQuote = {
  symbol: '0P00018V9L',
  name: 'KLP AksjeGlobal Indeks V',
  currency: 'NOK',
  datetime: '2026-09-03',
  timestamp: 1788418800,
  close: '3935.98000',
};

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('fetchLatest persists only a validated NOK quote', async () => {
  const result = await fetchLatest('0P00018V9L', {
    apiKey: fixtureKey,
    expectedCurrency: 'NOK',
    now: new Date('2026-09-05T12:00:00Z'),
    fetchImpl: async () => jsonResponse(200, validQuote),
  });

  assert.equal(result.providerInstrumentId, '0P00018V9L');
  assert.equal(result.observation.currency, 'NOK');
  assert.equal(result.observation.price, '3935.98');
  assert.equal(result.observation.priceDate, '2026-09-03');
});

test('fetchHistory returns actual bars without interpolation', async () => {
  const result = await fetchHistory('0P00018V9L', {
    apiKey: fixtureKey,
    expectedCurrency: 'NOK',
    fetchImpl: async () =>
      jsonResponse(200, {
        meta: { symbol: '0P00018V9L', currency: 'NOK', interval: '1day' },
        values: [
          { datetime: '2026-09-03', close: '3935.98000' },
          { datetime: '2026-09-02', close: '3920.10000' },
        ],
        status: 'ok',
      }),
  });

  assert.equal(result.observations.length, 2);
  assert.equal(result.observations[0].priceDate, '2026-09-02');
});

test('missing API key is unauthorized and writes nothing', async () => {
  await assert.rejects(
    () => fetchLatest('0P00018V9L', { expectedCurrency: 'NOK' }),
    (error: unknown) => error instanceof ProviderSyncError && error.code === 'unauthorized',
  );
});

test('maps 401 without creating an observation', async () => {
  await assert.rejects(
    () =>
      fetchLatest('0P00018V9L', {
        apiKey: fixtureKey,
        expectedCurrency: 'NOK',
        fetchImpl: async () =>
          jsonResponse(401, { code: 401, message: 'apikey is invalid or missing', status: 'error' }),
      }),
    (error: unknown) => error instanceof ProviderSyncError && error.code === 'unauthorized',
  );
});

test('maps 429 rate limits', async () => {
  await assert.rejects(
    () =>
      fetchLatest('0P00018V9L', {
        apiKey: fixtureKey,
        expectedCurrency: 'NOK',
        fetchImpl: async () => jsonResponse(429, { code: 429, message: 'run out of credits', status: 'error' }),
      }),
    (error: unknown) => error instanceof ProviderSyncError && error.code === 'rate_limited',
  );
});

test('maps request timeouts', async () => {
  await assert.rejects(
    () =>
      fetchLatest('0P00018V9L', {
        apiKey: fixtureKey,
        expectedCurrency: 'NOK',
        fetchImpl: async () => {
          const error = new Error('The operation was aborted due to timeout');
          error.name = 'TimeoutError';
          throw error;
        },
      }),
    (error: unknown) => error instanceof ProviderSyncError && error.code === 'timeout',
  );
});

test('rejects a quote for a different symbol', async () => {
  await assert.rejects(
    () =>
      fetchLatest('0P00018V9L', {
        apiKey: fixtureKey,
        expectedCurrency: 'NOK',
        now: new Date('2026-09-05T12:00:00Z'),
        fetchImpl: async () => jsonResponse(200, { ...validQuote, symbol: '0P00000MVB' }),
      }),
    (error: unknown) => error instanceof ProviderSyncError && error.code === 'unknown_instrument',
  );
});

test('resolveInstrument uses ISIN catalog identity', async () => {
  const resolved = await resolveInstrument('NO0010776040', {
    apiKey: fixtureKey,
    expectedCurrency: 'NOK',
    fetchImpl: async () =>
      jsonResponse(200, {
        result: {
          count: 1,
          list: [
            {
              symbol: '0P00018V9L',
              name: 'KLP AksjeGlobal Indeks V',
              currency: 'NOK',
              isin: 'request_access_via_add_ons',
            },
          ],
        },
        status: 'ok',
      }),
  });

  assert.equal(resolved.providerInstrumentId, '0P00018V9L');
  assert.equal(resolved.isin, null);
});
