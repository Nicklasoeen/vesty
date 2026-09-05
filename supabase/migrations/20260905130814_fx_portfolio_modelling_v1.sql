-- Authoritative EUR/NOK FX + estimated/modelled portfolio valuation for
-- curated V1 ETF clubs.
--
-- Provider: Norges Bank daily middle rates (NLOD 2.0).
-- Convention: EUR/NOK rate R means 1 EUR = R NOK. Never invert.
-- Modelled quantity is derived, never stored on member_investment_transactions.quantity.
-- Exact member-reported quantity always takes precedence for that lot.
-- Legacy KLP/DNB clubs are not modelled from ETF prices.

-- ---------------------------------------------------------------------------
-- FX rates
-- ---------------------------------------------------------------------------

create type public.fx_rate_provider as enum (
  'norges_bank'
);

comment on type public.fx_rate_provider is
  'Authoritative FX ingest providers. V1 uses Norges Bank only.';

create table public.fx_rates (
  id uuid primary key default gen_random_uuid(),
  base_currency text not null,
  quote_currency text not null,
  rate numeric(20, 8) not null,
  rate_date date not null,
  provider public.fx_rate_provider not null,
  created_at timestamptz not null default now(),
  constraint fx_rates_base_currency_check
    check (base_currency ~ '^[A-Z]{3}$'),
  constraint fx_rates_quote_currency_check
    check (quote_currency ~ '^[A-Z]{3}$'),
  constraint fx_rates_pair_distinct_check
    check (base_currency <> quote_currency),
  constraint fx_rates_v1_eur_nok_check
    check (base_currency = 'EUR' and quote_currency = 'NOK'),
  constraint fx_rates_rate_positive_check
    check (rate > 0),
  constraint fx_rates_date_not_future_check
    check (rate_date <= (current_date + 1)),
  constraint fx_rates_observation_key unique (
    base_currency,
    quote_currency,
    provider,
    rate_date
  )
);

comment on table public.fx_rates is
  'Authoritative daily FX observations. numeric(20, 8) is exact decimal storage. V1 stores EUR/NOK only. A rate of 11.80 means 1 EUR = 11.80 NOK.';

comment on column public.fx_rates.base_currency is
  'Unit currency. For V1 this is always EUR.';

comment on column public.fx_rates.quote_currency is
  'Price currency. For V1 this is always NOK.';

comment on column public.fx_rates.rate is
  'Exact decimal quote. 1 base_currency = rate quote_currency. Do not invert.';

comment on column public.fx_rates.rate_date is
  'Calendar date of the Norges Bank middle-rate print. Weekends and Norwegian holidays have no row.';

comment on column public.fx_rates.provider is
  'Ingest source. V1 is norges_bank only.';

create index fx_rates_pair_date_idx
  on public.fx_rates (base_currency, quote_currency, provider, rate_date desc);

create view public.latest_fx_rates
with (security_invoker = true)
as
select distinct on (
  rate.base_currency,
  rate.quote_currency,
  rate.provider
)
  rate.id,
  rate.base_currency,
  rate.quote_currency,
  rate.provider,
  rate.rate_date,
  rate.rate,
  rate.created_at
from public.fx_rates as rate
order by
  rate.base_currency,
  rate.quote_currency,
  rate.provider,
  rate.rate_date desc,
  rate.created_at desc;

comment on view public.latest_fx_rates is
  'Latest persisted FX print per pair and provider. As-of date is rate_date; not a live quote.';

create view public.latest_fx_rate_status
with (security_invoker = true)
as
select
  rate.id,
  rate.base_currency,
  rate.quote_currency,
  rate.provider,
  rate.rate_date,
  rate.rate,
  rate.created_at,
  public.market_nav_freshness_v1(rate.rate_date) as freshness
from public.latest_fx_rates as rate;

comment on view public.latest_fx_rate_status is
  'Latest FX print plus the same weekday/holiday freshness used for daily market observations.';

alter table public.fx_rates enable row level security;
alter table public.fx_rates force row level security;

revoke all on public.fx_rates from public, anon, authenticated;
revoke all on public.latest_fx_rates from public, anon, authenticated;
revoke all on public.latest_fx_rate_status from public, anon, authenticated;

grant usage on type public.fx_rate_provider to authenticated;
grant select on public.fx_rates to authenticated;
grant select on public.latest_fx_rates to authenticated;
grant select on public.latest_fx_rate_status to authenticated;

create policy fx_rates_select_authenticated
on public.fx_rates
for select
to authenticated
using ((select auth.uid()) is not null);

-- ---------------------------------------------------------------------------
-- Reference-date and as-of lookup helpers
-- ---------------------------------------------------------------------------

create function public.reference_lookup_max_age_days_v1()
returns integer
language sql
immutable
security invoker
set search_path = ''
as $function$
  select 10;
$function$;

comment on function public.reference_lookup_max_age_days_v1() is
  'Conservative calendar-day window for prior FX or EOD fallback. Covers weekends plus a holiday stretch. Missing prints outside this window stay unavailable. Never look ahead.';

create function public.cycle_reference_date_v1(
  p_investment_day_at timestamptz,
  p_timezone text
)
returns date
language plpgsql
stable
security invoker
set search_path = ''
as $function$
declare
  v_timezone text;
  v_date date;
