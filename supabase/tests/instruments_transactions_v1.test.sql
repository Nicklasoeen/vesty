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

create function tests.genesis_allocations()
returns jsonb
language sql
immutable
security invoker
set search_path = ''
as $function$
  select $json$[
    {
      "investment_target_id": "31000000-0000-4000-8000-000000000001",
      "allocation_bps": 4000,
      "position": 1
    },
    {
      "investment_target_id": "31000000-0000-4000-8000-000000000002",
      "allocation_bps": 3000,
      "position": 2
    },
    {
      "investment_target_id": "31000000-0000-4000-8000-000000000003",
      "allocation_bps": 1500,
      "position": 3
    },
    {
      "investment_target_id": "31000000-0000-4000-8000-000000000004",
      "allocation_bps": 1500,
      "position": 4
    }
  ]$json$::jsonb;
$function$;

grant execute on function tests.authenticate_as(uuid) to authenticated;

create function tests.open_investment_day_v1(
  p_club_id uuid,
  p_now timestamptz default '2026-09-05 10:00:00+00'::timestamptz
)
returns table (
  club_id uuid,
  club_name text,
  membership_id uuid,
  cycle_id uuid,
  investment_day_at timestamptz,
  reporting_opens_at timestamptz,
  reporting_closes_at timestamptz,
  cycle_status public.investment_cycle_status,
  viewer_state text,
  reporting_allowed boolean,
  participation_id uuid,
  participation_outcome public.participation_outcome,
  expected_amount_minor bigint,
  currency text,
  allocations jsonb,
  transactions jsonb
)
language plpgsql
volatile
security definer
set search_path = ''
set row_security = off
as $function$
begin
  update public.club_memberships as membership
  set joined_at = least(membership.joined_at, p_now - interval '120 days')
  where membership.club_id = p_club_id
    and membership.status = 'active';

  update public.member_contribution_commitment_versions as commitment
  set created_at = least(commitment.created_at, p_now - interval '90 days')
  from public.club_memberships as membership
  where membership.id = commitment.membership_id
    and membership.club_id = p_club_id
    and membership.status = 'active';

  perform private.ensure_club_investment_schedule_v1(p_club_id);

  update public.investment_schedules as schedule
  set effective_from = least(schedule.effective_from, p_now - interval '120 days')
  where schedule.club_id = p_club_id
    and schedule.status in ('active', 'paused');

  update public.strategy_versions as strategy
  set
    created_at = least(strategy.created_at, p_now - interval '90 days'),
    approved_at = case
      when strategy.approved_at is null then null
      else least(strategy.approved_at, p_now - interval '90 days')
    end,
    effective_at = least(strategy.effective_at, p_now - interval '90 days')
  where strategy.club_id = p_club_id;

  update public.contribution_policy_versions as policy
  set created_at = least(policy.created_at, p_now - interval '90 days')
  where policy.club_id = p_club_id;

  perform public.advance_investment_cycles_v1(p_now, p_club_id);

  return query
  select *
  from private.current_investment_day_v1(p_club_id, p_now);
end;
$function$;

create function tests.current_investment_day_v1(
  p_club_id uuid,
  p_now timestamptz default '2026-09-05 10:00:00+00'::timestamptz
)
returns table (
  club_id uuid,
  club_name text,
  membership_id uuid,
  cycle_id uuid,
  investment_day_at timestamptz,
  reporting_opens_at timestamptz,
  reporting_closes_at timestamptz,
  cycle_status public.investment_cycle_status,
  viewer_state text,
  reporting_allowed boolean,
  participation_id uuid,
  participation_outcome public.participation_outcome,
  expected_amount_minor bigint,
  currency text,
  allocations jsonb,
  transactions jsonb
)
language sql
stable
security definer
set search_path = ''
as $function$
  select *
  from private.current_investment_day_v1(p_club_id, p_now);
$function$;

