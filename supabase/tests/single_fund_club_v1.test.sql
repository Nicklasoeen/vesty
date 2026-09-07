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

create function tests.statement_message(p_statement text)
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
    return sqlerrm;
end;
$function$;

grant execute on function tests.authenticate_as(uuid) to authenticated;
grant execute on function tests.statement_sqlstate(text) to authenticated;
grant execute on function tests.statement_message(text) to authenticated;

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
    '74000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'simple-owner@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '74000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'simple-member@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '74000000-0000-4000-8000-000000000003',
    'authenticated',
    'authenticated',
    'simple-outsider@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

insert into public.profiles (id, display_name)
values
  ('74000000-0000-4000-8000-000000000001', 'Simple Owner'),
  ('74000000-0000-4000-8000-000000000002', 'Simple Member'),
  ('74000000-0000-4000-8000-000000000003', 'Simple Outsider');

select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.create_club_v3(text, public.club_investment_mode, uuid, public.governance_threshold_kind, public.contribution_policy_mode, uuid, bigint, bigint, text)',
    'execute'
  ),
  'Anonymous role cannot execute create_club_v3'
);

select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.single_fund_catalog_v1()',
    'execute'
  ),
  'Anonymous role cannot execute the single-fund catalog'
);

select extensions.ok(
  not has_function_privilege(
    'authenticated',
    'private.create_club_v3(text, public.club_investment_mode, uuid, public.governance_threshold_kind, public.contribution_policy_mode, uuid, bigint, bigint, text)',
    'execute'
  ),
  'Authenticated role cannot execute private.create_club_v3'
);

select extensions.ok(
  not has_function_privilege(
    'authenticated',
    'private.single_fund_catalog_v1()',
    'execute'
  ),
  'Authenticated role cannot execute private.single_fund_catalog_v1'
);

select extensions.ok(
  not has_function_privilege(
    'authenticated',
    'private.club_creation_fingerprint_v1(text, public.club_investment_mode, uuid, public.governance_threshold_kind, public.contribution_policy_mode, bigint, bigint, text)',
    'execute'
  ),
  'Authenticated role cannot execute the creation fingerprint helper'
);

select extensions.ok(
  not has_table_privilege('authenticated', 'private.single_fund_products', 'select'),
  'Authenticated role cannot read private single-fund products'
);

select extensions.ok(
  not has_table_privilege('authenticated', 'private.single_fund_broker_listings', 'select'),
  'Authenticated role cannot read private broker listings'
);

select extensions.ok(
  not has_table_privilege('authenticated', 'private.club_creation_requests', 'select'),
  'Authenticated role cannot read creation-request ledger'
);

select extensions.ok(
  not has_table_privilege('authenticated', 'private.single_fund_products', 'insert'),
  'Authenticated role cannot insert catalog products'
);

select extensions.ok(
  not has_function_privilege(
    'authenticated',
    'private.is_allowed_single_fund_source_url(text)',
    'execute'
  ),
  'Authenticated role cannot execute the broker URL allowlist helper'
);

select extensions.ok(
  not has_function_privilege(
    'authenticated',
    'private.advance_club_investment_cycles_v1(uuid,timestamptz)',
    'execute'
  ),
  'F03: authenticated clients cannot execute private cycle advance'
);

select extensions.ok(
  not has_function_privilege(
    'authenticated',
    'private.ensure_club_investment_schedule_v1(uuid)',
    'execute'
  ),
  'F03: authenticated clients cannot execute private schedule ensure'
);

select extensions.ok(
  not has_function_privilege(
    'authenticated',
    'public.ensure_open_investment_day_v1(uuid)',
    'execute'
  ),
  'F03: authenticated clients cannot execute retired ensure-open'
);

select extensions.ok(
  not has_function_privilege(
    'authenticated',
    'public.advance_investment_cycles_v1(timestamptz,uuid)',
    'execute'
  ),
  'F04: authenticated clients cannot execute trusted lifecycle advance'
);

