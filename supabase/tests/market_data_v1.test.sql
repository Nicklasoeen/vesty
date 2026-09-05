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
  perform pg_catalog.set_config(
    'request.jwt.claim.sub',
    p_user_id::text,
    true
  );
  perform pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.json_build_object(
      'sub', p_user_id,
      'role', 'authenticated'
    )::text,
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
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-4000-8000-000000000041',
    'authenticated',
    'authenticated',
    'alice-market@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000000042',
    'authenticated',
    'authenticated',
    'bob-market@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

insert into public.profiles (id, display_name)
values
  ('00000000-0000-4000-8000-000000000041', 'Alice Market'),
  ('00000000-0000-4000-8000-000000000042', 'Bob Market');

select extensions.is(
  (
    select isin
    from public.investment_targets
    where id = '31000000-0000-4000-8000-000000000001'
  ),
  'NO0010776040',
  'KLP AksjeGlobal Indeks P has the verified ISIN'
);

select extensions.is(
  (
    select isin
    from public.investment_targets
    where id = '31000000-0000-4000-8000-000000000002'
  ),
  'NO0010337678',
  'DNB Teknologi A has the verified ISIN'
);

select extensions.is(
  (
    select isin
    from public.investment_targets
    where id = '31000000-0000-4000-8000-000000000003'
  ),
  'NO0010455694',
  'KLP AksjeNorge Indeks P has the verified ISIN'
);

select extensions.is(
  (
    select name || '|' || isin
    from public.investment_targets
    where id = '31000000-0000-4000-8000-000000000004'
  ),
  'KLP AksjeFremvoksende Markeder Indeks P|NO0010611809',
  'Emerging-markets fixture uses the official Indeks P share class and ISIN'
);

select extensions.is(
  (
    select count(*)
    from public.investment_targets
    where id in (
      '31000000-0000-4000-8000-000000000001',
      '31000000-0000-4000-8000-000000000002',
      '31000000-0000-4000-8000-000000000003',
      '31000000-0000-4000-8000-000000000004'
    )
      and currency = 'NOK'
      and kind = 'fund'
      and ticker is null
      and exchange is null
      and provider_symbol is null
  ),
  4::bigint,
  'Verified funds stay NOK mutual funds without stock-style tickers'
);

select extensions.is(
  (
    select provider_instrument_id
    from public.market_data_instrument_mappings
    where id = '41000000-0000-4000-8000-000000000001'
      and active
  ),
  '0P00018V9L.IR',
  'Yahoo unofficial mapping belongs to the verified global index fund'
);

select extensions.is(
  (
    select count(*)
    from public.market_data_instrument_mappings
    where provider = 'twelve_data'
      and active
  ),
  0::bigint,
  'Twelve Data mappings stay inactive until NAV coverage is proven'
);

select extensions.is(
  (
    select count(*)
    from public.market_data_instrument_mappings
    where provider = 'marketstack'
      and active
  ),
  5::bigint,
  'Exactly five active Marketstack V1 mappings are seeded'
);

select extensions.is(
  (
    select string_agg(provider_instrument_id, ',' order by provider_instrument_id)
    from public.market_data_instrument_mappings
    where provider = 'marketstack'
      and active
  ),
  'EUNK.DE,IS3N.DE,SXR8.DE,SXRV.DE,VWCE.DE',
  'Marketstack provider symbols are the exact approved Xetra listings'
);

select extensions.is(
  (
    select count(*)
    from public.market_data_instrument_mappings
    where provider = 'marketstack'
      and active
      and (
        (investment_target_id = '31000000-0000-4000-8000-000000000011' and provider_instrument_id = 'VWCE.DE')
        or (investment_target_id = '31000000-0000-4000-8000-000000000012' and provider_instrument_id = 'EUNK.DE')
        or (investment_target_id = '31000000-0000-4000-8000-000000000013' and provider_instrument_id = 'IS3N.DE')
        or (investment_target_id = '31000000-0000-4000-8000-000000000014' and provider_instrument_id = 'SXR8.DE')
        or (investment_target_id = '31000000-0000-4000-8000-000000000015' and provider_instrument_id = 'SXRV.DE')
      )
  ),
  5::bigint,
  'Marketstack mappings point at the five CORE V1 ETF targets'
);

select extensions.is(
  (
    select count(*)
    from public.market_data_instrument_mappings
    where provider = 'marketstack'
      and active
      and investment_target_id in (
        '31000000-0000-4000-8000-000000000001',
        '31000000-0000-4000-8000-000000000002',
        '31000000-0000-4000-8000-000000000003',
        '31000000-0000-4000-8000-000000000004'
      )
  ),
  0::bigint,
  'Legacy KLP/DNB targets have no active Marketstack mapping'
);