create function tests.advance_investment_cycles_v1(
  p_club_id uuid,
  p_now timestamptz default '2026-09-05 10:00:00+00'::timestamptz
)
returns integer
language sql
volatile
security definer
set search_path = ''
set row_security = off
as $function$
  select public.advance_investment_cycles_v1(p_now, p_club_id);
$function$;

create function tests.report_investment_day_at_v1(
  p_club_id uuid,
  p_cycle_id uuid,
  p_client_report_id uuid,
  p_report_mode public.investment_day_report_mode,
  p_outcome public.participation_outcome,
  p_purchase_lines jsonb,
  p_now timestamptz default '2026-09-05 10:00:00+00'::timestamptz
)
returns table (
  club_id uuid,
  club_name text,
  membership_id uuid,
  cycle_id uuid,
  investment_day_at timestamptz,
  cycle_status public.investment_cycle_status,
  participation_id uuid,
  participation_outcome public.participation_outcome,
  expected_amount_minor bigint,
  currency text,
  allocations jsonb,
  transactions jsonb
)
language sql
volatile
security definer
set search_path = ''
as $function$
  select *
  from private.report_investment_day_at_v1(
    p_club_id,
    p_cycle_id,
    p_client_report_id,
    p_report_mode,
    p_outcome,
    p_purchase_lines,
    p_now
  );
$function$;

create function tests.club_investment_day_participation_at_v1(
  p_club_id uuid,
  p_cycle_id uuid,
  p_now timestamptz default '2026-09-05 10:00:00+00'::timestamptz
)
returns table (
  membership_id uuid,
  profile_id uuid,
  display_name text,
  avatar_path text,
  cycle_id uuid,
  completed boolean,
  completed_at timestamptz,
  verification_level text,
  current_streak integer,
  member_count integer,
  completed_count integer,
  pending_count integer,
  all_completed boolean
)
language sql
stable
security definer
set search_path = ''
as $function$
  select *
  from private.club_investment_day_participation_at_v1(p_club_id, p_cycle_id, p_now);
$function$;

grant execute on function tests.open_investment_day_v1(uuid, timestamptz) to authenticated;
grant execute on function tests.current_investment_day_v1(uuid, timestamptz) to authenticated;
grant execute on function tests.advance_investment_cycles_v1(uuid, timestamptz) to authenticated;
grant execute on function tests.report_investment_day_at_v1(uuid, uuid, uuid, public.investment_day_report_mode, public.participation_outcome, jsonb, timestamptz) to authenticated;
grant execute on function tests.club_investment_day_participation_at_v1(uuid, uuid, timestamptz) to authenticated;

grant execute on function tests.statement_sqlstate(text) to authenticated;
grant execute on function tests.statement_message(text) to authenticated;
grant execute on function tests.genesis_allocations() to authenticated;

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
    '00000000-0000-4000-8000-000000000021',
    'authenticated',
    'authenticated',
    'alice-instruments@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000000022',
    'authenticated',
    'authenticated',
    'bob-instruments@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000000023',
    'authenticated',
    'authenticated',
    'cara-instruments@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

insert into public.profiles (id, display_name)
values
  ('00000000-0000-4000-8000-000000000021', 'Alice Instruments'),
  ('00000000-0000-4000-8000-000000000022', 'Bob Instruments'),
  ('00000000-0000-4000-8000-000000000023', 'Cara Instruments');

insert into public.investment_targets (id, name, kind, status, currency)
values (
  '32000000-0000-4000-8000-000000000001',
  'Equinor ASA',
  'stock',
  'active',
  'NOK'
);

-- ---------------------------------------------------------------------------
-- Catalog / fixture boundary
-- ---------------------------------------------------------------------------

select extensions.ok(
  exists (
    select 1
    from pg_catalog.pg_enum as enum_value
    join pg_catalog.pg_type as enum_type
      on enum_type.oid = enum_value.enumtypid
    where enum_type.typname = 'investment_target_kind'
      and enum_value.enumlabel = 'stock'
  ),
  'investment_target_kind includes stock'
);

