import '@supabase/functions-js/edge-runtime.d.ts';

import { withSupabase } from '@supabase/server';

import { ProviderSyncError } from '../_shared/market-data/types.ts';
import { fetchHistory, fetchLatest } from '../_shared/market-data/yahooUnofficial.ts';

interface MappingRow {
  id: string;
  investment_target_id: string;
  provider: 'yahoo_unofficial' | 'twelve_data';
  provider_instrument_id: string;
  active: boolean;
  investment_targets:
    | { currency: string; isin: string | null; name: string }
    | { currency: string; isin: string | null; name: string }[]
    | null;
}

interface SyncRequest {
  backfill?: boolean;
  investment_target_id?: string;
}

interface InstrumentReport {
  investment_target_id: string;
  name: string;
  isin: string | null;
  status: 'upserted' | 'skipped' | 'failed';
  observation_count: number;
  latest_price_date: string | null;
  latest_price: string | null;
  currency: string | null;
  error_code: string | null;
  error_message: string | null;
}

function unwrapTarget(value: MappingRow['investment_targets']) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
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
    let query = ctx.supabaseAdmin
      .from('market_data_instrument_mappings')
      .select(
        'id, investment_target_id, provider, provider_instrument_id, active, investment_targets(currency, isin, name)',
      )
      .eq('provider', 'yahoo_unofficial')
      .eq('active', true);

    if (body.investment_target_id) {
      query = query.eq('investment_target_id', body.investment_target_id);
    }

    const mappingsResult = await query;
    if (mappingsResult.error) {
      return json(500, { error: 'mapping_lookup_failed', detail: mappingsResult.error.message });
    }

    const reports: InstrumentReport[] = [];

    for (const mapping of (mappingsResult.data ?? []) as MappingRow[]) {
      const target = unwrapTarget(mapping.investment_targets);
      const baseReport: InstrumentReport = {
        investment_target_id: mapping.investment_target_id,
        name: target?.name ?? '',
        isin: target?.isin ?? null,
        status: 'failed',
        observation_count: 0,
        latest_price_date: null,
        latest_price: null,
        currency: target?.currency ?? null,
        error_code: null,
        error_message: null,
      };

      if (!target) {
        reports.push({
          ...baseReport,
          error_code: 'unknown_instrument',
          error_message: 'Mapping is missing its investment target',
        });
        continue;
      }

      try {
        const history = backfill
          ? await fetchHistory(mapping.provider_instrument_id, {
              expectedCurrency: target.currency,
            })
          : {
              providerInstrumentId: mapping.provider_instrument_id,
              currency: target.currency,
              observations: [
                (
                  await fetchLatest(mapping.provider_instrument_id, {
                    expectedCurrency: target.currency,
                  })
                ).observation,
              ],
            };

        const rows = history.observations.map((observation) => ({
          investment_target_id: mapping.investment_target_id,
          provider: 'yahoo_unofficial' as const,
          price_date: observation.priceDate,
          price: observation.price,
          currency: observation.currency,
          price_type: 'nav' as const,
          fetched_at: new Date().toISOString(),
          provider_timestamp: observation.providerTimestamp,
        }));

        const upsert = await ctx.supabaseAdmin.from('market_prices').upsert(rows, {
          onConflict: 'investment_target_id,provider,price_type,price_date',
        });

        if (upsert.error) {
          reports.push({
            ...baseReport,
            error_code: 'persist_failed',
            error_message: upsert.error.message,
          });
          continue;
        }

        const latest = history.observations[history.observations.length - 1];
        reports.push({
          ...baseReport,
          status: 'upserted',
          observation_count: history.observations.length,
          latest_price_date: latest.priceDate,
          latest_price: latest.price,
          currency: latest.currency,
        });
      } catch (error) {
        reports.push({
          ...baseReport,
          status: 'failed',
          error_code: error instanceof ProviderSyncError ? error.code : 'unavailable',
          error_message: error instanceof Error ? error.message : 'Unknown provider failure',
        });
      }
    }

    return json(200, {
      provider: 'yahoo_unofficial',
      backfill,
      license: 'unofficial_http_not_a_redistribution_agreement',
      instruments: reports,
    });
  }),
};
