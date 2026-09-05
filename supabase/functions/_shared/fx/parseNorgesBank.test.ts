import assert from 'node:assert/strict';
import test from 'node:test';

import { parseNorgesBankEurNok } from './parseNorgesBank.ts';
import { FxSyncError } from './types.ts';

function eurNokPayload(overrides?: {
  base?: string;
  quote?: string;
  unitMult?: string;
  observations?: Record<string, [string]>;
  dates?: string[];
}) {
  const dates = overrides?.dates ?? ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04'];
  const observations = overrides?.observations ?? {
    '0': ['10.8185'],
    '1': ['10.809'],
    '2': ['10.8063'],
    '3': ['10.8035'],
  };

  return {
    data: {
      dataSets: [{ series: { '0:0:0:0': { observations } } }],
      structure: {
        dimensions: {
          series: [
            { values: [{ id: 'B' }] },
            { values: [{ id: overrides?.base ?? 'EUR' }] },
            { values: [{ id: overrides?.quote ?? 'NOK' }] },
            { values: [{ id: 'SP' }] },
          ],
          observation: [{ values: dates.map((id) => ({ id })) }],
        },
        attributes: {
          series: [
            { values: [{ id: '4' }] },
            { values: [{ id: 'false' }] },
            { values: [{ id: overrides?.unitMult ?? '0' }] },
            { values: [{ id: 'C' }] },
          ],
        },
      },
    },
  };
}

test('parses official EUR/NOK middle rates without inverting', () => {
  const rows = parseNorgesBankEurNok(eurNokPayload(), new Date('2026-09-05T12:00:00Z'));

  assert.equal(rows.length, 4);
  assert.deepEqual(rows[0], {
    rateDate: '2026-09-01',
    rate: '10.8185',
    baseCurrency: 'EUR',
    quoteCurrency: 'NOK',
  });
  assert.equal(rows[3].rate, '10.8035');
  assert.equal(Number(rows[0].rate) > 1, true);
});

test('rejects an inverted NOK/EUR series instead of converting it', () => {
  assert.throws(
    () => parseNorgesBankEurNok(eurNokPayload({ base: 'NOK', quote: 'EUR' })),
    (error: unknown) => error instanceof FxSyncError && error.code === 'currency_mismatch',
  );
});

test('rejects a non-zero UNIT_MULT so per-100 quotes cannot be stored as per-euro', () => {
  assert.throws(
    () => parseNorgesBankEurNok(eurNokPayload({ unitMult: '2' })),
    (error: unknown) => error instanceof FxSyncError && error.code === 'malformed',
  );
});

test('skips future prints and does not invent weekend rows', () => {
  const rows = parseNorgesBankEurNok(
    eurNokPayload({
      dates: ['2026-09-04', '2026-09-05', '2026-09-06'],
      observations: {
        '0': ['10.8035'],
        '1': ['10.9'],
        '2': ['11.0'],
      },
    }),
    new Date('2026-09-05T12:00:00Z'),
  );

  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((row) => row.rateDate), ['2026-09-04', '2026-09-05']);
});

test('skips empty or non-positive observations without fabricating a rate', () => {
  const rows = parseNorgesBankEurNok(
    eurNokPayload({
      dates: ['2026-09-03', '2026-09-04'],
      observations: {
        '0': ['0'],
        '1': ['10.8035'],
      },
    }),
    new Date('2026-09-05T12:00:00Z'),
  );

  assert.equal(rows.length, 1);
  assert.equal(rows[0].rateDate, '2026-09-04');
});

test('rejects a payload with no persistable observations', () => {
  assert.throws(
    () =>
      parseNorgesBankEurNok(
        eurNokPayload({
          dates: ['2026-09-06'],
          observations: { '0': ['10.8'] },
        }),
        new Date('2026-09-05T12:00:00Z'),
      ),
    (error: unknown) => error instanceof FxSyncError && error.code === 'missing_rate',
  );
});