select extensions.is(
  (
    select name
    from public.investment_targets
    where id = '31000000-0000-4000-8000-000000000001'
  ),
  'KLP AksjeGlobal Indeks P',
  'Genesis fixture 1 is a real instrument name'
);

select extensions.is(
  (
    select name
    from public.investment_targets
    where id = '31000000-0000-4000-8000-000000000002'
  ),
  'DNB Teknologi A',
  'Genesis fixture 2 is a real instrument name'
);

select extensions.is(
  (
    select name
    from public.investment_targets
    where id = '31000000-0000-4000-8000-000000000003'
  ),
  'KLP AksjeNorge Indeks P',
  'Genesis fixture 3 is a real instrument name'
);

select extensions.is(
  (
    select name
    from public.investment_targets
    where id = '31000000-0000-4000-8000-000000000004'
  ),
  'KLP AksjeFremvoksende Markeder Indeks P',
  'Genesis fixture 4 is the official Indeks P share class'
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
      and name in ('Global Index', 'Technology', 'Norway', 'Emerging Markets')
  ),
  0::bigint,
  'Generic exposure labels are no longer catalog names'
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
      and kind = 'fund'
      and currency = 'NOK'
      and isin in (
        'NO0010776040',
        'NO0010337678',
        'NO0010455694',
        'NO0010611809'
      )
      and ticker is null
      and exchange is null
      and provider_symbol is null
  ),
  4::bigint,
  'Verified funds have official ISINs, explicit NOK, and no stock-style tickers'
);

select extensions.is(
  (
    select count(*)
    from public.investment_targets
    where id in (
      '31000000-0000-4000-8000-000000000011',
      '31000000-0000-4000-8000-000000000012',
      '31000000-0000-4000-8000-000000000013',
      '31000000-0000-4000-8000-000000000014',
      '31000000-0000-4000-8000-000000000015'
    )
      and kind = 'etf'
      and status = 'active'
      and currency = 'EUR'
      and ticker in ('VWCE', 'EUNK', 'IS3N', 'SXR8', 'SXRV')
      and exchange = 'Xetra'
      and provider_symbol is null
  ),
  5::bigint,
  'Core V1 ETF targets are active EUR listings without provider symbols'
);

select extensions.is(
  (
    select kind::text
    from public.investment_targets
    where id = '32000000-0000-4000-8000-000000000001'
  ),
  'stock',
  'Catalog can represent a stock instrument'
);

select extensions.ok(
  not has_table_privilege(
    'authenticated',
    'public.member_investment_transactions',
    'insert'
  ),
  'Authenticated role cannot insert transactions directly'
);

select extensions.ok(
  not has_table_privilege(
    'authenticated',
    'public.member_investment_transactions',
    'update'
  ),
  'Authenticated role cannot update transactions'
);

select extensions.ok(
  not has_table_privilege(
    'authenticated',
    'public.member_investment_transactions',
    'delete'
  ),
  'Authenticated role cannot delete transactions'
);

select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.confirm_investment_day_v1(uuid, uuid)',
    'execute'
  ),
  'Anonymous role cannot confirm Investment Day'
);

select extensions.ok(
  not has_function_privilege(
    'authenticated',
    'public.confirm_investment_day_v1(uuid, uuid)',
    'execute'
  ),
  'Authenticated role cannot confirm through the retired v1 path'
);

select extensions.ok(
  not has_function_privilege(
    'authenticated',
    'private.allocate_minor_by_bps(bigint, jsonb)',
    'execute'
  ),
  'Authenticated role cannot execute private allocator'
);

-- ---------------------------------------------------------------------------
-- Club + Investment Day flow
-- ---------------------------------------------------------------------------

set local role authenticated;
select tests.authenticate_as('00000000-0000-4000-8000-000000000021');

create temporary table alice_club as
select *
from public.create_club(
  'Instruments Club',
  'simple_majority',
  'world_mix',
  'NOK'
);

select *
from public.create_member_contribution_commitment_v1(
  (select club_id from alice_club),
  200000
);

create temporary table alice_invite as
select *
from public.create_club_invitation((select club_id from alice_club));

