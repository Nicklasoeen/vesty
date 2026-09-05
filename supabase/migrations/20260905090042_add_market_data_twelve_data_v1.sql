-- Licensed Provider Verification + Daily Sync V1.
--
-- Twelve Data mappings stay INACTIVE until a real API key proves NAV
-- for all four TestFlight funds. Do not flip active here.
-- Yahoo unofficial mappings remain available only as an explicit probe.
-- Production ingest defaults to twelve_data and will no-op until activation.
--
-- This migration does not schedule cron and does not deploy remote jobs.

create unique index market_data_instrument_mappings_one_active_per_target
  on public.market_data_instrument_mappings (investment_target_id)
  where active;

comment on index public.market_data_instrument_mappings_one_active_per_target is
  'At most one active authoritative mapping per InvestmentTarget. Activate Twelve Data only after NAV proof; deactivate Yahoo first.';

create type public.market_nav_freshness_status as enum (
  'fresh',
  'stale',
  'unavailable'
);

comment on type public.market_nav_freshness_status is
  'Daily mutual-fund freshness. Weekends and a short holiday gap are not treated as provider failure. NAV is delayed, not realtime.';

create function public.market_nav_freshness_v1(
  p_price_date date,
  p_now timestamptz default timezone('utc', now()),
  p_holiday_buffer_days integer default 3
)
returns public.market_nav_freshness_status
language plpgsql
stable
security invoker
set search_path = ''
as $function$
declare
  v_today date;
  v_dow integer;
  v_last_weekday date;
  v_stale_after date;
begin
  if p_price_date is null then
    return 'unavailable';
  end if;

  if p_holiday_buffer_days < 0 then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.invalid_freshness_buffer';
  end if;

  v_today := (p_now at time zone 'utc')::date;

  if p_price_date > v_today then
    return 'unavailable';
  end if;

  v_dow := extract(dow from v_today)::integer;
  if v_dow = 0 then
    v_last_weekday := v_today - 2;
  elsif v_dow = 6 then
    v_last_weekday := v_today - 1;
  else
    v_last_weekday := v_today;
  end if;

  v_stale_after := v_last_weekday - p_holiday_buffer_days;

  if p_price_date >= v_stale_after then
    return 'fresh';
  end if;

  return 'stale';
end;
$function$;

comment on function public.market_nav_freshness_v1(date, timestamptz, integer) is
  'Classifies persisted daily NAV as fresh, stale, or unavailable. Does not invent prices.';

create view public.latest_market_price_status
with (security_invoker = true)
as
select
  price.id,
  price.investment_target_id,
  price.provider,
  price.price_date,
  price.price,
  price.currency,
  price.price_type,
  price.fetched_at,
  price.provider_timestamp,
  public.market_nav_freshness_v1(price.price_date) as freshness
from public.latest_market_prices as price;

comment on view public.latest_market_price_status is
  'Latest persisted NAV plus freshness metadata for a later UI. Not a valuation.';

revoke all on public.latest_market_price_status from public, anon, authenticated;
grant usage on type public.market_nav_freshness_status to authenticated;
grant execute on function public.market_nav_freshness_v1(date, timestamptz, integer) to authenticated;
grant select on public.latest_market_price_status to authenticated;

comment on table public.market_data_instrument_mappings is
  'Maps a Vesty InvestmentTarget to a market-data provider instrument. Production ingest uses twelve_data only after NAV proof. Yahoo unofficial is probe-only.';
