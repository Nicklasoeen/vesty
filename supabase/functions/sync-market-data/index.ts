import '@supabase/functions-js/edge-runtime.d.ts';

import { withSupabase } from '@supabase/server';

import { classifyNavFreshness } from '../_shared/market-data/freshness.ts';
import {
  assertKnownProvider,
  fetchHistory,
  fetchLatest,
  resolveInstrument,
} from '../_shared/market-data/provider.ts';
import { ProviderSyncError, type MarketDataProvider } from '../_shared/market-data/types.ts';

interface MappingRow {
  id: string;
  investment_target_id: string;
  provider: MarketDataProvider;
  provider_instrument_id: string;
  active: boolean;
  investment_targets:
    | { currency: string; isin: string | null; name: string; ticker: string | null }
    | { currency: string; isin: string | null; name: string; ticker: string | null }[]
    | null;
}

interface SyncRequest {
  backfill?: boolean;
  investment_target_id?: string;
  probe?: string;
  provider?: string;
}

interface InstrumentReport {
  investment_target_id: string;
  name: string;
  ticker: string | null;
  isin: string | null;
  provider: MarketDataProvider;
  provider_instrument_id: string;
  provider_name: string | null;
  status: 'upserted' | 'skipped' | 'failed';
  observation_count: number;
  latest_price_date: string | null;
  latest_price: string | null;
  currency: string | null;
  freshness: ReturnType<typeof classifyNavFreshness> | null;
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

function selectedProvider(body: SyncRequest): MarketDataProvider {
  if (body.probe) {
    const probe = assertKnownProvider(body.probe);
    if (probe !== 'yahoo_unofficial') {
      throw new ProviderSyncError('unknown_instrument', 'Only yahoo_unofficial is a probe provider');
    }

    return probe;
  }

  if (body.provider) {
    return assertKnownProvider(body.provider);
  }

  return assertKnownProvider(Deno.env.get('MARKET_DATA_PROVIDER') ?? 'twelve_data');
}

function providerOptions(provider: MarketDataProvider) {
  if (provider === 'twelve_data') {
    return { apiKey: Deno.env.get('TWELVE_DATA_API_KEY') ?? '' };
  }

  if (provider === 'marketstack') {
    return { apiKey: Deno.env.get('MARKETSTACK_API_KEY') ?? '' };
  }

  return {};
}

function hasProviderKey(provider: MarketDataProvider): boolean {
  if (provider === 'twelve_data') {
    return Boolean((Deno.env.get('TWELVE_DATA_API_KEY') ?? '').trim());
  }

  if (provider === 'marketstack') {
    return Boolean((Deno.env.get('MARKETSTACK_API_KEY') ?? '').trim());
  }

  return true;
}

function licenseNote(provider: MarketDataProvider): string {
  if (provider === 'twelve_data') {
    return 'twelve_data_api_subscriber_access';
  }

  if (provider === 'marketstack') {
    return 'marketstack_api_subscriber_access';
  }

  return 'unofficial_http_probe_only';
}

async function pauseBetweenRequests() {
  await new Promise((resolve) => setTimeout(resolve, 800));
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

    let provider: MarketDataProvider;
    try {
      provider = selectedProvider(body);
    } catch (error) {
      return json(400, {
        error: error instanceof ProviderSyncError ? error.code : 'unknown_instrument',
        message: error instanceof Error ? error.message : 'Unknown provider',
      });
    }

    if (!hasProviderKey(provider)) {
      return json(503, {
        error: 'missing_provider_key',
        message:
          provider === 'marketstack'
            ? 'MARKETSTACK_API_KEY must be set in the Edge Function environment'
            : 'TWELVE_DATA_API_KEY must be set in the Edge Function environment',
      });
    }

    const backfill = body.backfill === true;
    let query = ctx.supabaseAdmin
      .from('market_data_instrument_mappings')
      .select(
        'id, investment_target_id, provider, provider_instrument_id, active, investment_targets(currency, isin, name, ticker)',
      )
      .eq('provider', provider)
      .eq('active', true);

    if (body.investment_target_id) {
      query = query.eq('investment_target_id', body.investment_target_id);
    }

    const mappingsResult = await query;
    if (mappingsResult.error) {
      return json(500, { error: 'mapping_lookup_failed', detail: mappingsResult.error.message });
    }

    const reports: InstrumentReport[] = [];
    const options = providerOptions(provider);
    const mappings = (mappingsResult.data ?? []) as MappingRow[];

    for (const [index, mapping] of mappings.entries()) {
      if (index > 0) {
        await pauseBetweenRequests();
      }
      const target = unwrapTarget(mapping.investment_targets);
      const baseReport: InstrumentReport = {
        investment_target_id: mapping.investment_target_id,
        name: target?.name ?? '',
        ticker: target?.ticker ?? null,
        isin: target?.isin ?? null,
        provider,
        provider_instrument_id: mapping.provider_instrument_id,
        provider_name: null,
        status: 'failed',
        observation_count: 0,
        latest_price_date: null,
        latest_price: null,
        currency: target?.currency ?? null,
        freshness: null,
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
        if (target.isin && provider !== 'marketstack') {
          const resolved = await resolveInstrument(provider, target.isin, {
            ...options,
            expectedCurrency: target.currency,
          });
          if (resolved) {
            baseReport.provider_name = resolved.name;
            if (resolved.providerInstrumentId !== mapping.provider_instrument_id) {
              throw new ProviderSyncError(
                'unknown_instrument',
                `Provider symbol ${resolved.providerInstrumentId} does not match mapping ${mapping.provider_instrument_id}`,
              );
            }
          }
        }

        const history = backfill
          ? await fetchHistory(provider, mapping.provider_instrument_id, {
              ...options,
              expectedCurrency: target.currency,
            })
          : await (async () => {
              const latest = await fetchLatest(provider, mapping.provider_instrument_id, {
                ...options,
                expectedCurrency: target.currency,
              });
              return {
                providerInstrumentId: latest.providerInstrumentId,
                currency: latest.currency,
                observations: [latest.observation],
              };
            })();

        if (history.providerInstrumentId !== mapping.provider_instrument_id) {
          throw new ProviderSyncError(
            'unknown_instrument',
            `Fetched symbol ${history.providerInstrumentId} does not match mapping ${mapping.provider_instrument_id}`,
          );
        }

        if (history.observations.length === 0) {
          throw new ProviderSyncError('missing_price', 'Provider returned no persistable NAV');
        }

        const rows = history.observations.map((observation) => ({
          investment_target_id: mapping.investment_target_id,
          provider,
          price_date: observation.priceDate,
          price: observation.price,
          currency: observation.currency,
          price_type: observation.priceType,
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
          freshness: classifyNavFreshness(latest.priceDate),
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
      provider,
      backfill,
      license: licenseNote(provider),
      mapping_count: mappings.length,
      note:
        provider === 'twelve_data' && mappings.length === 0
          ? 'No active twelve_data mappings. Do not activate until live NAV coverage is proven for all four funds.'
          : provider === 'marketstack' && mappings.length === 0
            ? 'No active marketstack mappings. Only the five curated V1 ETFs may be mapped.'
            : undefined,
      instruments: reports,
    });
  }),
};
