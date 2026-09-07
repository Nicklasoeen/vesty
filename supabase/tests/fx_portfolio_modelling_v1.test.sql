begin;

create extension if not exists pgtap with schema extensions;

create schema if not exists tests;
grant usage on schema tests to authenticated;

create function tests.authenticate_as(p_user_id uuid)
returns void
language plpgsql
volatile
security invoker
set search_path = ''
as $function$
begin
  perform pg_catalog.set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.json_build_object('sub', p_user_id, 'role', 'authenticated')::text,
    true
  );
end;
$function$;

create function tests.statement_sqlstate(p_statement text)
returns text
language plpgsql
volatile
security invoker
set search_path = ''
as $function$
begin
  execute p_statement;
  return null;
exception
  when others then
    return sqlstate;
end;
$function$;

grant execute on function tests.authenticate_as(uuid) to authenticated;
grant execute on function tests.statement_sqlstate(text) to authenticated;

select extensions.no_plan();

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '00000000-0000-4000-8000-000000000081',
    'authenticated', 'authenticated', 'alice-fx@example.test', '', now(),
    '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-4000-8000-000000000082',
    'authenticated', 'authenticated', 'bob-fx@example.test', '', now(),
    '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-4000-8000-000000000083',
    'authenticated', 'authenticated', 'cara-fx@example.test', '', now(),
    '{}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.profiles (id, display_name)
values
  ('00000000-0000-4000-8000-000000000081', 'Alice FX'),
  ('00000000-0000-4000-8000-000000000082', 'Bob FX'),
  ('00000000-0000-4000-8000-000000000083', 'Cara FX');

delete from public.fx_rates
where provider = 'norges_bank'
  and base_currency = 'EUR'
  and quote_currency = 'NOK';

insert into public.fx_rates (base_currency, quote_currency, rate, rate_date, provider)
values
  ('EUR', 'NOK', 12.00000000, date '2026-01-15', 'norges_bank'),
  ('EUR', 'NOK', 12.10000000, date '2026-01-16', 'norges_bank'),
  ('EUR', 'NOK', 12.50000000, current_date, 'norges_bank');

select extensions.is(
  (select rate from public.fx_rate_as_of_v1('EUR', 'NOK', date '2026-01-15')),
  12.00000000::numeric,
  'EUR/NOK rate is stored and read as exact decimal'
);

select extensions.is(
  (select rate from public.fx_rate_as_of_v1('EUR', 'NOK', date '2026-01-17')),
  12.10000000::numeric,
  'Weekend fallback uses the most recent prior business-day rate'
);

select extensions.is(
  (select rate_date from public.fx_rate_as_of_v1('EUR', 'NOK', date '2026-01-15')),
  date '2026-01-15',
  'As-of lookup never uses a later FX print'
);

select extensions.is(
  (select rate from public.fx_rate_as_of_v1('EUR', 'NOK', date '2026-01-01')),
  null,
  'Missing rate outside the fallback window is unavailable'
);

select extensions.is(
  tests.statement_sqlstate(
    $statement$
      insert into public.fx_rates (base_currency, quote_currency, rate, rate_date, provider)
      values ('NOK', 'EUR', 0.08000000, date '2026-01-14', 'norges_bank')
    $statement$
  ),
  '23514',
  'Inverted NOK/EUR rows are rejected'
);

set local role authenticated;
select tests.authenticate_as('00000000-0000-4000-8000-000000000081');

select extensions.ok(
  not has_table_privilege('authenticated', 'public.fx_rates', 'insert'),
  'Authenticated role cannot insert authoritative FX rates'
);

select extensions.ok(
  not has_table_privilege('authenticated', 'public.fx_rates', 'update'),
  'Authenticated role cannot update authoritative FX rates'
);

create temporary table alice_club as
select *
from public.create_club('FX Model Club', 'simple_majority', 'world_mix', 'NOK');

select *
from public.create_member_contribution_commitment_v1(
  (select club_id from alice_club),
  200000
);

create temporary table alice_day as
select *
from public.ensure_open_investment_day_v1((select club_id from alice_club));