select tests.authenticate_as('00000000-0000-4000-8000-000000000022');

create temporary table bob_join as
select *
from public.accept_club_invitation((select invite_token from alice_invite));

select *
from public.create_member_contribution_commitment_v1(
  (select club_id from alice_club),
  200000
);

select tests.authenticate_as('00000000-0000-4000-8000-000000000021');

select extensions.is(
  (
    select target_name
    from public.strategy_allocations
    where strategy_version_id = (select strategy_version_id from alice_club)
      and position = 2
  ),
  'iShares Core MSCI Europe UCITS ETF EUR (Acc)',
  'World Mix snapshots official ETF names'
);

create temporary table alice_day as
select *
from tests.open_investment_day_v1((select club_id from alice_club));

select extensions.is(
  (select count(*) from alice_day),
  1::bigint,
  'Caller can open the current Investment Day'
);

select extensions.is(
  (
    select count(*)
    from public.member_investment_transactions
    where membership_id = (select membership_id from alice_club)
  ),
  0::bigint,
  'Opening Investment Day does not write transactions'
);

select extensions.is(
  (select expected_amount_minor from alice_day),
  200000::bigint,
  'V1 default reported amount is 2000.00 NOK'
);

select extensions.is(
  (select currency from alice_day),
  'NOK',
  'Investment Day amount currency is explicit'
);

select extensions.is(
  (
    select coalesce(sum((allocation.value->>'amount_minor')::bigint), 0)::bigint
    from pg_catalog.jsonb_array_elements((select allocations from alice_day)) as allocation(value)
  ),
  (select expected_amount_minor from alice_day),
  'Allocated row amounts sum exactly to the member total'
);

create temporary table alice_day_again as
select *
from tests.open_investment_day_v1((select club_id from alice_club));

select extensions.is(
  (select cycle_id from alice_day_again),
  (select cycle_id from alice_day),
  'Ensure is idempotent for the open cycle'
);

create temporary table alice_confirm as
select *
from tests.report_investment_day_at_v1(
  (select club_id from alice_club),
  (select cycle_id from alice_day),
  '81000000-0000-4000-8000-000000000001'::uuid,
  'as_planned',
  'confirmed',
  '[]'::jsonb
);

select extensions.is(
  (select participation_outcome::text from alice_confirm),
  'confirmed',
  'Confirm marks the caller participation confirmed'
);

select extensions.is(
  (
    select count(*)
    from public.member_investment_transactions
    where membership_id = (select membership_id from alice_club)
      and investment_cycle_id = (select cycle_id from alice_day)
      and transaction_type = 'buy'
      and source = 'manual'
      and verification_status = 'member_reported'
      and quantity is null
      and unit_price_minor is null
      and amount_minor > 0
      and currency = 'NOK'
  ),
  3::bigint,
  'Confirm writes one member-reported buy per World Mix holding'
);

select extensions.is(
  (
    select amount_minor
    from public.member_investment_transactions
    where membership_id = (select membership_id from alice_club)
      and investment_target_id = '31000000-0000-4000-8000-000000000011'
  ),
  120000::bigint,
  '60% of 200000 minor units is 120000'
);

select extensions.is(
  (
    select coalesce(sum(amount_minor), 0)::bigint
    from public.member_investment_transactions
    where membership_id = (select membership_id from alice_club)
  ),
  200000::bigint,
  'Confirmed buys sum exactly to the reported total'
);

create temporary table alice_retry as
select *
from tests.report_investment_day_at_v1(
  (select club_id from alice_club),
  (select cycle_id from alice_day),
  '81000000-0000-4000-8000-000000000001'::uuid,
  'as_planned',
  'confirmed',
  '[]'::jsonb
);

select extensions.is(
  (
    select count(*)
    from public.member_investment_transactions
    where membership_id = (select membership_id from alice_club)
  ),
  3::bigint,
  'Retry confirm does not duplicate transactions'
);