select extensions.is(
  (
    select count(*)
    from public.market_data_instrument_mappings
    where investment_target_id in (
      '31000000-0000-4000-8000-000000000001',
      '31000000-0000-4000-8000-000000000002',
      '31000000-0000-4000-8000-000000000003',
      '31000000-0000-4000-8000-000000000004'
    )
      and active
  ),
  4::bigint,
  'Exactly one active mapping exists per TestFlight target'
);

select extensions.is(
  tests.statement_sqlstate($sql$
    update public.market_data_instrument_mappings
    set active = true
    where id = '41000000-0000-4000-8000-000000000011';
  $sql$),
  '23505',
  'A second active mapping for the same target is rejected'
);

select extensions.is(
  public.market_nav_freshness_v1(date '2026-09-04', timestamptz '2026-09-05 12:00:00+00'),
  'fresh',
  'Friday NAV stays fresh over the weekend'
);

select extensions.is(
  public.market_nav_freshness_v1(date '2026-08-20', timestamptz '2026-09-05 12:00:00+00'),
  'stale',
  'NAV older than the weekday plus holiday buffer is stale'
);

select extensions.is(
  public.market_nav_freshness_v1(null::date, timestamptz '2026-09-05 12:00:00+00'),
  'unavailable',
  'Missing NAV is unavailable rather than a fake price'
);

insert into public.market_prices (
  investment_target_id,
  provider,
  price_date,
  price,
  currency,
  price_type
)
values (
  '31000000-0000-4000-8000-000000000001',
  'yahoo_unofficial',
  date '2026-08-29',
  3935.98000000,
  'NOK',
  'nav'
);

insert into public.market_prices (
  investment_target_id,
  provider,
  price_date,
  price,
  currency,
  price_type
)
values (
  '31000000-0000-4000-8000-000000000001',
  'yahoo_unofficial',
  date '2026-08-29',
  3935.98000000,
  'NOK',
  'nav'
)
on conflict on constraint market_prices_observation_key
do update
set
  price = excluded.price,
  fetched_at = now();

select extensions.is(
  (
    select count(*)
    from public.market_prices
    where investment_target_id = '31000000-0000-4000-8000-000000000001'
      and provider = 'yahoo_unofficial'
      and price_date = date '2026-08-29'
      and price_type = 'nav'
  ),
  1::bigint,
  'Duplicate NAV observations upsert instead of inserting a second row'
);

select extensions.is(
  tests.statement_sqlstate($sql$
    insert into public.market_prices (
      investment_target_id,
      provider,
      price_date,
      price,
      currency,
      price_type
    )
    values (
      '31000000-0000-4000-8000-000000000001',
      'yahoo_unofficial',
      date '2026-08-28',
      0,
      'NOK',
      'nav'
    );
  $sql$),
  '23514',
  'Non-positive prices are rejected'
);

select extensions.is(
  tests.statement_sqlstate($sql$
    insert into public.market_prices (
      investment_target_id,
      provider,
      price_date,
      price,
      currency,
      price_type
    )
    values (
      '31000000-0000-4000-8000-000000000001',
      'yahoo_unofficial',
      date '2026-08-28',
      100.12,
      'USD',
      'nav'
    );
  $sql$),
  'P0001',
  'Provider currency that does not match the target is rejected'
);

select extensions.is(
  tests.statement_sqlstate($sql$
    insert into public.market_prices (
      investment_target_id,
      provider,
      price_date,
      price,
      currency,
      price_type
    )
    values (
      '31000000-0000-4000-8000-000000000001',
      'twelve_data',
      date '2026-08-28',
      100.12,
      'NOK',
      'nav'
    );
  $sql$),
  'P0001',
  'Prices cannot be stored against an inactive or missing mapping'
);

insert into public.market_prices (
  investment_target_id,
  provider,
  price_date,
  price,
  currency,
  price_type
)
values (
  '31000000-0000-4000-8000-000000000011',
  'marketstack',
  date '2026-09-03',
  168.06000000,
  'EUR',
  'close'
);

insert into public.market_prices (
  investment_target_id,
  provider,
  price_date,
  price,
  currency,
  price_type
)
values (
  '31000000-0000-4000-8000-000000000011',
  'marketstack',
  date '2026-09-03',
  168.06000000,
  'EUR',
  'close'
)
on conflict on constraint market_prices_observation_key
do update
set
  price = excluded.price,
  fetched_at = now();

select extensions.is(
  (
    select count(*)
    from public.market_prices
    where investment_target_id = '31000000-0000-4000-8000-000000000011'
      and provider = 'marketstack'
      and price_date = date '2026-09-03'
      and price_type = 'close'
  ),
  1::bigint,
  'Duplicate Marketstack EOD rows upsert instead of inserting a second row'
);