create temporary table alice_confirm as
select *
from public.report_investment_day_v1(
  (select club_id from alice_club),
  (select cycle_id from alice_day),
  '82000000-0000-4000-8000-000000000001'::uuid,
  'as_planned',
  'confirmed',
  '[]'::jsonb
);

reset role;

update public.investment_cycles
set
  investment_day_at = timestamptz '2026-01-15 12:00:00+01',
  configuration_deadline_at = timestamptz '2026-01-14 12:00:00+01',
  reporting_opens_at = timestamptz '2026-01-15 12:00:00+01',
  reporting_closes_at = timestamptz '2026-01-22 12:00:00+01',
  timezone = 'Europe/Oslo'
where id = (select cycle_id from alice_day);

delete from public.market_prices
where provider = 'marketstack'
  and (
    (
      investment_target_id in (
        '31000000-0000-4000-8000-000000000011',
        '31000000-0000-4000-8000-000000000012',
        '31000000-0000-4000-8000-000000000013'
      )
      and (
        price_date between date '2026-01-01' and date '2026-01-31'
        or price_date = current_date
      )
    )
    or investment_target_id = '31000000-0000-4000-8000-000000000014'
  );

insert into public.market_prices (
  investment_target_id, provider, price_date, price, currency, price_type
)
values
  ('31000000-0000-4000-8000-000000000011', 'marketstack', date '2026-01-15', 100.00000000, 'EUR', 'close'),
  ('31000000-0000-4000-8000-000000000012', 'marketstack', date '2026-01-15', 50.00000000, 'EUR', 'close'),
  ('31000000-0000-4000-8000-000000000013', 'marketstack', date '2026-01-15', 30.00000000, 'EUR', 'close'),
  ('31000000-0000-4000-8000-000000000011', 'marketstack', date '2026-01-16', 101.00000000, 'EUR', 'close'),
  ('31000000-0000-4000-8000-000000000011', 'marketstack', current_date, 110.00000000, 'EUR', 'close'),
  ('31000000-0000-4000-8000-000000000012', 'marketstack', current_date, 55.00000000, 'EUR', 'close'),
  ('31000000-0000-4000-8000-000000000013', 'marketstack', current_date, 33.00000000, 'EUR', 'close');

set local role authenticated;
select tests.authenticate_as('00000000-0000-4000-8000-000000000081');

select extensions.is(
  (
    select quantity
    from public.member_investment_transactions
    where membership_id = (select membership_id from alice_club)
      and investment_target_id = '31000000-0000-4000-8000-000000000011'
  ),
  null,
  'Amount-only confirmation still stores quantity as null'
);

select extensions.is(
  (
    select modelled_quantity
    from public.member_investment_lots_v1
    where membership_id = (select membership_id from alice_club)
      and investment_target_id = '31000000-0000-4000-8000-000000000011'
  ),
  1.00000000::numeric,
  'NOK contribution / historical EUR/NOK / historical close yields exact modelled quantity'
);

select extensions.is(
  (
    select lot_quantity_source
    from public.member_investment_lots_v1
    where membership_id = (select membership_id from alice_club)
      and investment_target_id = '31000000-0000-4000-8000-000000000011'
  ),
  'estimated',
  'Amount-only lots are estimated, not exact holdings'
);

select extensions.is(
  (
    select reference_date
    from public.member_investment_lots_v1
    where membership_id = (select membership_id from alice_club)
      and investment_target_id = '31000000-0000-4000-8000-000000000011'
  ),
  date '2026-01-15',
  'Modelled purchase uses the Investment Day date, not today'
);

select extensions.is(
  (
    select reference_eur_price
    from public.member_investment_lots_v1
    where membership_id = (select membership_id from alice_club)
      and investment_target_id = '31000000-0000-4000-8000-000000000011'
  ),
  100.00000000::numeric,
  'Historical modelled quantity uses the Investment Day close, not the latest close'
);

reset role;

insert into public.market_prices (
  investment_target_id, provider, price_date, price, currency, price_type
)
values
  ('31000000-0000-4000-8000-000000000014', 'marketstack', date '2026-01-20', 80.00000000, 'EUR', 'close');

set local role authenticated;
select tests.authenticate_as('00000000-0000-4000-8000-000000000081');