select extensions.ok(
  private.is_allowed_single_fund_source_url(
    'https://www.dnb.no/sparing/fond/fond-liste/d/dnb-global-indeks-a-NO0010582984'
  )
  and private.is_allowed_single_fund_source_url(
    'https://www.nordnet.no/fond/liste/dnb-global-indeks-a-nok-7b4b0894'
  ),
  'Official DNB and Nordnet HTTPS hosts are allowed'
);

select extensions.ok(
  not private.is_allowed_single_fund_source_url(
    'http://www.nordnet.no/fond/liste/dnb-global-indeks-a-nok-7b4b0894'
  )
  and not private.is_allowed_single_fund_source_url(
    'https://nordnet.no.example.com/fond/liste/dnb-global-indeks-a'
  )
  and not private.is_allowed_single_fund_source_url(
    'https://www.nordnet.no@evil.example/fond/liste/dnb-global-indeks-a'
  )
  and not private.is_allowed_single_fund_source_url(
    'https://evil.example@www.nordnet.no/fond/liste/dnb-global-indeks-a'
  ),
  'HTTP, lookalike hosts, and userinfo disguises are rejected'
);

set local role authenticated;
select tests.authenticate_as('74000000-0000-4000-8000-000000000001');

create temporary table legacy_club as
select *
from public.create_club_v2(
  'Legacy Package Club',
  'simple_majority',
  'world_mix',
  'equal',
  150000,
  null,
  'NOK'
);

select extensions.is(
  (
    select investment_mode::text
    from public.clubs
    where id = (select club_id from legacy_club)
  ),
  'legacy_package',
  'Existing create_club_v2 clubs are classified as legacy_package'
);

select extensions.is(
  (
    select count(*)
    from public.strategy_allocations as allocation
    join public.strategy_versions as strategy
      on strategy.id = allocation.strategy_version_id
    where strategy.club_id = (select club_id from legacy_club)
  ),
  3::bigint,
  'Legacy package clubs still receive the curated multi-ETF snapshot'
);

select extensions.ok(
  tests.statement_message(
    $statement$
      update public.clubs
      set investment_mode = 'single_fund'
      where id = (select club_id from legacy_club)
    $statement$
  ) is not null,
  'Authenticated clients cannot update clubs.investment_mode'
);

select extensions.is(
  (
    select investment_mode::text
    from public.clubs
    where id = (select club_id from legacy_club)
  ),
  'legacy_package',
  'Blocked client updates leave legacy_package unchanged'
);

create temporary table catalog_rows as
select *
from public.single_fund_catalog_v1();

select extensions.is(
  (select count(*) from catalog_rows),
  1::bigint,
  'Authenticated catalog returns the one active Simple saving product'
);

select extensions.is(
  (select legal_name from catalog_rows),
  'DNB Global Indeks A',
  'Catalog returns the DNB Global Indeks A legal name'
);

select extensions.is(
  (select isin from catalog_rows),
  'NO0010582984',
  'Catalog returns the verified ISIN'
);

select extensions.is(
  (select kind::text from catalog_rows),
  'fund',
  'Catalog returns fund kind'
);

select extensions.ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'pg_temp'
      and table_name = 'catalog_rows'
      and column_name = 'investment_target_id'
  ),
  'Catalog result does not expose investment_target_id'
);

select extensions.ok(
  (select brokers from catalog_rows) @> '[{"broker":"dnb","is_verified":true}]'::jsonb
    and (select brokers from catalog_rows) @> '[{"broker":"nordnet","is_verified":true}]'::jsonb,
  'Catalog includes verified DNB and Nordnet listings'
);

select extensions.is(
  tests.statement_message(
    $statement$
      select public.create_club_v3(
        'Custom Locked',
        'custom_portfolio',
        '32000000-0000-4000-8000-000000000001',
        'simple_majority',
        'equal',
        '75000000-0000-4000-8000-000000000001',
        100000,
        null,
        'NOK'
      )
    $statement$
  ),
  'vesty.investment_mode_unavailable',
  'create_club_v3 rejects custom_portfolio'
);