select extensions.is(
  (select participation_outcome::text from alice_retry),
  'confirmed',
  'Retry confirm returns the persisted confirmed participation'
);

select extensions.is(
  (
    select count(*)
    from public.member_investment_positions
    where membership_id = (select membership_id from alice_club)
      and total_invested_minor > 0
  ),
  3::bigint,
  'Caller can read own derived positions'
);

select extensions.is(
  tests.statement_sqlstate(
    $statement$
      insert into public.member_investment_transactions (
        club_id,
        membership_id,
        investment_cycle_id,
        investment_target_id,
        transaction_type,
        amount_minor,
        currency,
        executed_at,
        source,
        verification_status
      )
      values (
        (select club_id from alice_club),
        (select membership_id from alice_club),
        (select cycle_id from alice_day),
        '31000000-0000-4000-8000-000000000001',
        'buy',
        100,
        'NOK',
        now(),
        'manual',
        'member_reported'
      )
    $statement$
  ),
  '42501',
  'Direct transaction insert is forbidden'
);

create temporary table alice_second_club as
select *
from public.create_club(
  'Second Instruments Club',
  'simple_majority',
  'world_america',
  'NOK'
);

select *
from public.create_member_contribution_commitment_v1(
  (select club_id from alice_second_club),
  200000
);

select extensions.is(
  (
    select string_agg(investment_target_id::text || ':' || allocation_bps::text, ',' order by position)
    from public.strategy_allocations
    where strategy_version_id = (select strategy_version_id from alice_second_club)
  ),
  '31000000-0000-4000-8000-000000000011:5000,31000000-0000-4000-8000-000000000014:3000,31000000-0000-4000-8000-000000000012:1000,31000000-0000-4000-8000-000000000013:1000',
  'World + America resolves to the canonical ETF allocations'
);

create temporary table alice_second_day as
select *
from tests.open_investment_day_v1((select club_id from alice_second_club));

select extensions.is(
  tests.statement_message(
    format(
      $statement$
        select tests.report_investment_day_at_v1(
          %L::uuid,
          %L::uuid,
          '81000000-0000-4000-8000-000000000099'::uuid,
          'as_planned',
          'confirmed',
          '[]'::jsonb
        )
      $statement$,
      (select club_id from alice_club),
      (select cycle_id from alice_second_day)
    )
  ),
  'vesty.cycle_invalid',
  'Confirm rejects a cycle from another club'
);

select tests.authenticate_as('00000000-0000-4000-8000-000000000022');

select extensions.is(
  (
    select count(*)
    from public.member_investment_transactions
    where membership_id = (select membership_id from alice_club)
  ),
  0::bigint,
  'Other member cannot read private transaction amounts'
);

select extensions.is(
  (
    select count(*)
    from public.member_investment_positions
    where membership_id = (select membership_id from alice_club)
  ),
  0::bigint,
  'Other member cannot read private positions'
);

select extensions.is(
  (
    select count(*)
    from public.member_cycle_participations
    where membership_id = (select membership_id from alice_club)
  ),
  0::bigint,
  'Other member cannot read private participation amounts'
);

create temporary table bob_day as
select *
from tests.open_investment_day_v1((select club_id from alice_club));

select extensions.is(
  (
    select count(*)
    from public.member_investment_transactions
    where membership_id = (select membership_id from alice_club)
  ),
  0::bigint,
  'Another member opening Investment Day still cannot see owner transactions'
);

create temporary table bob_confirm as
select *
from tests.report_investment_day_at_v1(
  (select club_id from alice_club),
  (select cycle_id from bob_day),
  '81000000-0000-4000-8000-000000000002'::uuid,
  'as_planned',
  'confirmed',
  '[]'::jsonb
);

select extensions.is(
  (
    select count(*)
    from public.member_investment_transactions
    where membership_id = (select membership_id from bob_join)
  ),
  3::bigint,
  'Second member can confirm their own transactions'
);

select tests.authenticate_as('00000000-0000-4000-8000-000000000021');

