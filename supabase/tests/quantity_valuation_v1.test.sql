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

create function tests.world_mix_reports(
  p_vwce text,
  p_eunk text,
  p_is3n text,
  p_vwce_price text default null,
  p_eunk_price text default null,
  p_is3n_price text default null
)
returns jsonb
language sql
immutable
security invoker
set search_path = ''
as $function$
  select pg_catalog.jsonb_build_array(
    pg_catalog.jsonb_strip_nulls(
      pg_catalog.jsonb_build_object(
        'investment_target_id', '31000000-0000-4000-8000-000000000011',
        'quantity', p_vwce,
        'execution_unit_price', p_vwce_price
      )
    ),
    pg_catalog.jsonb_strip_nulls(
      pg_catalog.jsonb_build_object(
        'investment_target_id', '31000000-0000-4000-8000-000000000012',
        'quantity', p_eunk,
        'execution_unit_price', p_eunk_price
      )
    ),
    pg_catalog.jsonb_strip_nulls(
      pg_catalog.jsonb_build_object(
        'investment_target_id', '31000000-0000-4000-8000-000000000013',
        'quantity', p_is3n,
        'execution_unit_price', p_is3n_price
      )
    )
  );
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
grant execute on function tests.world_mix_reports(text, text, text, text, text, text) to authenticated;

create function tests.report_as_planned(
  p_club_id uuid,
  p_cycle_id uuid,
  p_client_report_id uuid,
  p_purchase_lines jsonb default '[]'::jsonb
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
security invoker
set search_path = ''
as $function$
  select *
  from tests.report_investment_day_at_v1(
    p_club_id,
    p_cycle_id,
    p_client_report_id,
    'as_planned',
    'confirmed',
    p_purchase_lines
  );
$function$;

grant execute on function tests.report_as_planned(uuid, uuid, uuid, jsonb) to authenticated;

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
    '00000000-0000-4000-8000-000000000071',
    'authenticated',
    'authenticated',
    'alice-quantity@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000000072',
    'authenticated',
    'authenticated',
    'bob-quantity@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

insert into public.profiles (id, display_name)
values
  ('00000000-0000-4000-8000-000000000071', 'Alice Quantity'),
  ('00000000-0000-4000-8000-000000000072', 'Bob Quantity');

delete from public.market_prices
where provider = 'marketstack'
  and investment_target_id in (
    '31000000-0000-4000-8000-000000000011',
    '31000000-0000-4000-8000-000000000012',
    '31000000-0000-4000-8000-000000000013'
  );

insert into public.market_prices (
  investment_target_id,
  provider,
  price_date,
  price,
  currency,
  price_type
)
values
  (
    '31000000-0000-4000-8000-000000000011',
    'marketstack',
    current_date,
    168.06000000,
    'EUR',
    'close'
  ),
  (
    '31000000-0000-4000-8000-000000000012',
    'marketstack',
    current_date - 30,
    105.50000000,
    'EUR',
    'close'
  );

select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.confirm_investment_day_v2(uuid, uuid, jsonb)',
    'execute'
  ),
  'Anonymous role cannot confirm quantity reports'
);

select extensions.ok(
  not has_function_privilege(
    'authenticated',
    'public.confirm_investment_day_v2(uuid, uuid, jsonb)',
    'execute'
  ),
  'Authenticated role cannot confirm through the retired v2 path'
);

select extensions.ok(
  not has_function_privilege(
    'authenticated',
    'private.parse_positive_decimal_v1(jsonb, integer, integer, text)',
    'execute'
  ),
  'Authenticated role cannot execute the decimal parser'
);

select extensions.ok(
  not has_table_privilege(
    'authenticated',
    'public.member_investment_transactions',
    'update'
  ),
  'Authenticated role still cannot update transactions directly'
);

set local role authenticated;
select tests.authenticate_as('00000000-0000-4000-8000-000000000071');