select extensions.is(
  tests.statement_message(
    $statement$
      select public.create_club_v3(
        'Unknown Product',
        'single_fund',
        '32000000-0000-4000-8000-00000000ffff',
        'simple_majority',
        'equal',
        '75000000-0000-4000-8000-000000000002',
        100000,
        null,
        'NOK'
      )
    $statement$
  ),
  'vesty.catalog_product_unavailable',
  'create_club_v3 rejects a manipulated catalog id'
);

select extensions.is(
  (
    select count(*)
    from public.clubs
    where name in ('Custom Locked', 'Unknown Product')
  ),
  0::bigint,
  'Rejected creates leave no club'
);

reset role;

update private.single_fund_products
set status = 'inactive'
where id = '32000000-0000-4000-8000-000000000001';

set local role authenticated;
select tests.authenticate_as('74000000-0000-4000-8000-000000000001');

select extensions.is(
  tests.statement_message(
    $statement$
      select public.create_club_v3(
        'Inactive Product Club',
        'single_fund',
        '32000000-0000-4000-8000-000000000001',
        'simple_majority',
        'equal',
        '75000000-0000-4000-8000-000000000003',
        100000,
        null,
        'NOK'
      )
    $statement$
  ),
  'vesty.catalog_product_unavailable',
  'Inactive catalog products are rejected atomically'
);

select extensions.is(
  (
    select count(*)
    from public.clubs
    where name = 'Inactive Product Club'
  ),
  0::bigint,
  'Inactive catalog rejection leaves no club'
);

select extensions.is(
  (
    select count(*)
    from public.investment_schedules as schedule
    join public.clubs as club
      on club.id = schedule.club_id
    where club.name = 'Inactive Product Club'
  ),
  0::bigint,
  'Create failure rolls back any schedule with the club'
);

select extensions.is(
  (
    select count(*)
    from public.investment_cycles as cycle
    join public.clubs as club
      on club.id = cycle.club_id
    where club.name = 'Inactive Product Club'
  ),
  0::bigint,
  'Create failure rolls back any cycle with the club'
);

reset role;

update private.single_fund_products
set status = 'active'
where id = '32000000-0000-4000-8000-000000000001';

set local role authenticated;
select tests.authenticate_as('74000000-0000-4000-8000-000000000001');

create temporary table simple_equal as
select *
from public.create_club_v3(
  'Simple Equal Club',
  'single_fund',
  '32000000-0000-4000-8000-000000000001',
  'simple_majority',
  'equal',
  '75000000-0000-4000-8000-000000000010',
  200000,
  null,
  'NOK'
);

select extensions.is(
  (
    select investment_mode::text
    from public.clubs
    where id = (select club_id from simple_equal)
  ),
  'single_fund',
  'New Simple saving clubs are stored as single_fund'
);

select extensions.is(
  (
    select count(*)
    from public.strategy_allocations as allocation
    join public.strategy_versions as strategy
      on strategy.id = allocation.strategy_version_id
    where strategy.club_id = (select club_id from simple_equal)
      and strategy.version_number = 1
  ),
  1::bigint,
  'Simple saving writes exactly one genesis allocation'
);

select extensions.is(
  (
    select allocation.allocation_bps
    from public.strategy_allocations as allocation
    join public.strategy_versions as strategy
      on strategy.id = allocation.strategy_version_id
    where strategy.club_id = (select club_id from simple_equal)
      and strategy.version_number = 1
  ),
  10000::smallint,
  'Simple saving allocation is exactly 10000 bps'
);

select extensions.is(
  (
    select allocation.investment_target_id
    from public.strategy_allocations as allocation
    join public.strategy_versions as strategy
      on strategy.id = allocation.strategy_version_id
    where strategy.club_id = (select club_id from simple_equal)
      and strategy.version_number = 1
  ),
  '31000000-0000-4000-8000-000000000021'::uuid,
  'Simple saving snapshots the DNB Global Indeks A target'
);

