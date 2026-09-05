import '@supabase/functions-js/edge-runtime.d.ts';

import { withSupabase } from '@supabase/server';

import { classifyNavFreshness } from '../_shared/market-data/freshness.ts';
import { fetchHistoryEurNok, fetchLatestEurNok, norgesBankLicense } from '../_shared/fx/norgesBank.ts';
import { FxSyncError } from '../_shared/fx/types.ts';

interface SyncRequest {
  backfill?: boolean;
}

function json(status: number, body: unknown) {
  return Response.json(body, { status });
}

export default {
  fetch: withSupabase({ auth: 'secret' }, async (req, ctx) => {
    if (req.method !== 'POST') {
      return json(405, { error: 'method_not_allowed' });
    }

    let body: SyncRequest = {};
    const raw = await req.text();
    if (raw.trim() !== '') {
      try {
        body = JSON.parse(raw) as SyncRequest;
      } catch {
        return json(400, { error: 'malformed_json' });
      }
    }

    const backfill = body.backfill === true;

    try {
      const observations = backfill ? await fetchHistoryEurNok() : await fetchLatestEurNok();
      const rows = observations.map((observation) => ({
        base_currency: observation.baseCurrency,
        quote_currency: observation.quoteCurrency,
        rate: observation.rate,
        rate_date: observation.rateDate,
        provider: 'norges_bank' as const,
      }));

      const upsert = await ctx.supabaseAdmin.from('fx_rates').upsert(rows, {
        onConflict: 'base_currency,quote_currency,provider,rate_date',
      });

      if (upsert.error) {
        return json(500, { error: 'persist_failed', detail: upsert.error.message });
      }

      const latest = observations[observations.length - 1];
      return json(200, {
        provider: 'norges_bank',
        pair: 'EUR/NOK',
        convention: '1 EUR = rate NOK',
        backfill,
        license: norgesBankLicense,
        observation_count: observations.length,
        latest_rate_date: latest?.rateDate ?? null,
        latest_rate: latest?.rate ?? null,
        freshness: latest ? classifyNavFreshness(latest.rateDate) : null,
      });
    } catch (error) {
      return json(error instanceof FxSyncError && error.code === 'missing_rate' ? 503 : 502, {
        error: error instanceof FxSyncError ? error.code : 'unavailable',
        message: error instanceof Error ? error.message : 'Norges Bank FX sync failed',
      });
    }
  }),
};