select extensions.is(
  (
    select price
    from public.marketstack_close_as_of_v1(
      '31000000-0000-4000-8000-000000000014'::uuid,
      date '2026-01-15'
    )
  ),
  null,
  'Future market rows are ignored for a past as-of date'
);

select extensions.is(
  (
    select estimated_current_value_nok
    from public.member_estimated_positions_v1
    where membership_id = (select membership_id from alice_club)
      and investment_target_id = '31000000-0000-4000-8000-000000000011'
  ),
  1375.00000000::numeric,
  'Current NOK value is modelled quantity × latest EUR close × latest EUR/NOK'
);

select extensions.is(
  (
    select valuation_confidence
    from public.member_estimated_portfolio_v1((select club_id from alice_club))
  ),
  'estimated',
  'All modelled lots produce estimated confidence'
);

select extensions.is(
  (
    select gain_loss_nok
    from public.member_estimated_portfolio_v1((select club_id from alice_club))
  ),
  (
    (1::numeric * 110 * 12.5)
    + ((50000::numeric / 100 / 12 / 50) * 55 * 12.5)
    + ((30000::numeric / 100 / 12 / 30) * 33 * 12.5)
    - 2000
  ),
  'Estimated gain/loss NOK is exact against reported invested NOK'
);

select extensions.is(
  (
    select gain_loss_bps
    from public.member_estimated_portfolio_v1((select club_id from alice_club))
  ),
  pg_catalog.round((
    (
      (1::numeric * 110 * 12.5)
      + ((50000::numeric / 100 / 12 / 50) * 55 * 12.5)
      + ((30000::numeric / 100 / 12 / 30) * 33 * 12.5)
      - 2000
    ) / 2000
  ) * 10000)::integer,
  'Gain/loss percentage is rounded to basis points from exact NOK amounts'
);

select extensions.is(
  (
    select invested_minor
    from public.member_portfolio_history_v1(
      (select club_id from alice_club),
      date '2026-01-08',
      date '2026-01-08',
      1
    )
  ),
  0::bigint,
  'A future contribution does not appear on an earlier chart date'
);

select extensions.is(
  (
    select pg_catalog.round(estimated_value_nok, 8)
    from public.member_portfolio_history_v1(
      (select club_id from alice_club),
      date '2026-01-15',
      date '2026-01-15',
      1
    )
  ),
  2000.00000000::numeric,
  'Historical chart value uses historical FX and closes, not today'
);

select extensions.is(
  (
    select estimated_value_nok
    from public.member_portfolio_history_v1(
      (select club_id from alice_club),
      date '2026-01-17',
      date '2026-01-17',
      1
    )
  ),
  (
    (1.0 * 101.0 * 12.1)
    + ((50000::numeric / 100 / 12 / 50) * 50.0 * 12.1)
    + ((30000::numeric / 100 / 12 / 30) * 30.0 * 12.1)
  ),
  'Missing Saturday market/FX prints fall back to the prior valid business day'
);

create temporary table alice_invite as
select *
from public.create_club_invitation((select club_id from alice_club));

select tests.authenticate_as('00000000-0000-4000-8000-000000000082');

select extensions.is(
  (
    select count(*)
    from public.member_investment_lots_v1
    where membership_id = (select membership_id from alice_club)
  ),
  0::bigint,
  'Another member cannot read private modelled lots or valuations'
);

create temporary table bob_join as
select *
from public.accept_club_invitation((select invite_token from alice_invite));

select extensions.ok(
  to_regprocedure('public.club_estimated_portfolio_v1(uuid)') is null,
  'Club monetary total RPC is not exposed'
);

select extensions.ok(
  to_regprocedure('public.club_portfolio_history_v1(uuid,date,date,integer)') is null,
  'Club monetary history RPC is not exposed'
);

reset role;

update public.member_investment_transactions
set quantity = 2
where membership_id = (select membership_id from alice_club)
  and investment_target_id = '31000000-0000-4000-8000-000000000011';

set local role authenticated;
select tests.authenticate_as('00000000-0000-4000-8000-000000000081');