select extensions.is(
  (
    select allocation.target_isin
    from public.strategy_allocations as allocation
    join public.strategy_versions as strategy
      on strategy.id = allocation.strategy_version_id
    where strategy.club_id = (select club_id from simple_equal)
      and strategy.version_number = 1
  ),
  'NO0010582984',
  'Simple saving snapshots the verified ISIN'
);

select extensions.is(
  (
    select allocation.target_kind::text
    from public.strategy_allocations as allocation
    join public.strategy_versions as strategy
      on strategy.id = allocation.strategy_version_id
    where strategy.club_id = (select club_id from simple_equal)
      and strategy.version_number = 1
  ),
  'fund',
  'Simple saving snapshots fund kind'
);

select extensions.is(
  (
    select mode::text
    from public.contribution_policy_versions
    where club_id = (select club_id from simple_equal)
      and version_number = 1
  ),
  'equal',
  'Equal Simple saving writes policy v1 as equal'
);

select extensions.is(
  (
    select count(*)
    from public.member_contribution_commitment_versions
    where club_id = (select club_id from simple_equal)
  ),
  0::bigint,
  'Equal Simple saving does not send a private creator commitment'
);

select extensions.is(
  (
    select count(*)
    from public.investment_schedules
    where club_id = (select club_id from simple_equal)
      and status = 'active'
  ),
  1::bigint,
  'New Simple saving clubs have one active Investment Day schedule'
);

select extensions.is(
  (
    select concat_ws(
      '|',
      day_of_month::text,
      missing_day_policy,
      timezone,
      configuration_lead_days::text
    )
    from public.investment_schedules
    where club_id = (select club_id from simple_equal)
      and status = 'active'
  ),
  '5|last_day_of_month|Europe/Oslo|3',
  'Create uses the existing day-5 Oslo schedule with a three-day lead'
);

select extensions.ok(
  (
    select count(*)
    from public.investment_cycles
    where club_id = (select club_id from simple_equal)
      and status <> 'cancelled'
  ) >= 1,
  'Create materializes at least one Investment Day occurrence'
);

select extensions.is(
  (
    select count(*)
    from public.investment_cycles
    where club_id = (select club_id from simple_equal)
      and configuration_deadline_at <= pg_catalog.now()
  ),
  0::bigint,
  'Create does not materialize an already expired configuration period'
);

select extensions.is(
  (
    select count(*)
    from public.member_cycle_participations as participation
    join public.investment_cycles as cycle
      on cycle.id = participation.investment_cycle_id
    join public.club_memberships as membership
      on membership.id = participation.membership_id
    where cycle.club_id = (select club_id from simple_equal)
      and cycle.configuration_deadline_at < membership.joined_at
  ),
  0::bigint,
  'Creator is not added to a roster whose deadline was already before join'
);

create temporary table simple_equal_day as
select *
from public.current_investment_day_v1((select club_id from simple_equal));

select extensions.ok(
  (select viewer_state from simple_equal_day) in ('upcoming', 'open'),
  'Dashboard read shows an upcoming or open Investment Day after create'
);

select extensions.ok(
  (select investment_day_at from simple_equal_day) is not null,
  'Dashboard read has a concrete Investment Day timestamp after create'
);

create temporary table simple_retry as
select *
from public.create_club_v3(
  'Simple Equal Club',
  'single_fund',
  '32000000-0000-4000-8000-000000000001',
  'simple_majority',
  'equal',
  '75000000-0000-4000-8000-000000000010',
  200000,
  null,
  'NOK'
);

select extensions.is(
  (select club_id from simple_retry),
  (select club_id from simple_equal),
  'Identical retry returns the same club'
);

select extensions.is(
  (
    select count(*)
    from public.clubs
    where name = 'Simple Equal Club'
  ),
  1::bigint,
  'Identical retry does not create a second club'
);

select extensions.is(
  (
    select count(*)
    from public.investment_schedules
    where club_id = (select club_id from simple_retry)
  ),
  1::bigint,
  'Identical retry does not create a second schedule'
);

select extensions.is(
  (
    select count(*)
    from public.investment_cycles
    where club_id = (select club_id from simple_retry)
  ),
  (
    select count(*)
    from public.investment_cycles
    where club_id = (select club_id from simple_equal)
  ),
  'Identical retry does not create extra cycles'
);

