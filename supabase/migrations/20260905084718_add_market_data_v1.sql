-- Market Data V1: verified instrument identity, provider mappings, stored NAV.
--
-- Prices are shared catalog data. Writes are trusted/server-only.
-- Yahoo unofficial HTTP is the only source with proven latest+historical NAV
-- for the four TestFlight funds. It is not a licensed redistribution feed.
-- Twelve Data catalog identity was proven; NAV was not, so that mapping stays
-- inactive until a real key proves quotes.
--
-- Transaction amount_minor stays bigint. Fund NAV uses numeric(20, 8).
-- Quantity remains nullable; NAV alone does not produce market value.

-- ---------------------------------------------------------------------------
-- Verified TestFlight catalog identity
-- Sources: KLP prospectus / klp.no fund pages, DNB prospectus / dnb.no,
-- OpenFIGI ISIN mapping. Share class P / A as named. Currency NOK.
-- Ticker/exchange/provider_symbol stay null (mutual funds, not stocks).
-- ---------------------------------------------------------------------------

update public.investment_targets
set
  name = 'KLP AksjeGlobal Indeks P',
  kind = 'fund',
  status = 'active',
  currency = 'NOK',
  isin = 'NO0010776040',
  ticker = null,
  exchange = null,
  provider_symbol = null,
  updated_at = now()
where id = '31000000-0000-4000-8000-000000000001';

update public.investment_targets
set
  name = 'DNB Teknologi A',
  kind = 'fund',
  status = 'active',
  currency = 'NOK',
  isin = 'NO0010337678',
  ticker = null,
  exchange = null,
  provider_symbol = null,
  updated_at = now()
where id = '31000000-0000-4000-8000-000000000002';

update public.investment_targets
set
  name = 'KLP AksjeNorge Indeks P',
  kind = 'fund',
  status = 'active',
  currency = 'NOK',
  isin = 'NO0010455694',
  ticker = null,
  exchange = null,
  provider_symbol = null,
  updated_at = now()
where id = '31000000-0000-4000-8000-000000000003';

update public.investment_targets
set
  name = 'KLP AksjeFremvoksende Markeder Indeks P',
  kind = 'fund',
  status = 'active',
  currency = 'NOK',
  isin = 'NO0010611809',
  ticker = null,
  exchange = null,
  provider_symbol = null,
  updated_at = now()
where id = '31000000-0000-4000-8000-000000000004';

comment on column public.investment_targets.isin is
  'Verified ISIN when known. Null until identity is confirmed from an authoritative source. Do not invent values.';

-- ---------------------------------------------------------------------------
-- Provider mapping (kept off InvestmentTarget)
-- ---------------------------------------------------------------------------

create type public.market_data_provider as enum (
  'yahoo_unofficial',
  'twelve_data'
);

create type public.market_price_type as enum (
  'nav',
  'close',
  'delayed'
);

create table public.market_data_instrument_mappings (
  id uuid primary key default gen_random_uuid(),
  investment_target_id uuid not null
    references public.investment_targets (id) on delete restrict,
  provider public.market_data_provider not null,
  provider_instrument_id text not null,
  provider_exchange text,
  metadata jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint market_data_instrument_mappings_provider_instrument_id_check
    check (btrim(provider_instrument_id) <> ''),
  constraint market_data_instrument_mappings_provider_exchange_check
    check (provider_exchange is null or btrim(provider_exchange) <> ''),
  constraint market_data_instrument_mappings_metadata_object_check
    check (jsonb_typeof(metadata) = 'object')
);

create unique index market_data_instrument_mappings_provider_symbol_key
  on public.market_data_instrument_mappings (
    investment_target_id,
    provider,
    provider_instrument_id
  );

create unique index market_data_instrument_mappings_one_active_per_provider
  on public.market_data_instrument_mappings (investment_target_id, provider)
  where active;

comment on table public.market_data_instrument_mappings is
  'Maps a Vesty InvestmentTarget to a market-data provider instrument. Provider symbols do not belong on investment_targets.';

-- ---------------------------------------------------------------------------
-- Stored price / NAV observations
-- ---------------------------------------------------------------------------

create table public.market_prices (
  id uuid primary key default gen_random_uuid(),
  investment_target_id uuid not null
    references public.investment_targets (id) on delete restrict,
  provider public.market_data_provider not null,
  price_date date not null,
  price numeric(20, 8) not null,
  currency text not null,
  price_type public.market_price_type not null,
  fetched_at timestamptz not null default now(),
  provider_timestamp timestamptz,
  created_at timestamptz not null default now(),
  constraint market_prices_currency_check
    check (currency ~ '^[A-Z]{3}$'),
  constraint market_prices_price_positive_check
    check (price > 0),
  constraint market_prices_date_not_future_check
    check (price_date <= (current_date + 1)),
  constraint market_prices_observation_key unique (
    investment_target_id,
    provider,
    price_type,
    price_date
  )
);

comment on table public.market_prices is
  'Validated NAV/price observations. numeric(20, 8) is exact decimal storage. Not a substitute for transaction quantity.';

comment on column public.market_prices.price is
  'Exact decimal NAV or price. Fund NAV may need more precision than integer øre. Not IEEE-754 authoritative.';

comment on column public.market_prices.price_date is
  'Calendar date of the observation (NAV date). This is delayed fund data, not a realtime quote.';

