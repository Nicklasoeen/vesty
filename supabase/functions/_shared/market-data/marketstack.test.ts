import assert from 'node:assert/strict';
import test from 'node:test';

import { fetchHistory, fetchLatest } from './marketstack.ts';
import { ProviderSyncError } from './types.ts';

const fixtureKey = 'test-key-not-a-secret';

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const latestPayload = {
  pagination: { limit: 100, offset: 0, count: 1, total: 1 },
  data: [
    {
      symbol: 'SXRV.DE',
      date: '2026-09-03T00:00:00+0000',
      close: 1458,
      adj_close: 1458,
      price_currency: null,
      exchange: 'XETR',
      split_factor: 1,
      dividend: 0,
    },
  ],
};

test('fetchLatest persists only a validated allowlisted EOD close', async () => {
  const result = await fetchLatest('SXRV.DE', {
    apiKey: fixtureKey,
    expectedCurrency: 'EUR',
    now: new Date('2026-09-05T12:00:00Z'),
    fetchImpl: async () => jsonResponse(200, latestPayload),
  });

  assert.equal(result.providerInstrumentId, 'SXRV.DE');
  assert.equal(result.observation.currency, 'EUR');
  assert.equal(result.observation.price, '1458.0');
  assert.equal(result.observation.priceType, 'close');
});

test('fetchHistory returns actual bars without interpolation', async () => {
  const result = await fetchHistory('IS3N.DE', {
    apiKey: fixtureKey,
    expectedCurrency: 'EUR',
    now: new Date('2026-09-05T12:00:00Z'),
    fetchImpl: async () =>
      jsonResponse(200, {
        pagination: { limit: 1000, offset: 0, count: 2, total: 2 },
        data: [
          {
            symbol: 'IS3N.DE',
            date: '2026-09-02T00:00:00+0000',
            close: 47.2,
            price_currency: null,
            exchange: 'XETR',
          },
          {
            symbol: 'IS3N.DE',
            date: '2026-09-03T00:00:00+0000',
            close: 47.534,
            price_currency: null,
            exchange: 'XETR',
          },
        ],
      }),
  });

  assert.equal(result.observations.length, 2);
  assert.equal(result.observations[0].priceDate, '2026-09-02');
  assert.equal(result.observations[1].price, '47.534');
});

test('missing API key is unauthorized and writes nothing', async () => {
  await assert.rejects(
    () => fetchLatest('VWCE.DE', { expectedCurrency: 'EUR' }),
    (error: unknown) => error instanceof ProviderSyncError && error.code === 'unauthorized',
  );
});

test('refuses unsupported symbols before calling Marketstack', async () => {
  let called = false;
  await assert.rejects(
    () =>
      fetchLatest('EQNR.XOSL', {
        apiKey: fixtureKey,
        expectedCurrency: 'NOK',
        fetchImpl: async () => {
          called = true;
          return jsonResponse(200, { data: [] });
        },
      }),
    (error: unknown) => error instanceof ProviderSyncError && error.code === 'unknown_instrument',
  );
  assert.equal(called, false);
});
