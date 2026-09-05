import assert from 'node:assert/strict';
import test from 'node:test';

import { fetchHistoryEurNok, fetchLatestEurNok } from './norgesBank.ts';
import { FxSyncError } from './types.ts';

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const payload = {
  data: {
    dataSets: [
      {
        series: {
          '0:0:0:0': {
            observations: {
              '0': ['11.80'],
              '1': ['11.81'],
            },
          },
        },
      },
    ],
    structure: {
      dimensions: {
        series: [
          { values: [{ id: 'B' }] },
          { values: [{ id: 'EUR' }] },
          { values: [{ id: 'NOK' }] },
          { values: [{ id: 'SP' }] },
        ],
        observation: [{ values: [{ id: '2026-09-03' }, { id: '2026-09-04' }] }],
      },
      attributes: {
        series: [
          { values: [{ id: '4' }] },
          { values: [{ id: 'false' }] },
          { values: [{ id: '0' }] },
          { values: [{ id: 'C' }] },
        ],
      },
    },
  },
};

test('fetchLatestEurNok persists only validated official EUR/NOK prints', async () => {
  const rows = await fetchLatestEurNok({
    now: new Date('2026-09-05T12:00:00Z'),
    fetchImpl: async (input) => {
      const url = new URL(String(input));
      assert.equal(url.pathname, '/api/data/EXR/B.EUR.NOK.SP');
      assert.equal(url.searchParams.get('format'), 'sdmx-json');
      return jsonResponse(200, payload);
    },
  });

  assert.equal(rows.length, 2);
  assert.equal(rows[1].rate, '11.81');
  assert.equal(rows[1].baseCurrency, 'EUR');
  assert.equal(rows[1].quoteCurrency, 'NOK');
});

test('fetchHistoryEurNok requests a bounded window and does not interpolate', async () => {
  let requested: URL | null = null;
  const rows = await fetchHistoryEurNok({
    now: new Date('2026-09-05T12:00:00Z'),
    fetchImpl: async (input) => {
      requested = new URL(String(input));
      return jsonResponse(200, payload);
    },
  });

  assert.ok(requested);
  assert.equal(requested.searchParams.get('startPeriod'), '2025-09-06');
  assert.equal(requested.searchParams.get('endPeriod'), '2026-09-05');
  assert.equal(rows.length, 2);
});

test('maps a Norges Bank HTTP failure without inventing a rate', async () => {
  await assert.rejects(
    () =>
      fetchLatestEurNok({
        now: new Date('2026-09-05T12:00:00Z'),
        fetchImpl: async () => jsonResponse(503, { error: 'unavailable' }),
      }),
    (error: unknown) => error instanceof FxSyncError && error.code === 'unavailable',
  );
});