create index market_prices_target_date_idx
  on public.market_prices (investment_target_id, price_type, price_date desc);

create function private.market_price_validate_v1()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_currency text;
begin
  select target.currency
  into v_currency
  from public.investment_targets as target
  where target.id = new.investment_target_id;

  if v_currency is null then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.unknown_target';
  end if;

  if new.currency <> v_currency then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.currency_mismatch';
  end if;

  if not exists (
    select 1
    from public.market_data_instrument_mappings as mapping
    where mapping.investment_target_id = new.investment_target_id
      and mapping.provider = new.provider
      and mapping.active
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.unknown_mapping';
  end if;

  return new;
end;
$function$;

create trigger market_prices_validate
before insert or update on public.market_prices
for each row
execute function private.market_price_validate_v1();

create view public.latest_market_prices
with (security_invoker = true)
as
select distinct on (
  price.investment_target_id,
  price.provider,
  price.price_type
)
  price.id,
  price.investment_target_id,
  price.provider,
  price.price_date,
  price.price,
  price.currency,
  price.price_type,
  price.fetched_at,
  price.provider_timestamp
from public.market_prices as price
order by
  price.investment_target_id,
  price.provider,
  price.price_type,
  price.price_date desc,
  price.fetched_at desc;

comment on view public.latest_market_prices is
  'Latest persisted observation per target, provider, and price type. As-of date is price_date; not realtime.';

-- ---------------------------------------------------------------------------
-- Seed mappings. Yahoo unofficial symbols come from live Yahoo search by ISIN.
-- Twelve Data /funds?isin= returned the same 0P000 symbols; NAV unproven.
-- ---------------------------------------------------------------------------

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
    '41000000-0000-4000-8000-000000000001',
    '31000000-0000-4000-8000-000000000001',
    'yahoo_unofficial',
    '0P00018V9L.IR',
    'ISE',
    '{"isin":"NO0010776040","coverage_proven":true,"license":"unofficial_http"}'::jsonb,
    true
  ),
  (
    '41000000-0000-4000-8000-000000000002',
    '31000000-0000-4000-8000-000000000002',
    'yahoo_unofficial',
    '0P00000MVB.IR',
    'ISE',
    '{"isin":"NO0010337678","coverage_proven":true,"license":"unofficial_http"}'::jsonb,
    true
  ),
  (
    '41000000-0000-4000-8000-000000000003',
    '31000000-0000-4000-8000-000000000003',
    'yahoo_unofficial',
    '0P0000HNUP.IR',
    'ISE',
    '{"isin":"NO0010455694","coverage_proven":true,"license":"unofficial_http"}'::jsonb,
    true
  ),
  (
    '41000000-0000-4000-8000-000000000004',
    '31000000-0000-4000-8000-000000000004',
    'yahoo_unofficial',
    '0P0000TJ5D.IR',
    'ISE',
    '{"isin":"NO0010611809","coverage_proven":true,"license":"unofficial_http"}'::jsonb,
    true
  ),
  (
    '41000000-0000-4000-8000-000000000011',
    '31000000-0000-4000-8000-000000000001',
    'twelve_data',
    '0P00018V9L',
    'ISE',
    '{"isin":"NO0010776040","catalog_proven":true,"nav_proven":false}'::jsonb,
    false
  ),
  (
    '41000000-0000-4000-8000-000000000012',
    '31000000-0000-4000-8000-000000000002',
    'twelve_data',
    '0P00000MVB',
    'ISE',
    '{"isin":"NO0010337678","catalog_proven":true,"nav_proven":false}'::jsonb,
    false
  ),
  (
    '41000000-0000-4000-8000-000000000013',
    '31000000-0000-4000-8000-000000000003',
    'twelve_data',
    '0P0000HNUP',
    'ISE',
    '{"isin":"NO0010455694","catalog_proven":true,"nav_proven":false}'::jsonb,
    false
  ),
  (
    '41000000-0000-4000-8000-000000000014',
    '31000000-0000-4000-8000-000000000004',
    'twelve_data',
    '0P0000TJ5D',
    'ISE',
    '{"isin":"NO0010611809","catalog_proven":true,"nav_proven":false}'::jsonb,
    false
  );

-- ---------------------------------------------------------------------------
-- RLS: authenticated read. No client writes. Service role ingest only.
-- ---------------------------------------------------------------------------

alter table public.market_data_instrument_mappings enable row level security;
alter table public.market_data_instrument_mappings force row level security;
alter table public.market_prices enable row level security;
alter table public.market_prices force row level security;

revoke all on public.market_data_instrument_mappings from public, anon, authenticated;
revoke all on public.market_prices from public, anon, authenticated;
revoke all on public.latest_market_prices from public, anon, authenticated;

grant usage on type public.market_data_provider to authenticated;
grant usage on type public.market_price_type to authenticated;

grant select on public.market_data_instrument_mappings to authenticated;
grant select on public.market_prices to authenticated;
grant select on public.latest_market_prices to authenticated;

create policy market_data_instrument_mappings_select_authenticated
on public.market_data_instrument_mappings
for select
to authenticated
using ((select auth.uid()) is not null);

create policy market_prices_select_authenticated
on public.market_prices
for select
to authenticated
using ((select auth.uid()) is not null);