select extensions.is(
  tests.statement_message(
    $statement$
      select public.create_club_v3(
        'Simple Equal Club Changed',
        'single_fund',
        '32000000-0000-4000-8000-000000000001',
        'simple_majority',
        'equal',
        '75000000-0000-4000-8000-000000000010',
        250000,
        null,
        'NOK'
      )
    $statement$
  ),
  'vesty.creation_conflict',
  'Changed payload with the same creation id conflicts'
);

select extensions.is(
  (
    select count(*)
    from public.clubs
    where name = 'Simple Equal Club Changed'
  ),
  0::bigint,
  'Conflict leaves the original club and creates no new club'
);

create temporary table simple_flexible as
select *
from public.create_club_v3(
  'Simple Flexible Club',
  'single_fund',
  '32000000-0000-4000-8000-000000000001',
  'unanimous',
  'flexible',
  '75000000-0000-4000-8000-000000000020',
  null,
  175000,
  'NOK'
);

select extensions.is(
  (
    select mode::text
    from public.contribution_policy_versions
    where club_id = (select club_id from simple_flexible)
      and version_number = 1
  ),
  'flexible',
  'Flexible Simple saving writes policy v1 as flexible'
);

select extensions.is(
  (
    select equal_amount_minor
    from public.contribution_policy_versions
    where club_id = (select club_id from simple_flexible)
      and version_number = 1
  ),
  null,
  'Flexible Simple saving does not store a shared equal amount'
);

select extensions.is(
  (
    select amount_minor
    from public.member_contribution_commitment_versions
    where club_id = (select club_id from simple_flexible)
      and membership_id = (select membership_id from simple_flexible)
      and version_number = 1
  ),
  175000::bigint,
  'Flexible Simple saving stores the creator private amount'
);

create temporary table flexible_invite as
select *
from public.create_club_invitation((select club_id from simple_flexible));

select tests.authenticate_as('74000000-0000-4000-8000-000000000002');

create temporary table flexible_join as
select *
from public.accept_club_invitation((select invite_token from flexible_invite));

select extensions.is(
  (
    select count(*)
    from public.member_contribution_commitment_versions
    where club_id = (select club_id from simple_flexible)
  ),
  0::bigint,
  'Other members cannot read the creator private amount'
);

select tests.authenticate_as('74000000-0000-4000-8000-000000000003');

select extensions.is(
  (
    select count(*)
    from public.clubs
    where id = (select club_id from simple_equal)
  ),
  0::bigint,
  'Outsiders cannot read another member Simple saving club'
);

select extensions.is(
  tests.statement_message(
    $statement$
      insert into public.strategy_allocations (
        strategy_version_id,
        investment_target_id,
        allocation_bps,
        position,
        target_name,
        target_kind,
        target_isin
      )
      values (
        (select strategy_version_id from simple_equal),
        '31000000-0000-4000-8000-000000000011',
        10000,
        2,
        'Manipulated',
        'etf',
        'IE00BK5BQT80'
      )
    $statement$
  ) is not null,
  true,
  'Direct allocation inserts are rejected'
);

select tests.authenticate_as('74000000-0000-4000-8000-000000000003');

create temporary table outsider_same_id as
select *
from public.create_club_v3(
  'Outsider Same UUID',
  'single_fund',
  '32000000-0000-4000-8000-000000000001',
  'simple_majority',
  'equal',
  '75000000-0000-4000-8000-000000000010',
  100000,
  null,
  'NOK'
);

select extensions.isnt(
  (select club_id from outsider_same_id),
  (select club_id from simple_equal),
  'Different users may reuse the same client creation UUID'
);

reset role;

select extensions.is(
  tests.statement_message(
    $statement$
      update public.clubs
      set investment_mode = 'custom_portfolio'
      where id = (select club_id from simple_equal)
    $statement$
  ),
  'vesty.investment_mode_immutable',
  'Server rejects investment_mode changes after creation'
);

select extensions.finish();
rollback;