select extensions.is(
  (
    select exact_quantity
    from public.member_investment_lots_v1
    where membership_id = (select membership_id from alice_club)
      and investment_target_id = '31000000-0000-4000-8000-000000000011'
  ),
  2::numeric,
  'Member-reported quantity takes precedence over modelled quantity'
);

select extensions.is(
  (
    select modelled_quantity
    from public.member_investment_lots_v1
    where membership_id = (select membership_id from alice_club)
      and investment_target_id = '31000000-0000-4000-8000-000000000011'
  ),
  null,
  'Exact lots are not also modelled'
);

select extensions.is(
  (
    select valuation_confidence
    from public.member_estimated_portfolio_v1((select club_id from alice_club))
  ),
  'mixed',
  'Exact plus estimated lots produce mixed confidence'
);

select extensions.is(
  (
    select estimated_current_value_nok
    from public.member_estimated_positions_v1
    where membership_id = (select membership_id from alice_club)
      and investment_target_id = '31000000-0000-4000-8000-000000000011'
  ),
  2750.00000000::numeric,
  'Exact lot current value uses reported quantity, not the discarded model'
);

reset role;

delete from public.market_prices
where investment_target_id = '31000000-0000-4000-8000-000000000012'
  and provider = 'marketstack'
  and price_type = 'close'
  and price_date = current_date;

set local role authenticated;
select tests.authenticate_as('00000000-0000-4000-8000-000000000081');

select extensions.is(
  (
    select invested_minor
    from public.member_estimated_portfolio_v1((select club_id from alice_club))
  ),
  200000::bigint,
  'Reported invested amount remains known when one current price is missing'
);

select extensions.is(
  (
    select estimated_current_value_nok
    from public.member_estimated_portfolio_v1((select club_id from alice_club))
  ),
  null,
  'One missing current price makes the complete member value unavailable'
);

select extensions.is(
  (
    select gain_loss_minor
    from public.member_estimated_portfolio_v1((select club_id from alice_club))
  ),
  null,
  'Unavailable complete value does not produce a gain or loss amount'
);

select extensions.is(
  (
    select gain_loss_bps
    from public.member_estimated_portfolio_v1((select club_id from alice_club))
  ),
  null,
  'Unavailable complete value does not produce a return percentage'
);

reset role;

insert into public.market_prices (
  investment_target_id, provider, price_date, price, currency, price_type
)
values (
  '31000000-0000-4000-8000-000000000012',
  'marketstack',
  current_date,
  55.00000000,
  'EUR',
  'close'
);

insert into public.clubs (
  id, name, status, base_currency, governance_threshold_kind, current_owner_membership_id
)
values (
  '21000000-0000-4000-8000-000000000081',
  'Legacy FX Guard Club',
  'active',
  'NOK',
  'simple_majority',
  '22000000-0000-4000-8000-000000000081'
);

insert into public.club_memberships (id, club_id, profile_id, status)
values (
  '22000000-0000-4000-8000-000000000081',
  '21000000-0000-4000-8000-000000000081',
  '00000000-0000-4000-8000-000000000081',
  'active'
);

insert into public.strategy_versions (
  id, club_id, version_number, created_by_membership_id, origin, source_proposal_id, approved_at, effective_at
)
values (
  '23000000-0000-4000-8000-000000000081',
  '21000000-0000-4000-8000-000000000081',
  1,
  '22000000-0000-4000-8000-000000000081',
  'genesis',
  null,
  null,
  now()
);

insert into public.strategy_allocations (
  strategy_version_id, investment_target_id, allocation_bps, position,
  target_name, target_kind, target_isin, target_ticker, target_exchange
)
select
  '23000000-0000-4000-8000-000000000081',
  target.id,
  allocation.allocation_bps,
  allocation.position,
  target.name,
  target.kind,
  target.isin,
  target.ticker,
  target.exchange
from (
  values
    ('31000000-0000-4000-8000-000000000001'::uuid, 4000, 1),
    ('31000000-0000-4000-8000-000000000002'::uuid, 3000, 2),
    ('31000000-0000-4000-8000-000000000003'::uuid, 1500, 3),
    ('31000000-0000-4000-8000-000000000004'::uuid, 1500, 4)
) as allocation(investment_target_id, allocation_bps, position)
join public.investment_targets as target
  on target.id = allocation.investment_target_id;