begin
  if p_investment_day_at is null then
    return null;
  end if;

  v_timezone := case
    when p_timezone is null or pg_catalog.btrim(p_timezone) = '' then 'Europe/Oslo'
    else pg_catalog.btrim(p_timezone)
  end;

  begin
    v_date := (p_investment_day_at at time zone v_timezone)::date;
  exception
    when others then
      v_date := (p_investment_day_at at time zone 'Europe/Oslo')::date;
  end;

  return v_date;
end;
$function$;

comment on function public.cycle_reference_date_v1(timestamptz, text) is
  'Modelled-purchase calendar date from Investment Day, in the cycle timezone. Not confirmation time and not today.';

create function public.fx_rate_as_of_v1(
  p_base_currency text,
  p_quote_currency text,
  p_as_of date,
  p_max_age_days integer default 10
)
returns table (
  rate numeric,
  rate_date date,
  provider public.fx_rate_provider
)
language sql
stable
security invoker
set search_path = ''
as $function$
  select
    rate.rate,
    rate.rate_date,
    rate.provider
  from public.fx_rates as rate
  where rate.base_currency = p_base_currency
    and rate.quote_currency = p_quote_currency
    and rate.provider = 'norges_bank'
    and p_as_of is not null
    and rate.rate_date <= p_as_of
    and (p_as_of - rate.rate_date) <= p_max_age_days
  order by rate.rate_date desc, rate.created_at desc
  limit 1;
$function$;

comment on function public.fx_rate_as_of_v1(text, text, date, integer) is
  'Most recent Norges Bank EUR/NOK print on or before as-of, within the fallback window. Never uses a future rate.';

create function public.marketstack_close_as_of_v1(
  p_investment_target_id uuid,
  p_as_of date,
  p_max_age_days integer default 10
)
returns table (
  price numeric,
  price_date date,
  currency text
)
language sql
stable
security invoker
set search_path = ''
as $function$
  select
    price.price,
    price.price_date,
    price.currency
  from public.market_prices as price
  join public.market_data_instrument_mappings as mapping
    on mapping.investment_target_id = price.investment_target_id
   and mapping.provider = price.provider
   and mapping.active
  where price.investment_target_id = p_investment_target_id
    and price.provider = 'marketstack'
    and price.price_type = 'close'
    and price.price > 0
    and p_as_of is not null
    and price.price_date <= p_as_of
    and (p_as_of - price.price_date) <= p_max_age_days
  order by price.price_date desc, price.fetched_at desc
  limit 1;
$function$;

comment on function public.marketstack_close_as_of_v1(uuid, date, integer) is
  'Most recent allowlisted Marketstack EOD close on or before as-of, within the fallback window. Never uses a future close and never interpolates.';

create function private.latest_strategy_version_id_v1(p_club_id uuid)
returns uuid
language sql
stable
security invoker
set search_path = ''
as $function$
  select version.id
  from public.strategy_versions as version
  where version.club_id = p_club_id
  order by version.version_number desc
  limit 1;
$function$;