select extensions.is(
  (
    select count(*)
    from public.member_investment_transactions
    where membership_id = (select membership_id from bob_join)
  ),
  0::bigint,
  'Club owner cannot read another member''s transaction amounts'
);

select tests.authenticate_as('00000000-0000-4000-8000-000000000023');

select extensions.is(
  tests.statement_message(
    format(
      $statement$
        select public.current_investment_day_v1(%L::uuid)
      $statement$,
      (select club_id from alice_club)
    )
  ),
  'vesty.not_club_member',
  'Outsider cannot read another club''s Investment Day'
);

select extensions.is(
  tests.statement_message(
    format(
      $statement$
        select tests.report_investment_day_at_v1(
          %L::uuid,
          %L::uuid,
          '81000000-0000-4000-8000-000000000097'::uuid,
          'as_planned',
          'confirmed',
          '[]'::jsonb
        )
      $statement$,
      (select club_id from alice_club),
      (select cycle_id from alice_day)
    )
  ),
  'vesty.not_club_member',
  'Outsider cannot confirm another member''s Investment Day'
);

reset role;

insert into public.investment_cycles (
  id,
  club_id,
  investment_schedule_id,
  strategy_version_id,
  contribution_policy_version_id,
  occurrence_key,
  investment_day_at,
  configuration_deadline_at,
  reporting_opens_at,
  reporting_closes_at,
  timezone,
  status
)
select
  '33000000-0000-4000-8000-000000000001',
  club.id,
  schedule.id,
  version.id,
  policy.id,
  'v1-upcoming-test',
  now() + interval '14 days',
  now() + interval '13 days',
  now() + interval '14 days',
  now() + interval '21 days',
  'Europe/Oslo',
  'upcoming'
from public.clubs as club
join public.investment_schedules as schedule
  on schedule.club_id = club.id
join public.strategy_versions as version
  on version.club_id = club.id
join public.contribution_policy_versions as policy
  on policy.club_id = club.id
where club.id = (select club_id from alice_club)
limit 1;

set local role authenticated;
select tests.authenticate_as('00000000-0000-4000-8000-000000000021');

select extensions.is(
  tests.statement_message(
    $statement$
      select tests.report_investment_day_at_v1(
        (select club_id from alice_club),
        '33000000-0000-4000-8000-000000000001',
        '81000000-0000-4000-8000-000000000098'::uuid,
        'as_planned',
        'confirmed',
        '[]'::jsonb
      )
    $statement$
  ),
  'vesty.cycle_invalid',
  'Confirm rejects a cycle the caller has no participation in'
);

reset role;

select extensions.is(
  tests.statement_message(
    $statement$
      insert into public.member_investment_transactions (
        club_id,
        membership_id,
        investment_cycle_id,
        investment_target_id,
        transaction_type,
        amount_minor,
        currency,
        executed_at,
        source,
        verification_status,
        amount_provenance
      )
      values (
        (select club_id from alice_club),
        (select membership_id from alice_club),
        (select cycle_id from alice_day),
        '32000000-0000-4000-8000-000000000001',
        'buy',
        100,
        'NOK',
        now(),
        'manual',
        'member_reported',
        'legacy_plan_assumed'
      )
    $statement$
  ),
  'vesty.invalid_target',
  'Wrong-strategy target is rejected'
);

select extensions.is(
  tests.statement_sqlstate(
    $statement$
      insert into public.member_investment_transactions (
        club_id,
        membership_id,
        investment_cycle_id,
        investment_target_id,
        transaction_type,
        amount_minor,
        currency,
        executed_at,
        source,
        verification_status,
        amount_provenance
      )
      values (
        (select club_id from alice_club),
        (select membership_id from alice_club),
        (select cycle_id from alice_day),
        '31000000-0000-4000-8000-000000000011',
        'buy',
        0,
        'NOK',
        now(),
        'manual',
        'member_reported',
        'legacy_plan_assumed'
      )
    $statement$
  ),
  '23514',
  'Transaction amount must be positive'
);

