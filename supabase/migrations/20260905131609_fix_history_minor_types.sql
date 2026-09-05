create or replace function public.member_portfolio_history_v1(
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

create or replace function private.club_portfolio_history_v1(
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