select extensions.is(
  tests.statement_sqlstate($sql$
    insert into public.market_prices (
      investment_target_id,
      provider,
      price_date,
      price,
      currency,
      price_type
    )
    values (
      '31000000-0000-4000-8000-000000000011',
      'marketstack',
      date '2026-09-02',
      12,
      'USD',
      'close'
    );
  $sql$),
  'P0001',
  'A later invalid Marketstack row does not write and leaves existing EUR closes intact'
);

select extensions.is(
  (
    select count(*)
    from public.market_prices
    where investment_target_id = '31000000-0000-4000-8000-000000000011'
      and provider = 'marketstack'
  ),
  1::bigint,
  'Existing good Marketstack data survives a later validation failure'
);

select extensions.is(
  public.market_nav_freshness_v1(date '2026-09-03', timestamptz '2026-09-05 12:00:00+00'),
  'fresh',
  'A recent ETF EOD date stays fresh over the weekend'
);

set local role authenticated;
select tests.authenticate_as('00000000-0000-4000-8000-000000000041');

select extensions.is(
  (
    select currency
    from public.latest_market_prices
    where investment_target_id = '31000000-0000-4000-8000-000000000001'
      and provider = 'yahoo_unofficial'
  ),
  'NOK',
  'Authenticated users can read latest persisted NAV'
);

select extensions.is(
  tests.statement_sqlstate($sql$
    insert into public.market_prices (
      investment_target_id,
      provider,
      price_date,
      price,
      currency,
      price_type
    )
    values (
      '31000000-0000-4000-8000-000000000002',
      'yahoo_unofficial',
      date '2026-08-29',
      7434.68,
      'NOK',
      'nav'
    );
  $sql$),
  '42501',
  'Authenticated mobile users cannot insert market prices'
);

select extensions.is(
  tests.statement_sqlstate($sql$
    insert into public.market_prices (
      investment_target_id,
      provider,
      price_date,
      price,
      currency,
      price_type
    )
    values (
      '31000000-0000-4000-8000-000000000012',
      'marketstack',
      date '2026-09-03',
      105.5,
      'EUR',
      'close'
    );
  $sql$),
  '42501',
  'Authenticated mobile users cannot insert Marketstack prices'
);

select extensions.is(
  tests.statement_sqlstate($sql$
    update public.market_prices
    set price = 1
    where investment_target_id = '31000000-0000-4000-8000-000000000001';
  $sql$),
  '42501',
  'Authenticated mobile users cannot update market prices'
);

select extensions.is(
  tests.statement_sqlstate($sql$
    delete from public.market_prices
    where investment_target_id = '31000000-0000-4000-8000-000000000001';
  $sql$),
  '42501',
  'Authenticated mobile users cannot delete market prices'
);

select extensions.is(
  tests.statement_sqlstate($sql$
    insert into public.market_data_instrument_mappings (
      investment_target_id,
      provider,
      provider_instrument_id,
      active
    )
    values (
      '31000000-0000-4000-8000-000000000002',
      'twelve_data',
      '0P00000MVB',
      true
    );
  $sql$),
  '42501',
  'Authenticated mobile users cannot insert provider mappings'
);

select extensions.is(
  tests.statement_sqlstate($sql$
    update public.market_data_instrument_mappings
    set active = true
    where provider = 'twelve_data';
  $sql$),
  '42501',
  'Authenticated mobile users cannot activate provider mappings'
);

select extensions.is(
  tests.statement_sqlstate($sql$
    delete from public.market_data_instrument_mappings
    where provider = 'yahoo_unofficial';
  $sql$),
  '42501',
  'Authenticated mobile users cannot delete provider mappings'
);

select extensions.ok(
  (
    select freshness in ('fresh', 'stale', 'unavailable')
    from public.latest_market_price_status
    where investment_target_id = '31000000-0000-4000-8000-000000000001'
      and provider = 'yahoo_unofficial'
  ),
  'Authenticated users can read freshness metadata for persisted NAV'
);

select extensions.is(
  (
    select count(*)
    from information_schema.table_privileges
    where grantee = 'authenticated'
      and table_schema = 'public'
      and table_name = 'member_investment_transactions'
      and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
  ),
  0::bigint,
  'Market-data work does not grant transaction writes to authenticated clients'
);

reset role;

select extensions.is(
  has_table_privilege('anon', 'public.market_prices', 'SELECT'),
  false,
  'Anonymous clients have no SELECT grant on market prices'
);

select extensions.is(
  has_table_privilege('anon', 'public.market_data_instrument_mappings', 'SELECT'),
  false,
  'Anonymous clients have no SELECT grant on provider mappings'
);

select * from extensions.finish();

rollback;