create function private.club_is_curated_v1_etf(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select private.strategy_is_curated_v1_etf(private.latest_strategy_version_id_v1(p_club_id));
$function$;

-- ---------------------------------------------------------------------------
-- Derived lots: exact quantity or modelled reference quantity
-- ---------------------------------------------------------------------------

create view public.member_investment_lots_v1
with (security_invoker = true)
as
select
  lot.transaction_id,
  lot.membership_id,
  lot.club_id,
  lot.investment_cycle_id,
  lot.investment_target_id,
  lot.amount_minor,
  lot.contribution_currency,
  lot.exact_quantity,
  lot.reference_date,
  lot.is_core_v1_etf,
  fx.rate as reference_fx_rate,
  fx.rate_date as reference_fx_date,
  close.price as reference_eur_price,
  close.price_date as reference_price_date,
  close.currency as reference_price_currency,
  case
    when lot.exact_quantity is not null then null
    when lot.is_core_v1_etf
      and fx.rate is not null
      and fx.rate > 0
      and close.price is not null
      and close.price > 0
    then (lot.amount_minor::numeric / 100) / fx.rate / close.price
    else null
  end as modelled_quantity,
  case
    when lot.exact_quantity is not null then lot.exact_quantity
    when lot.is_core_v1_etf
      and fx.rate is not null
      and fx.rate > 0
      and close.price is not null
      and close.price > 0
    then (lot.amount_minor::numeric / 100) / fx.rate / close.price
    else null
  end as lot_quantity,
  case
    when lot.exact_quantity is not null then 'exact'
    when lot.is_core_v1_etf
      and fx.rate is not null
      and fx.rate > 0
      and close.price is not null
      and close.price > 0
    then 'estimated'
    else 'unavailable'
  end as lot_quantity_source
from (
  select
    transaction.id as transaction_id,
    transaction.membership_id,
    transaction.club_id,
    transaction.investment_cycle_id,
    transaction.investment_target_id,
    transaction.amount_minor,
    transaction.currency as contribution_currency,
    transaction.quantity as exact_quantity,
    public.cycle_reference_date_v1(cycle.investment_day_at, cycle.timezone) as reference_date,
    transaction.investment_target_id = any (private.core_v1_etf_target_ids()) as is_core_v1_etf
  from public.member_investment_transactions as transaction
  join public.investment_cycles as cycle
    on cycle.id = transaction.investment_cycle_id
  where transaction.transaction_type = 'buy'
) as lot
left join lateral public.fx_rate_as_of_v1(
  'EUR',
  'NOK',
  lot.reference_date,
  public.reference_lookup_max_age_days_v1()
) as fx on lot.is_core_v1_etf and lot.exact_quantity is null
left join lateral public.marketstack_close_as_of_v1(
  lot.investment_target_id,
  lot.reference_date,
  public.reference_lookup_max_age_days_v1()
) as close on lot.is_core_v1_etf and lot.exact_quantity is null;

comment on view public.member_investment_lots_v1 is
  'Per-buy lot with exact member-reported quantity or a derived modelled_quantity. Modelled quantity is never written to member_investment_transactions.quantity. security_invoker so transaction RLS applies.';

revoke all on public.member_investment_lots_v1 from public, anon, authenticated;
grant select on public.member_investment_lots_v1 to authenticated;

-- ---------------------------------------------------------------------------
-- Estimated positions (own membership only)
-- ---------------------------------------------------------------------------

create view public.member_estimated_positions_v1
with (security_invoker = true)
as
select
  lot.membership_id,
  lot.club_id,
  lot.investment_target_id,
  target.name as target_name,
  target.kind as target_kind,
  target.ticker as target_ticker,
  target.currency as instrument_currency,
  lot.contribution_currency,
  pg_catalog.sum(lot.amount_minor) as total_invested_minor,
  pg_catalog.count(*)::integer as lot_count,
  pg_catalog.count(*) filter (where lot.lot_quantity_source = 'exact')::integer as exact_lot_count,
  pg_catalog.count(*) filter (where lot.lot_quantity_source = 'estimated')::integer as estimated_lot_count,
  pg_catalog.count(*) filter (where lot.lot_quantity_source = 'unavailable')::integer as unavailable_lot_count,
  pg_catalog.sum(lot.exact_quantity) as exact_quantity,
  pg_catalog.sum(lot.modelled_quantity) as modelled_quantity,
  pg_catalog.sum(lot.lot_quantity) as valued_quantity,
  case
    when pg_catalog.count(*) = 0 then 'unavailable'
    when pg_catalog.count(*) filter (where lot.lot_quantity_source = 'unavailable') > 0 then 'unavailable'
    when pg_catalog.count(*) filter (where lot.lot_quantity_source = 'exact') = pg_catalog.count(*) then 'exact'
    when pg_catalog.count(*) filter (where lot.lot_quantity_source = 'estimated') = pg_catalog.count(*) then 'estimated'
    else 'mixed'
  end as valuation_confidence,
  latest_price.price as latest_eur_price,
  latest_price.price_date as latest_eur_price_date,
  latest_price.freshness as latest_eur_price_freshness,
  latest_fx.rate as latest_eur_nok,
  latest_fx.rate_date as latest_eur_nok_date,
  latest_fx.freshness as latest_eur_nok_freshness,
  case
    when pg_catalog.count(*) filter (where lot.lot_quantity_source = 'unavailable') > 0 then null
    when pg_catalog.sum(lot.lot_quantity) is null then null
    when latest_price.price is null or latest_price.price <= 0 then null
    when latest_price.freshness is distinct from 'fresh' then null
    when latest_price.currency is distinct from target.currency then null
    when latest_fx.rate is null or latest_fx.rate <= 0 then null
    when latest_fx.freshness is distinct from 'fresh' then null
    else pg_catalog.sum(lot.lot_quantity) * latest_price.price * latest_fx.rate
  end as estimated_current_value_nok,
  case
    when pg_catalog.count(*) filter (where lot.lot_quantity_source = 'unavailable') > 0 then null
    when pg_catalog.sum(lot.lot_quantity) is null then null
    when latest_price.price is null or latest_price.price <= 0 then null
    when latest_price.freshness is distinct from 'fresh' then null
    when latest_price.currency is distinct from target.currency then null
    when latest_fx.rate is null or latest_fx.rate <= 0 then null
    when latest_fx.freshness is distinct from 'fresh' then null
    else pg_catalog.round(pg_catalog.sum(lot.lot_quantity) * latest_price.price * latest_fx.rate * 100)
  end as estimated_current_value_minor
from public.member_investment_lots_v1 as lot
join public.investment_targets as target
  on target.id = lot.investment_target_id
left join public.latest_market_price_status as latest_price
  on latest_price.investment_target_id = lot.investment_target_id
 and latest_price.provider = 'marketstack'
 and latest_price.price_type = 'close'
left join public.latest_fx_rate_status as latest_fx
  on latest_fx.base_currency = 'EUR'
 and latest_fx.quote_currency = 'NOK'
 and latest_fx.provider = 'norges_bank'
group by
  lot.membership_id,
  lot.club_id,
  lot.investment_target_id,
  lot.contribution_currency,
  target.name,
  target.kind,
  target.ticker,
  target.currency,
  latest_price.price,
  latest_price.price_date,
  latest_price.freshness,
  latest_price.currency,
  latest_fx.rate,
  latest_fx.rate_date,
  latest_fx.freshness;

comment on view public.member_estimated_positions_v1 is
  'Own-position estimated NOK value from exact or modelled lot quantity × latest fresh EUR close × latest fresh EUR/NOK. security_invoker so transaction RLS applies. Not broker-verified.';

revoke all on public.member_estimated_positions_v1 from public, anon, authenticated;
grant select on public.member_estimated_positions_v1 to authenticated;

-- ---------------------------------------------------------------------------
-- Member portfolio summary + history (own lots only)
-- ---------------------------------------------------------------------------

create function private.member_core_etf_portfolio_totals_v1(p_club_id uuid)
returns table (
  lot_count integer,
  exact_lot_count integer,
  estimated_lot_count integer,
  unavailable_lot_count integer,
  invested_minor bigint,
  valuation_confidence text,
  estimated_current_value_nok numeric,
  estimated_current_value_minor bigint
)
language sql
stable
security invoker
set search_path = ''
as $function$
  with lots as (
    select
      lot.amount_minor,
      lot.lot_quantity,
      lot.lot_quantity_source,
      target.currency as instrument_currency,
      latest_price.price as latest_eur_price,
      latest_price.freshness as latest_price_freshness,
      latest_price.currency as latest_price_currency,
      latest_fx.rate as latest_eur_nok,
      latest_fx.freshness as latest_fx_freshness
    from public.member_investment_lots_v1 as lot
    join public.investment_targets as target
      on target.id = lot.investment_target_id
    left join public.latest_market_price_status as latest_price
      on latest_price.investment_target_id = lot.investment_target_id
     and latest_price.provider = 'marketstack'
     and latest_price.price_type = 'close'
    left join public.latest_fx_rate_status as latest_fx
      on latest_fx.base_currency = 'EUR'
     and latest_fx.quote_currency = 'NOK'
     and latest_fx.provider = 'norges_bank'
    where lot.is_core_v1_etf
      and (p_club_id is null or lot.club_id = p_club_id)
  )
  select
    pg_catalog.count(*)::integer,
    pg_catalog.count(*) filter (where lots.lot_quantity_source = 'exact')::integer,
    pg_catalog.count(*) filter (where lots.lot_quantity_source = 'estimated')::integer,
    pg_catalog.count(*) filter (where lots.lot_quantity_source = 'unavailable')::integer,
    coalesce(pg_catalog.sum(lots.amount_minor), 0)::bigint,
    case
      when pg_catalog.count(*) = 0 then 'unavailable'
      when pg_catalog.count(*) filter (where lots.lot_quantity_source = 'unavailable') > 0 then 'unavailable'
      when pg_catalog.count(*) filter (where lots.lot_quantity_source = 'exact') = pg_catalog.count(*) then 'exact'
      when pg_catalog.count(*) filter (where lots.lot_quantity_source = 'estimated') = pg_catalog.count(*) then 'estimated'
      else 'mixed'
    end,
    case
      when pg_catalog.count(*) = 0 then null
      when bool_and(
        lots.lot_quantity is not null
        and lots.latest_eur_price is not null
        and lots.latest_eur_price > 0
        and lots.latest_price_freshness = 'fresh'
        and lots.latest_price_currency is not distinct from lots.instrument_currency
        and lots.latest_eur_nok is not null
        and lots.latest_eur_nok > 0
        and lots.latest_fx_freshness = 'fresh'
      ) then pg_catalog.sum(lots.lot_quantity * lots.latest_eur_price * lots.latest_eur_nok)
      else null
    end,
    case
      when pg_catalog.count(*) = 0 then null
      when bool_and(
        lots.lot_quantity is not null
        and lots.latest_eur_price is not null
        and lots.latest_eur_price > 0
        and lots.latest_price_freshness = 'fresh'
        and lots.latest_price_currency is not distinct from lots.instrument_currency
        and lots.latest_eur_nok is not null
        and lots.latest_eur_nok > 0
        and lots.latest_fx_freshness = 'fresh'
      ) then pg_catalog.round(pg_catalog.sum(lots.lot_quantity * lots.latest_eur_price * lots.latest_eur_nok) * 100)
      else null
    end
  from lots;
$function$;

create function public.member_estimated_portfolio_v1(p_club_id uuid default null)
returns table (
  club_id uuid,
  modelling_scope text,
  invested_minor bigint,
  estimated_current_value_nok numeric,
  estimated_current_value_minor bigint,
  gain_loss_nok numeric,
  gain_loss_minor bigint,
  gain_loss_bps integer,
  valuation_confidence text,
  lot_count integer,
  exact_lot_count integer,
  estimated_lot_count integer,
  unavailable_lot_count integer
)
language plpgsql
stable
security invoker
set search_path = ''
as $function$
declare
  v_user uuid;
  v_scope text;
  v_totals record;
begin
  v_user := (select auth.uid());
  if v_user is null then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.unauthenticated';
  end if;

  if p_club_id is not null then
    if not private.is_active_club_member(p_club_id) then
      raise exception using
        errcode = 'P0001',
        message = 'vesty.not_club_member';
    end if;

    if private.club_is_curated_v1_etf(p_club_id) then
      v_scope := 'curated_etf';
    else
      v_scope := 'legacy';
    end if;
  else
    if exists (
      select 1
      from public.club_memberships as membership
      where membership.profile_id = v_user
        and membership.status = 'active'
        and private.club_is_curated_v1_etf(membership.club_id)
    ) then
      v_scope := 'curated_etf';
    elsif exists (
      select 1
      from public.club_memberships as membership
      where membership.profile_id = v_user
        and membership.status = 'active'
    ) then
      v_scope := 'legacy';
    else
      v_scope := 'none';
    end if;
  end if;

  if v_scope is distinct from 'curated_etf' then
    club_id := p_club_id;
    modelling_scope := v_scope;
    invested_minor := 0;
    estimated_current_value_nok := null;
    estimated_current_value_minor := null;
    gain_loss_nok := null;
    gain_loss_minor := null;
    gain_loss_bps := null;
    valuation_confidence := 'unavailable';
    lot_count := 0;
    exact_lot_count := 0;
    estimated_lot_count := 0;
    unavailable_lot_count := 0;
    return next;
    return;
  end if;

  select *
  into v_totals
  from private.member_core_etf_portfolio_totals_v1(p_club_id);

  club_id := p_club_id;
  modelling_scope := v_scope;
  invested_minor := coalesce(v_totals.invested_minor, 0);
  estimated_current_value_nok := v_totals.estimated_current_value_nok;
  estimated_current_value_minor := v_totals.estimated_current_value_minor;
  lot_count := coalesce(v_totals.lot_count, 0);
  exact_lot_count := coalesce(v_totals.exact_lot_count, 0);
  estimated_lot_count := coalesce(v_totals.estimated_lot_count, 0);
  unavailable_lot_count := coalesce(v_totals.unavailable_lot_count, 0);
  valuation_confidence := coalesce(v_totals.valuation_confidence, 'unavailable');

  if estimated_current_value_nok is not null then
    gain_loss_nok := estimated_current_value_nok - (invested_minor::numeric / 100);
    gain_loss_minor := pg_catalog.round(gain_loss_nok * 100);
    if invested_minor > 0 then
      gain_loss_bps := pg_catalog.round((gain_loss_nok / (invested_minor::numeric / 100)) * 10000)::integer;
    else
      gain_loss_bps := null;
    end if;
  end if;

  return next;
end;
$function$;

comment on function public.member_estimated_portfolio_v1(uuid) is
  'Caller''s estimated NOK portfolio for one curated club, or across curated clubs when club_id is null. Legacy clubs return modelling_scope=legacy without ETF modelling.';

create function public.member_estimated_portfolios_v1()
returns table (
  club_id uuid,
  modelling_scope text,
  invested_minor bigint,
  estimated_current_value_nok numeric,
  estimated_current_value_minor bigint,
  gain_loss_nok numeric,
  gain_loss_minor bigint,
  gain_loss_bps integer,
  valuation_confidence text,
  lot_count integer,
  exact_lot_count integer,
  estimated_lot_count integer,
  unavailable_lot_count integer
)
language plpgsql
stable
security invoker
set search_path = ''
as $function$
declare
  v_user uuid;
  v_club uuid;
begin
  v_user := (select auth.uid());
  if v_user is null then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.unauthenticated';
  end if;

  for v_club in
    select membership.club_id
    from public.club_memberships as membership
    where membership.profile_id = v_user
      and membership.status = 'active'
    order by membership.joined_at
  loop
    return query
    select *
    from public.member_estimated_portfolio_v1(v_club);
  end loop;
end;
$function$;

create function public.member_portfolio_history_v1(
  p_club_id uuid,
  p_from date,
  p_to date,
  p_step_days integer default 7
)
returns table (
  as_of_date date,
  invested_minor bigint,
  estimated_value_nok numeric,
  estimated_value_minor bigint,
  point_status text
)
language plpgsql
stable
security invoker
set search_path = ''
as $function$
declare
  v_user uuid;
  v_from date;
  v_to date;
  v_step integer;
begin
  v_user := (select auth.uid());
  if v_user is null then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.unauthenticated';
  end if;

  if p_club_id is not null and not private.is_active_club_member(p_club_id) then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.not_club_member';
  end if;

  if p_club_id is not null and not private.club_is_curated_v1_etf(p_club_id) then
    return;
  end if;

  if p_from is null or p_to is null or p_from > p_to then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.invalid_history_range';
  end if;

  v_step := coalesce(p_step_days, 7);
  if v_step < 1 or v_step > 31 then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.invalid_history_step';
  end if;

  v_to := least(p_to, (timezone('utc', now()))::date);
  v_from := p_from;
  if v_from > v_to then
    return;
  end if;

  if (v_to - v_from) > 400 then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.invalid_history_range';
  end if;

  return query
  with dates as (
    select gs::date as as_of_date
    from pg_catalog.generate_series(v_from, v_to, (v_step || ' days')::interval) as gs
    union
    select v_to
  ),
  lots as (
    select
      lot.transaction_id,
      lot.investment_target_id,
      lot.amount_minor,
      lot.lot_quantity,
      lot.reference_date
    from public.member_investment_lots_v1 as lot
    where lot.is_core_v1_etf
      and (p_club_id is null or lot.club_id = p_club_id)
  ),
  marked as (
    select
      dates.as_of_date,
      lots.amount_minor,
      lots.lot_quantity,
      fx.rate as fx_rate,
      close.price as eur_price
    from dates
    left join lots
      on lots.reference_date <= dates.as_of_date
    left join lateral public.fx_rate_as_of_v1(
      'EUR',
      'NOK',
      dates.as_of_date,
      public.reference_lookup_max_age_days_v1()
    ) as fx on lots.transaction_id is not null
    left join lateral public.marketstack_close_as_of_v1(
      lots.investment_target_id,
      dates.as_of_date,
      public.reference_lookup_max_age_days_v1()
    ) as close on lots.transaction_id is not null
  )
  select
    marked.as_of_date,
    coalesce(pg_catalog.sum(marked.amount_minor), 0)::bigint,
    case
      when pg_catalog.count(marked.amount_minor) = 0 then 0::numeric
      when pg_catalog.count(*) filter (
        where marked.lot_quantity is null
           or marked.fx_rate is null
           or marked.eur_price is null
      ) > 0 then null
      else pg_catalog.sum(marked.lot_quantity * marked.eur_price * marked.fx_rate)
    end,
    case
      when pg_catalog.count(marked.amount_minor) = 0 then 0::bigint
      when pg_catalog.count(*) filter (
        where marked.lot_quantity is null
           or marked.fx_rate is null
           or marked.eur_price is null
      ) > 0 then null
      else pg_catalog.round(pg_catalog.sum(marked.lot_quantity * marked.eur_price * marked.fx_rate) * 100)::bigint
    end,
    case
      when pg_catalog.count(marked.amount_minor) = 0 then 'available'
      when pg_catalog.count(*) filter (
        where marked.lot_quantity is null
           or marked.fx_rate is null
           or marked.eur_price is null
      ) > 0 then 'unavailable'
      else 'available'
    end
  from marked
  group by marked.as_of_date
  order by marked.as_of_date;
end;
$function$;

comment on function public.member_portfolio_history_v1(uuid, date, date, integer) is
  'Caller''s invested vs estimated value series. Each point uses only lots, FX, and closes on or before that date. Gaps when a lot cannot be valued. Legacy clubs return no rows.';

-- ---------------------------------------------------------------------------
-- Club aggregates: money only with >= 3 distinct contributors
-- ---------------------------------------------------------------------------

create function private.club_core_etf_lots_v1(p_club_id uuid)
returns table (
  transaction_id uuid,
  membership_id uuid,
  investment_target_id uuid,
  amount_minor bigint,
  exact_quantity numeric,
  reference_date date,
  modelled_quantity numeric,
  lot_quantity numeric,
  lot_quantity_source text
)
language sql
stable
security definer
set search_path = ''
as $function$
  select
    transaction.id,
    transaction.membership_id,
    transaction.investment_target_id,
    transaction.amount_minor,
    transaction.quantity,
    public.cycle_reference_date_v1(cycle.investment_day_at, cycle.timezone),
    case
      when transaction.quantity is not null then null
      when fx.rate is not null and fx.rate > 0 and close.price is not null and close.price > 0
      then (transaction.amount_minor::numeric / 100) / fx.rate / close.price
      else null
    end,
    case
      when transaction.quantity is not null then transaction.quantity
      when fx.rate is not null and fx.rate > 0 and close.price is not null and close.price > 0
      then (transaction.amount_minor::numeric / 100) / fx.rate / close.price
      else null
    end,
    case
      when transaction.quantity is not null then 'exact'
      when fx.rate is not null and fx.rate > 0 and close.price is not null and close.price > 0
      then 'estimated'
      else 'unavailable'
    end
  from public.member_investment_transactions as transaction
  join public.investment_cycles as cycle
    on cycle.id = transaction.investment_cycle_id
  left join lateral public.fx_rate_as_of_v1(
    'EUR',
    'NOK',
    public.cycle_reference_date_v1(cycle.investment_day_at, cycle.timezone),
    public.reference_lookup_max_age_days_v1()
  ) as fx on transaction.quantity is null
  left join lateral public.marketstack_close_as_of_v1(
    transaction.investment_target_id,
    public.cycle_reference_date_v1(cycle.investment_day_at, cycle.timezone),
    public.reference_lookup_max_age_days_v1()
  ) as close on transaction.quantity is null
  where transaction.club_id = p_club_id
    and transaction.transaction_type = 'buy'
    and transaction.investment_target_id = any (private.core_v1_etf_target_ids());
$function$;

create function private.club_estimated_portfolio_v1(p_club_id uuid)
returns table (
  club_id uuid,
  contributor_count integer,
  aggregate_visible boolean,
  modelling_scope text,
  invested_minor bigint,
  estimated_current_value_nok numeric,
  estimated_current_value_minor bigint,
  gain_loss_nok numeric,
  gain_loss_minor bigint,
  gain_loss_bps integer,
  valuation_confidence text
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_scope text;
  v_contributors integer;
  v_invested bigint;
  v_value numeric;
  v_confidence text;
  v_unavailable integer;
  v_exact integer;
  v_estimated integer;
  v_lots integer;
begin
  if (select auth.uid()) is null then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.unauthenticated';
  end if;

  if not private.is_active_club_member(p_club_id) then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.not_club_member';
  end if;

  if private.club_is_curated_v1_etf(p_club_id) then
    v_scope := 'curated_etf';
  else
    v_scope := 'legacy';
  end if;

  select
    pg_catalog.count(distinct lot.membership_id)::integer,
    pg_catalog.count(*)::integer,
    pg_catalog.count(*) filter (where lot.lot_quantity_source = 'exact')::integer,
    pg_catalog.count(*) filter (where lot.lot_quantity_source = 'estimated')::integer,
    pg_catalog.count(*) filter (where lot.lot_quantity_source = 'unavailable')::integer,
    coalesce(pg_catalog.sum(lot.amount_minor), 0)::bigint
  into
    v_contributors,
    v_lots,
    v_exact,
    v_estimated,
    v_unavailable,
    v_invested
  from private.club_core_etf_lots_v1(p_club_id) as lot;

  club_id := p_club_id;
  contributor_count := coalesce(v_contributors, 0);
  aggregate_visible := coalesce(v_contributors, 0) >= 3 and v_scope = 'curated_etf';
  modelling_scope := v_scope;

  if not aggregate_visible then
    invested_minor := null;
    estimated_current_value_nok := null;
    estimated_current_value_minor := null;
    gain_loss_nok := null;
    gain_loss_minor := null;
    gain_loss_bps := null;
    valuation_confidence := 'unavailable';
    return next;
    return;
  end if;

  if v_lots = 0 or v_unavailable > 0 then
    v_confidence := 'unavailable';
    v_value := null;
  elsif v_exact = v_lots then
    v_confidence := 'exact';
  elsif v_estimated = v_lots then
    v_confidence := 'estimated';
  else
    v_confidence := 'mixed';
  end if;

  if v_confidence is distinct from 'unavailable' then
    select pg_catalog.sum(lot.lot_quantity * latest_price.price * latest_fx.rate)
    into v_value
    from private.club_core_etf_lots_v1(p_club_id) as lot
    join public.investment_targets as target
      on target.id = lot.investment_target_id
    left join public.latest_market_price_status as latest_price
      on latest_price.investment_target_id = lot.investment_target_id
     and latest_price.provider = 'marketstack'
     and latest_price.price_type = 'close'
    left join public.latest_fx_rate_status as latest_fx
      on latest_fx.base_currency = 'EUR'
     and latest_fx.quote_currency = 'NOK'
     and latest_fx.provider = 'norges_bank'
    where latest_price.price is not null
      and latest_price.price > 0
      and latest_price.freshness = 'fresh'
      and latest_price.currency is not distinct from target.currency
      and latest_fx.rate is not null
      and latest_fx.rate > 0
      and latest_fx.freshness = 'fresh';

    if v_value is null then
      v_confidence := 'unavailable';
    end if;
  end if;

  invested_minor := v_invested;
  estimated_current_value_nok := v_value;
  estimated_current_value_minor := case when v_value is null then null else pg_catalog.round(v_value * 100) end;
  valuation_confidence := v_confidence;
  if v_value is not null then
    gain_loss_nok := v_value - (v_invested::numeric / 100);
    gain_loss_minor := pg_catalog.round(gain_loss_nok * 100);
    if v_invested > 0 then
      gain_loss_bps := pg_catalog.round((gain_loss_nok / (v_invested::numeric / 100)) * 10000)::integer;
    end if;
  end if;

  return next;
end;
$function$;

create function public.club_estimated_portfolio_v1(p_club_id uuid)
returns table (
  club_id uuid,
  contributor_count integer,
  aggregate_visible boolean,
  modelling_scope text,
  invested_minor bigint,
  estimated_current_value_nok numeric,
  estimated_current_value_minor bigint,
  gain_loss_nok numeric,
  gain_loss_minor bigint,
  gain_loss_bps integer,
  valuation_confidence text
)
language sql
stable
security invoker
set search_path = ''
as $function$
  select *
  from private.club_estimated_portfolio_v1(p_club_id);
$function$;

comment on function public.club_estimated_portfolio_v1(uuid) is
  'Club-wide estimated NOK totals. Monetary columns are null unless the caller is an active member and at least three distinct members have contributed. No per-member amounts are returned.';

create function private.club_portfolio_history_v1(
  p_club_id uuid,
  p_from date,
  p_to date,
  p_step_days integer
)
returns table (
  as_of_date date,
  contributor_count integer,
  aggregate_visible boolean,
  invested_minor bigint,
  estimated_value_nok numeric,
  estimated_value_minor bigint,
  point_status text
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_from date;
  v_to date;
  v_step integer;
begin
  if (select auth.uid()) is null then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.unauthenticated';
  end if;

  if not private.is_active_club_member(p_club_id) then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.not_club_member';
  end if;

  if not private.club_is_curated_v1_etf(p_club_id) then
    return;
  end if;

  if p_from is null or p_to is null or p_from > p_to then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.invalid_history_range';
  end if;

  v_step := coalesce(p_step_days, 7);
  if v_step < 1 or v_step > 31 then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.invalid_history_step';
  end if;

  v_to := least(p_to, (timezone('utc', now()))::date);
  v_from := p_from;
  if v_from > v_to or (v_to - v_from) > 400 then
    if v_from > v_to then
      return;
    end if;
    raise exception using
      errcode = 'P0001',
      message = 'vesty.invalid_history_range';
  end if;

  return query
  with dates as (
    select gs::date as as_of_date
    from pg_catalog.generate_series(v_from, v_to, (v_step || ' days')::interval) as gs
    union
    select v_to
  ),
  lots as (
    select *
    from private.club_core_etf_lots_v1(p_club_id)
  ),
  marked as (
    select
      dates.as_of_date,
      lots.membership_id,
      lots.amount_minor,
      lots.lot_quantity,
      fx.rate as fx_rate,
      close.price as eur_price
    from dates
    left join lots
      on lots.reference_date <= dates.as_of_date
    left join lateral public.fx_rate_as_of_v1(
      'EUR',
      'NOK',
      dates.as_of_date,
      public.reference_lookup_max_age_days_v1()
    ) as fx on lots.transaction_id is not null
    left join lateral public.marketstack_close_as_of_v1(
      lots.investment_target_id,
      dates.as_of_date,
      public.reference_lookup_max_age_days_v1()
    ) as close on lots.transaction_id is not null
  )
  select
    marked.as_of_date,
    pg_catalog.count(distinct marked.membership_id)::integer,
    (pg_catalog.count(distinct marked.membership_id) >= 3),
    case
      when pg_catalog.count(distinct marked.membership_id) < 3 then null
      else coalesce(pg_catalog.sum(marked.amount_minor), 0)::bigint
    end,
    case
      when pg_catalog.count(distinct marked.membership_id) < 3 then null
      when pg_catalog.count(marked.amount_minor) = 0 then 0::numeric
      when pg_catalog.count(*) filter (
        where marked.lot_quantity is null
           or marked.fx_rate is null
           or marked.eur_price is null
      ) > 0 then null
      else pg_catalog.sum(marked.lot_quantity * marked.eur_price * marked.fx_rate)
    end,
    case
      when pg_catalog.count(distinct marked.membership_id) < 3 then null
      when pg_catalog.count(marked.amount_minor) = 0 then 0::bigint
      when pg_catalog.count(*) filter (
        where marked.lot_quantity is null
           or marked.fx_rate is null
           or marked.eur_price is null
      ) > 0 then null
      else pg_catalog.round(pg_catalog.sum(marked.lot_quantity * marked.eur_price * marked.fx_rate) * 100)::bigint
    end,
    case
      when pg_catalog.count(distinct marked.membership_id) < 3 then 'hidden'
      when pg_catalog.count(marked.amount_minor) = 0 then 'available'
      when pg_catalog.count(*) filter (
        where marked.lot_quantity is null
           or marked.fx_rate is null
           or marked.eur_price is null
      ) > 0 then 'unavailable'
      else 'available'
    end
  from marked
  group by marked.as_of_date
  order by marked.as_of_date;
end;
$function$;

create function public.club_portfolio_history_v1(
  p_club_id uuid,
  p_from date,
  p_to date,
  p_step_days integer default 7
)
returns table (
  as_of_date date,
  contributor_count integer,
  aggregate_visible boolean,
  invested_minor bigint,
  estimated_value_nok numeric,
  estimated_value_minor bigint,
  point_status text
)
language sql
stable
security invoker
set search_path = ''
as $function$
  select *
  from private.club_portfolio_history_v1(p_club_id, p_from, p_to, p_step_days);
$function$;

comment on function public.club_portfolio_history_v1(uuid, date, date, integer) is
  'Club-wide invested vs estimated value series. Monetary values are null on dates with fewer than three distinct contributors.';

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------

revoke all on function public.reference_lookup_max_age_days_v1() from public, anon;
revoke all on function public.cycle_reference_date_v1(timestamptz, text) from public, anon;
revoke all on function public.fx_rate_as_of_v1(text, text, date, integer) from public, anon;
revoke all on function public.marketstack_close_as_of_v1(uuid, date, integer) from public, anon;
revoke all on function private.latest_strategy_version_id_v1(uuid) from public, anon, authenticated;
revoke all on function private.club_is_curated_v1_etf(uuid) from public, anon;
revoke all on function private.member_core_etf_portfolio_totals_v1(uuid) from public, anon;
revoke all on function private.club_core_etf_lots_v1(uuid) from public, anon, authenticated;
revoke all on function private.club_estimated_portfolio_v1(uuid) from public, anon;
revoke all on function private.club_portfolio_history_v1(uuid, date, date, integer) from public, anon;
revoke all on function public.member_estimated_portfolio_v1(uuid) from public, anon;
revoke all on function public.member_estimated_portfolios_v1() from public, anon;
revoke all on function public.member_portfolio_history_v1(uuid, date, date, integer) from public, anon;
revoke all on function public.club_estimated_portfolio_v1(uuid) from public, anon;
revoke all on function public.club_portfolio_history_v1(uuid, date, date, integer) from public, anon;

grant execute on function private.core_v1_etf_target_ids() to authenticated;
grant execute on function private.club_is_curated_v1_etf(uuid) to authenticated;
grant execute on function private.member_core_etf_portfolio_totals_v1(uuid) to authenticated;
grant execute on function private.club_estimated_portfolio_v1(uuid) to authenticated;
grant execute on function private.club_portfolio_history_v1(uuid, date, date, integer) to authenticated;
grant execute on function public.reference_lookup_max_age_days_v1() to authenticated;
grant execute on function public.cycle_reference_date_v1(timestamptz, text) to authenticated;
grant execute on function public.fx_rate_as_of_v1(text, text, date, integer) to authenticated;
grant execute on function public.marketstack_close_as_of_v1(uuid, date, integer) to authenticated;
grant execute on function public.member_estimated_portfolio_v1(uuid) to authenticated;
grant execute on function public.member_estimated_portfolios_v1() to authenticated;
grant execute on function public.member_portfolio_history_v1(uuid, date, date, integer) to authenticated;
grant execute on function public.club_estimated_portfolio_v1(uuid) to authenticated;
grant execute on function public.club_portfolio_history_v1(uuid, date, date, integer) to authenticated;
