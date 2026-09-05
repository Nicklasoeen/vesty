-- Explicit Marketstack mappings for the five curated V1 ETFs.
-- Symbols are allowlisted only. No search, MIC guessing, or ticker derivation.
-- KLP/DNB targets keep their existing Yahoo/Twelve Data mappings.

insert into public.market_data_instrument_mappings (
  id,
  investment_target_id,
  provider,
  provider_instrument_id,
  provider_exchange,
  metadata,
  active
)
values
  (
    '41000000-0000-4000-8000-000000000021',
    '31000000-0000-4000-8000-000000000011',
    'marketstack',
    'VWCE.DE',
    'XETR',
    '{"verified":true}'::jsonb,
    true
  ),
  (
    '41000000-0000-4000-8000-000000000022',
    '31000000-0000-4000-8000-000000000012',
    'marketstack',
    'EUNK.DE',
    'XETR',
    '{"verified":true}'::jsonb,
    true
  ),
  (
    '41000000-0000-4000-8000-000000000023',
    '31000000-0000-4000-8000-000000000013',
    'marketstack',
    'IS3N.DE',
    'XETR',
    '{"verified":true}'::jsonb,
    true
  ),
  (
    '41000000-0000-4000-8000-000000000024',
    '31000000-0000-4000-8000-000000000014',
    'marketstack',
    'SXR8.DE',
    'XETR',
    '{"verified":true}'::jsonb,
    true
  ),
  (
    '41000000-0000-4000-8000-000000000025',
    '31000000-0000-4000-8000-000000000015',
    'marketstack',
    'SXRV.DE',
    'XETR',
    '{"verified":true}'::jsonb,
    true
  );

comment on table public.market_data_instrument_mappings is
  'Maps a Vesty InvestmentTarget to a market-data provider instrument. Marketstack is allowlisted for five V1 ETFs only. Yahoo unofficial is probe-only. Twelve Data stays inactive until NAV is proven.';