select extensions.is(
  tests.statement_sqlstate(
    $statement$
      insert into public.member_investment_transactions (
        club_id,
        membership_id,
        investment_cycle_id,
        investment_target_id,
        transaction_type,
        amount_minor,
        currency,
        executed_at,
        source,
        verification_status,
        amount_provenance
      )
      values (
        (select club_id from alice_club),
        (select membership_id from alice_club),
        (select cycle_id from alice_day),
        '31000000-0000-4000-8000-000000000011',
        'buy',
        100,
        'nok',
        now(),
        'manual',
        'member_reported',
        'legacy_plan_assumed'
      )
    $statement$
  ),
  '23514',
  'Transaction currency must be explicit ISO uppercase'
);

-- Remainder allocation: 200001 minor units, leftover goes to highest remainder.
set local role authenticated;
select tests.authenticate_as('00000000-0000-4000-8000-000000000021');

create temporary table alice_remainder_club as
select *
from public.create_club(
  'Remainder Club',
  'simple_majority',
  'world_mix',
  'NOK'
);

insert into public.member_saving_plans (
  club_id,
  membership_id,
  amount_minor,
  currency,
  active_from
)
select
  club_id,
  membership_id,
  200001,
  'NOK',
  now()
from alice_remainder_club;

select *
from public.create_member_contribution_commitment_v1(
  (select club_id from alice_remainder_club),
  200001
);

create temporary table alice_remainder_day as
select *
from tests.open_investment_day_v1((select club_id from alice_remainder_club));

create temporary table alice_remainder_confirm as
select *
from tests.report_investment_day_at_v1(
  (select club_id from alice_remainder_club),
  (select cycle_id from alice_remainder_day),
  '81000000-0000-4000-8000-000000000003'::uuid,
  'as_planned',
  'confirmed',
  '[]'::jsonb
);

select extensions.is(
  (
    select coalesce(sum(amount_minor), 0)::bigint
    from public.member_investment_transactions
    where membership_id = (select membership_id from alice_remainder_club)
  ),
  200001::bigint,
  'Largest-remainder allocation sums exactly to an uneven total'
);

select extensions.is(
  (
    select amount_minor
    from public.member_investment_transactions
    where membership_id = (select membership_id from alice_remainder_club)
      and investment_target_id = '31000000-0000-4000-8000-000000000011'
  ),
  120001::bigint,
  'Remainder unit is applied to the highest remainder, then position'
);

reset role;

update public.club_memberships
set
  status = 'left',
  ended_at = now()
where id = (select membership_id from bob_join);

set local role authenticated;
select tests.authenticate_as('00000000-0000-4000-8000-000000000022');

select extensions.is(
  (
    select count(*)
    from public.member_investment_transactions
    where membership_id = (select membership_id from bob_join)
  ),
  0::bigint,
  'Former member cannot read historical transaction amounts'
);

select extensions.is(
  (
    select count(*)
    from public.member_investment_positions
    where membership_id = (select membership_id from bob_join)
  ),
  0::bigint,
  'Former member cannot read historical positions'
);

select extensions.is(
  tests.statement_message(
    format(
      $statement$
        select tests.report_investment_day_at_v1(
          %L::uuid,
          %L::uuid,
          '81000000-0000-4000-8000-000000000096'::uuid,
          'as_planned',
          'confirmed',
          '[]'::jsonb
        )
      $statement$,
      (select club_id from alice_club),
      (select cycle_id from bob_day)
    )
  ),
  'vesty.not_club_member',
  'Former member cannot confirm Investment Day'
);

select tests.authenticate_as('00000000-0000-4000-8000-000000000021');

select extensions.is(
  (
    select count(*)
    from public.member_investment_transactions
    where membership_id = (select membership_id from alice_club)
  ),
  3::bigint,
  'Active member still reads own transactions after another member leaves'
);

reset role;

select extensions.ok(
  not has_table_privilege('anon', 'public.member_investment_transactions', 'select'),
  'Anonymous role has no transaction read grant'
);

select * from extensions.finish();

rollback;