insert into public.contribution_policy_versions (
  club_id, version_number, mode, currency, equal_amount_minor, created_by_membership_id
)
values (
  '21000000-0000-4000-8000-000000000081',
  1,
  'flexible',
  'NOK',
  null,
  '22000000-0000-4000-8000-000000000081'
);

insert into public.member_contribution_commitment_versions (
  club_id, membership_id, version_number, amount_minor, currency
)
values (
  '21000000-0000-4000-8000-000000000081',
  '22000000-0000-4000-8000-000000000081',
  1,
  200000,
  'NOK'
);

set local role authenticated;
select tests.authenticate_as('00000000-0000-4000-8000-000000000081');

create temporary table alice_legacy_day as
select *
from public.ensure_open_investment_day_v1('21000000-0000-4000-8000-000000000081');

create temporary table alice_legacy_confirm as
select *
from public.report_investment_day_v1(
  '21000000-0000-4000-8000-000000000081',
  (select cycle_id from alice_legacy_day),
  '82000000-0000-4000-8000-000000000002'::uuid,
  'as_planned',
  'confirmed',
  '[]'::jsonb
);

select extensions.is(
  (
    select modelling_scope
    from public.member_estimated_portfolio_v1('21000000-0000-4000-8000-000000000081')
  ),
  'legacy',
  'Legacy KLP/DNB clubs stay on the non-modelled path'
);

select extensions.is(
  (
    select count(*)
    from public.member_investment_lots_v1
    where club_id = '21000000-0000-4000-8000-000000000081'
      and modelled_quantity is not null
  ),
  0::bigint,
  'Legacy fund contributions are not modelled from ETF prices'
);

select extensions.is(
  (
    select count(*)
    from public.member_portfolio_history_v1(
      '21000000-0000-4000-8000-000000000081',
      date '2026-01-01',
      date '2026-01-15',
      7
    )
  ),
  0::bigint,
  'Legacy clubs do not receive an estimated ETF chart series'
);

reset role;

insert into public.member_investment_transactions (
  club_id, membership_id, investment_cycle_id, investment_target_id,
  transaction_type, amount_minor, currency, quantity, executed_at, source, verification_status,
  amount_provenance
)
select
  (select club_id from alice_club),
  (select membership_id from bob_join),
  (select cycle_id from alice_day),
  '31000000-0000-4000-8000-000000000012',
  'buy',
  40000,
  'NOK',
  null,
  now(),
  'manual',
  'member_reported',
  'legacy_plan_assumed';

insert into public.club_memberships (id, club_id, profile_id, status)
values (
  '22000000-0000-4000-8000-000000000083',
  (select club_id from alice_club),
  '00000000-0000-4000-8000-000000000083',
  'active'
);

insert into public.member_investment_transactions (
  club_id, membership_id, investment_cycle_id, investment_target_id,
  transaction_type, amount_minor, currency, quantity, executed_at, source, verification_status,
  amount_provenance
)
select
  (select club_id from alice_club),
  '22000000-0000-4000-8000-000000000083',
  (select cycle_id from alice_day),
  '31000000-0000-4000-8000-000000000011',
  'buy',
  60000,
  'NOK',
  null,
  now(),
  'manual',
  'member_reported',
  'legacy_plan_assumed';

set local role authenticated;
select tests.authenticate_as('00000000-0000-4000-8000-000000000081');

select extensions.ok(
  to_regprocedure('public.club_estimated_portfolio_v1(uuid)') is null,
  'Flexible members cannot fetch a club monetary total after three members contribute'
);

select extensions.ok(
  to_regprocedure('public.club_portfolio_history_v1(uuid,date,date,integer)') is null,
  'Flexible members cannot fetch club monetary history after three members contribute'
);

select extensions.is(
  (
    select invested_minor
    from public.member_estimated_portfolio_v1((select club_id from alice_club))
  ),
  200000::bigint,
  'The caller can still read only their own reported invested amount'
);

select * from extensions.finish();
rollback;