create temporary table alice_club as
select *
from public.create_club(
  'Quantity Club',
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

select tests.authenticate_as('00000000-0000-4000-8000-000000000072');

create temporary table bob_join as
select *
from public.accept_club_invitation((select invite_token from alice_invite));

select *
from public.create_member_contribution_commitment_v1(
  (select club_id from alice_club),
  200000
);

select tests.authenticate_as('00000000-0000-4000-8000-000000000071');

create temporary table alice_day as
select *
from tests.open_investment_day_v1((select club_id from alice_club));

select extensions.is(
  tests.statement_message(
    format(
      $statement$
        select tests.report_as_planned(
          %L::uuid,
          %L::uuid,
          '71000000-aaaa-4000-8000-000000000099'::uuid,
          tests.world_mix_reports('0', '1.5', '12')
        )
      $statement$,
      (select club_id from alice_club),
      (select cycle_id from alice_day)
    )
  ),
  'vesty.quantity_invalid',
  'Zero quantity is rejected'
);

select extensions.is(
  tests.statement_message(
    format(
      $statement$
        select tests.report_as_planned(
          %L::uuid,
          %L::uuid,
          '71000000-aaaa-4000-8000-000000000099'::uuid,
          tests.world_mix_reports('-1', '1.5', '12')
        )
      $statement$,
      (select club_id from alice_club),
      (select cycle_id from alice_day)
    )
  ),
  'vesty.quantity_invalid',
  'Negative quantity is rejected'
);

select extensions.is(
  tests.statement_message(
    format(
      $statement$
        select tests.report_as_planned(
          %L::uuid,
          %L::uuid,
          '71000000-aaaa-4000-8000-000000000099'::uuid,
          tests.world_mix_reports('1e-2', '1.5', '12')
        )
      $statement$,
      (select club_id from alice_club),
      (select cycle_id from alice_day)
    )
  ),
  'vesty.quantity_invalid',
  'Scientific notation quantity is rejected'
);

select extensions.is(
  (
    select participation_outcome::text
    from tests.open_investment_day_v1((select club_id from alice_club))
  ),
  'expected',
  'Rejected reports do not confirm participation'
);

select extensions.is(
  tests.statement_message(
    format(
      $statement$
        select tests.report_as_planned(
          %L::uuid,
          %L::uuid,
          '71000000-aaaa-4000-8000-000000000099'::uuid,
          jsonb_build_array(
            jsonb_build_object(
              'investment_target_id', '32000000-0000-4000-8000-000000000099',
              'quantity', '1'
            ),
            jsonb_build_object(
              'investment_target_id', '31000000-0000-4000-8000-000000000012',
              'quantity', '1.5'
            ),
            jsonb_build_object(
              'investment_target_id', '31000000-0000-4000-8000-000000000013',
              'quantity', '12'
            )
          )
        )
      $statement$,
      (select club_id from alice_club),
      (select cycle_id from alice_day)
    )
  ),
  'vesty.invalid_target',
  'Unknown target id is rejected'
);

select extensions.is(
  tests.statement_message(
    format(
      $statement$
        select tests.report_as_planned(
          %L::uuid,
          %L::uuid,
          '71000000-aaaa-4000-8000-000000000099'::uuid,
          jsonb_build_array(
            jsonb_build_object(
              'investment_target_id', '31000000-0000-4000-8000-000000000014',
              'quantity', '1'
            ),
            jsonb_build_object(
              'investment_target_id', '31000000-0000-4000-8000-000000000012',
              'quantity', '1.5'
            ),
            jsonb_build_object(
              'investment_target_id', '31000000-0000-4000-8000-000000000013',
              'quantity', '12'
            )
          )
        )
      $statement$,
      (select club_id from alice_club),
      (select cycle_id from alice_day)
    )
  ),
  'vesty.invalid_target',
  'Target outside the cycle strategy is rejected'
);

select extensions.is(
  tests.statement_message(
    format(
      $statement$
        select tests.report_as_planned(
          %L::uuid,
          %L::uuid,
          '71000000-aaaa-4000-8000-000000000099'::uuid,
          jsonb_build_array(
            jsonb_build_object(
              'investment_target_id', '31000000-0000-4000-8000-000000000011',
              'quantity', '1'
            ),
            jsonb_build_object(
              'investment_target_id', '31000000-0000-4000-8000-000000000011',
              'quantity', '2'
            ),
            jsonb_build_object(
              'investment_target_id', '31000000-0000-4000-8000-000000000012',
              'quantity', '1.5'
            )
          )
        )
      $statement$,
      (select club_id from alice_club),
      (select cycle_id from alice_day)
    )
  ),
  'vesty.duplicate_execution_report',
  'Duplicate target reports are rejected'
);

select extensions.is(
  (
    select participation_outcome::text
    from tests.open_investment_day_v1((select club_id from alice_club))
  ),
  'expected',
  'Optional quantity may be omitted; incomplete quantity does not confirm this cycle'
);

create temporary table alice_confirm as
select *
from tests.report_as_planned(
  (select club_id from alice_club),
  (select cycle_id from alice_day),
  '71000000-aaaa-4000-8000-000000000001'::uuid,
  tests.world_mix_reports('0.642381', '1.5', '123.000001', '167.54000000', null, null)
);

select extensions.is(
  (select participation_outcome::text from alice_confirm),
  'confirmed',
  'Exact World Mix target set is accepted'
);

select extensions.is(
  (
    select quantity
    from public.member_investment_transactions
    where membership_id = (select membership_id from alice_club)
      and investment_target_id = '31000000-0000-4000-8000-000000000011'
  ),
  0.642381::numeric,
  'Fractional quantity is stored exactly'
);

select extensions.is(
  (
    select quantity
    from public.member_investment_transactions
    where membership_id = (select membership_id from alice_club)
      and investment_target_id = '31000000-0000-4000-8000-000000000013'
  ),
  123.000001::numeric,
  'High-scale fractional quantity is stored exactly'
);

select extensions.is(
  (
    select execution_unit_price
    from public.member_investment_transactions
    where membership_id = (select membership_id from alice_club)
      and investment_target_id = '31000000-0000-4000-8000-000000000011'
  ),
  167.54000000::numeric,
  'Optional EUR execution price is stored as decimal, not øre'
);

select extensions.is(
  (
    select execution_unit_price_currency
    from public.member_investment_transactions
    where membership_id = (select membership_id from alice_club)
      and investment_target_id = '31000000-0000-4000-8000-000000000011'
  ),
  'EUR',
  'Execution price currency is taken from the instrument, not the client'
);

select extensions.is(
  (
    select unit_price_minor
    from public.member_investment_transactions
    where membership_id = (select membership_id from alice_club)
      and investment_target_id = '31000000-0000-4000-8000-000000000011'
  ),
  null,
  'V2 does not write unit_price_minor for EUR ETF prints'
);

select extensions.is(
  (
    select amount_minor
    from public.member_investment_transactions
    where membership_id = (select membership_id from alice_club)
      and investment_target_id = '31000000-0000-4000-8000-000000000011'
  ),
  120000::bigint,
  'Reported amount stays the server-derived allocation'
);

select extensions.is(
  (
    select count(*)
    from public.member_investment_transactions
    where membership_id = (select membership_id from alice_club)
      and source = 'manual'
      and verification_status = 'member_reported'
      and quantity is not null
  ),
  3::bigint,
  'V2 writes member-reported buys, never broker_verified'
);

create temporary table alice_retry as
select *
from tests.report_as_planned(
  (select club_id from alice_club),
  (select cycle_id from alice_day),
  '71000000-aaaa-4000-8000-000000000001'::uuid,
  tests.world_mix_reports('0.642381', '1.5', '123.000001', '167.54000000', null, null)
);

select extensions.is(
  (
    select count(*)
    from public.member_investment_transactions
    where membership_id = (select membership_id from alice_club)
  ),
  3::bigint,
  'Retry with the same reports is idempotent'
);

select extensions.is(
  (select participation_outcome::text from alice_retry),
  'confirmed',
  'Retry returns the confirmed participation'
);

select extensions.is(
  tests.statement_message(
    format(
      $statement$
        select tests.report_as_planned(
          %L::uuid,
          %L::uuid,
          '71000000-aaaa-4000-8000-000000000001'::uuid,
          tests.world_mix_reports('9.999999', '1.5', '123.000001')
        )
      $statement$,
      (select club_id from alice_club),
      (select cycle_id from alice_day)
    )
  ),
  'vesty.report_conflict',
  'A different retry payload cannot overwrite confirmed quantity'
);

select extensions.is(
  (
    select quantity
    from public.member_investment_transactions
    where membership_id = (select membership_id from alice_club)
      and investment_target_id = '31000000-0000-4000-8000-000000000011'
  ),
  0.642381::numeric,
  'Rejected overwrite leaves the original quantity intact'
);

select extensions.is(
  (
    select quantity_status
    from public.member_investment_positions
    where membership_id = (select membership_id from alice_club)
      and investment_target_id = '31000000-0000-4000-8000-000000000011'
  ),
  'complete',
  'Single quantity-complete buy is complete'
);

select extensions.is(
  (
    select current_value
    from public.member_position_valuations_v1
    where membership_id = (select membership_id from alice_club)
      and investment_target_id = '31000000-0000-4000-8000-000000000011'
  ),
  (0.642381::numeric * 168.06000000::numeric),
  'Current value is quantity times latest fresh Marketstack close'
);

select extensions.is(
  (
    select current_value_currency
    from public.member_position_valuations_v1
    where membership_id = (select membership_id from alice_club)
      and investment_target_id = '31000000-0000-4000-8000-000000000011'
  ),
  'EUR',
  'Current value stays in instrument currency'
);

select extensions.is(
  (
    select valuation_status
    from public.member_position_valuations_v1
    where membership_id = (select membership_id from alice_club)
      and investment_target_id = '31000000-0000-4000-8000-000000000012'
  ),
  'price_not_fresh',
  'Stale Marketstack close does not produce a current value'
);

select extensions.is(
  (
    select current_value
    from public.member_position_valuations_v1
    where membership_id = (select membership_id from alice_club)
      and investment_target_id = '31000000-0000-4000-8000-000000000012'
  ),
  null,
  'Stale price leaves current value unavailable'
);

select extensions.is(
  (
    select valuation_status
    from public.member_position_valuations_v1
    where membership_id = (select membership_id from alice_club)
      and investment_target_id = '31000000-0000-4000-8000-000000000013'
  ),
  'no_price',
  'Missing Marketstack close leaves valuation unavailable'
);

select extensions.is(
  (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'member_position_valuations_v1'
      and column_name in ('gain_loss', 'current_value_nok', 'total_value_nok')
  ),
  0::bigint,
  'Valuation view does not invent NOK aggregates or cross-currency gain/loss'
);

select tests.authenticate_as('00000000-0000-4000-8000-000000000072');

select extensions.is(
  (
    select count(*)
    from public.member_position_valuations_v1
    where membership_id = (select membership_id from alice_club)
  ),
  0::bigint,
  'Other member cannot read private quantity or EUR current value'
);

create temporary table bob_day as
select *
from tests.current_investment_day_v1((select club_id from alice_club));

create temporary table bob_confirm as
select *
from tests.report_as_planned(
  (select club_id from alice_club),
  (select cycle_id from bob_day),
  '71000000-aaaa-4000-8000-000000000002'::uuid,
  tests.world_mix_reports('0.123456', '2.5', '3')
);

select extensions.is(
  (
    select quantity
    from public.member_investment_transactions
    where membership_id = (select membership_id from bob_join)
      and investment_target_id = '31000000-0000-4000-8000-000000000011'
  ),
  0.123456::numeric,
  'Second member stores their own fractional quantity'
);

select tests.authenticate_as('00000000-0000-4000-8000-000000000071');

select extensions.is(
  (
    select count(*)
    from public.member_investment_transactions
    where membership_id = (select membership_id from bob_join)
  ),
  0::bigint,
  'Owner cannot read another member private execution quantity'
);

-- Amount-only confirm remains available as the legacy path, then v2 can fill.
create temporary table alice_legacy_amount_club as
select *
from public.create_club(
  'Amount Then Quantity Club',
  'simple_majority',
  'world_mix',
  'NOK'
);

select *
from public.create_member_contribution_commitment_v1(
  (select club_id from alice_legacy_amount_club),
  200000
);

create temporary table alice_legacy_amount_day as
select *
from tests.open_investment_day_v1((select club_id from alice_legacy_amount_club));

create temporary table alice_legacy_amount_confirm as
select *
from tests.report_as_planned(
  (select club_id from alice_legacy_amount_club),
  (select cycle_id from alice_legacy_amount_day),
  '71000000-aaaa-4000-8000-000000000003'::uuid
);

select extensions.is(
  (
    select count(*)
    from public.member_investment_transactions
    where membership_id = (select membership_id from alice_legacy_amount_club)
      and quantity is null
  ),
  3::bigint,
  'Legacy amount-only transactions remain readable with null quantity'
);

select extensions.is(
  (
    select quantity_status
    from public.member_investment_positions
    where membership_id = (select membership_id from alice_legacy_amount_club)
      and investment_target_id = '31000000-0000-4000-8000-000000000011'
  ),
  'unavailable',
  'Amount-only positions do not claim a complete quantity'
);

select extensions.is(
  (
    select valuation_status
    from public.member_position_valuations_v1
    where membership_id = (select membership_id from alice_legacy_amount_club)
      and investment_target_id = '31000000-0000-4000-8000-000000000011'
  ),
  'quantity_incomplete',
  'Missing quantity does not invent a current value from latest price'
);

select extensions.is(
  tests.statement_message(
    format(
      $statement$
        select tests.report_as_planned(
          %L::uuid,
          %L::uuid,
          '71000000-aaaa-4000-8000-000000000003'::uuid,
          tests.world_mix_reports('0.5', '1.25', '2')
        )
      $statement$,
      (select club_id from alice_legacy_amount_club),
      (select cycle_id from alice_legacy_amount_day)
    )
  ),
  'vesty.report_conflict',
  'A later quantity payload cannot overwrite an amount-only report'
);

select extensions.is(
  (
    select quantity
    from public.member_investment_transactions
    where membership_id = (select membership_id from alice_legacy_amount_club)
      and investment_target_id = '31000000-0000-4000-8000-000000000012'
  ),
  null,
  'Rejected quantity overwrite leaves amount-only quantity null'
);

select extensions.is(
  (
    select count(*)
    from public.member_investment_transactions
    where membership_id = (select membership_id from alice_legacy_amount_club)
  ),
  3::bigint,
  'Rejected quantity overwrite does not duplicate amount-only rows'
);

reset role;

insert into public.investment_cycles (
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
  status,
  opened_at,
  closed_at
)
select
  cycle.club_id,
  cycle.investment_schedule_id,
  cycle.strategy_version_id,
  cycle.contribution_policy_version_id,
  cycle.occurrence_key || '-partial',
  cycle.investment_day_at + interval '32 days',
  cycle.configuration_deadline_at + interval '32 days',
  cycle.reporting_opens_at + interval '32 days',
  cycle.reporting_closes_at + interval '32 days',
  cycle.timezone,
  'completed',
  cycle.opened_at,
  now()
from public.investment_cycles as cycle
where cycle.id = (select cycle_id from alice_day);

insert into public.member_investment_transactions (
  club_id,
  membership_id,
  investment_cycle_id,
  investment_target_id,
  transaction_type,
  amount_minor,
  currency,
  quantity,
  executed_at,
  source,
  verification_status,
  amount_provenance
)
select
  club.club_id,
  club.membership_id,
  cycle.id,
  '31000000-0000-4000-8000-000000000011',
  'buy',
  50000,
  'NOK',
  null,
  now(),
  'manual',
  'member_reported',
  'legacy_plan_assumed'
from alice_club as club
join public.investment_cycles as cycle
  on cycle.club_id = club.club_id
 and cycle.occurrence_key like '%-partial';

set local role authenticated;
select tests.authenticate_as('00000000-0000-4000-8000-000000000071');

select extensions.is(
  (
    select quantity_status
    from public.member_investment_positions
    where membership_id = (select membership_id from alice_club)
      and investment_target_id = '31000000-0000-4000-8000-000000000011'
  ),
  'partial',
  'Mixed quantity and amount-only buys are partial, not complete'
);

select extensions.is(
  (
    select total_quantity
    from public.member_investment_positions
    where membership_id = (select membership_id from alice_club)
      and investment_target_id = '31000000-0000-4000-8000-000000000011'
  ),
  0.642381::numeric,
  'Partial positions sum only the reported quantities'
);

select extensions.is(
  (
    select valuation_status
    from public.member_position_valuations_v1
    where membership_id = (select membership_id from alice_club)
      and investment_target_id = '31000000-0000-4000-8000-000000000011'
  ),
  'quantity_incomplete',
  'Partial quantity does not produce a current value'
);

reset role;

-- Legacy KLP/DNB club: amount-only v1 still works; v2 is rejected.
insert into public.clubs (
  id,
  name,
  status,
  base_currency,
  governance_threshold_kind,
  current_owner_membership_id
)
values (
  '21000000-0000-4000-8000-000000000071',
  'Legacy Funds Club',
  'active',
  'NOK',
  'simple_majority',
  '22000000-0000-4000-8000-000000000071'
);

insert into public.club_memberships (
  id,
  club_id,
  profile_id,
  status
)
values (
  '22000000-0000-4000-8000-000000000071',
  '21000000-0000-4000-8000-000000000071',
  '00000000-0000-4000-8000-000000000071',
  'active'
);

insert into public.strategy_versions (
  id,
  club_id,
  version_number,
  created_by_membership_id,
  origin,
  source_proposal_id,
  approved_at,
  effective_at
)
values (
  '23000000-0000-4000-8000-000000000071',
  '21000000-0000-4000-8000-000000000071',
  1,
  '22000000-0000-4000-8000-000000000071',
  'genesis',
  null,
  null,
  now()
);

insert into public.strategy_allocations (
  strategy_version_id,
  investment_target_id,
  allocation_bps,
  position,
  target_name,
  target_kind,
  target_isin,
  target_ticker,
  target_exchange
)
select
  '23000000-0000-4000-8000-000000000071',
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
  club_id,
  version_number,
  mode,
  currency,
  equal_amount_minor,
  created_by_membership_id
)
values (
  '21000000-0000-4000-8000-000000000071',
  1,
  'flexible',
  'NOK',
  null,
  '22000000-0000-4000-8000-000000000071'
);

insert into public.member_contribution_commitment_versions (
  club_id,
  membership_id,
  version_number,
  amount_minor,
  currency
)
values (
  '21000000-0000-4000-8000-000000000071',
  '22000000-0000-4000-8000-000000000071',
  1,
  200000,
  'NOK'
);

set local role authenticated;
select tests.authenticate_as('00000000-0000-4000-8000-000000000071');

create temporary table alice_legacy_day as
select *
from tests.open_investment_day_v1('21000000-0000-4000-8000-000000000071');

select extensions.is(
  tests.statement_message(
    format(
      $statement$
        select tests.report_as_planned(
          '21000000-0000-4000-8000-000000000071'::uuid,
          %L::uuid,
          '71000000-aaaa-4000-8000-000000000098'::uuid,
          tests.world_mix_reports('1', '1', '1')
        )
      $statement$,
      (select cycle_id from alice_legacy_day)
    )
  ),
  'vesty.invalid_target',
  'World Mix target ids are rejected on a legacy KLP/DNB club'
);

create temporary table alice_legacy_confirm as
select *
from tests.report_as_planned(
  '21000000-0000-4000-8000-000000000071',
  (select cycle_id from alice_legacy_day),
  '71000000-aaaa-4000-8000-000000000004'::uuid
);

select extensions.is(
  (
    select count(*)
    from public.member_investment_transactions
    where membership_id = '22000000-0000-4000-8000-000000000071'
      and quantity is null
      and amount_minor > 0
  ),
  4::bigint,
  'Legacy amount-only confirmation still writes KLP/DNB buys'
);

reset role;

select extensions.ok(
  not has_table_privilege('anon', 'public.member_position_valuations_v1', 'select'),
  'Anonymous role cannot read position valuations'
);

select * from extensions.finish();

rollback;
