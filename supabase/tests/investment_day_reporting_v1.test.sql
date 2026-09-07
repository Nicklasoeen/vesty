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

select extensions.no_plan();

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '00000000-0000-4000-8000-000000000091',
    'authenticated', 'authenticated', 'alice-report@example.test', '', now(),
    '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-4000-8000-000000000092',
    'authenticated', 'authenticated', 'bob-report@example.test', '', now(),
    '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-4000-8000-000000000093',
    'authenticated', 'authenticated', 'cara-report@example.test', '', now(),
    '{}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.profiles (id, display_name)
values
  ('00000000-0000-4000-8000-000000000091', 'Alice Report'),
  ('00000000-0000-4000-8000-000000000092', 'Bob Report'),
  ('00000000-0000-4000-8000-000000000093', 'Cara Report');

select extensions.ok(
  has_function_privilege(
    'authenticated',
    'public.report_investment_day_v1(uuid, uuid, uuid, public.investment_day_report_mode, public.participation_outcome, jsonb)',
    'execute'
  ),
  'Authenticated can execute the public reporter'
);

select extensions.ok(
  not has_function_privilege(
    'authenticated',
    'private.report_investment_day_v1(uuid, uuid, uuid, public.investment_day_report_mode, public.participation_outcome, jsonb)',
    'execute'
  ),
  'Authenticated cannot execute the private reporter'
);

select extensions.ok(
  not has_function_privilege(
    'authenticated',
    'public.confirm_investment_day_v1(uuid, uuid)',
    'execute'
  ),
  'Authenticated cannot execute confirm v1'
);

select extensions.ok(
  not has_function_privilege(
    'authenticated',
    'public.confirm_investment_day_v2(uuid, uuid, jsonb)',
    'execute'
  ),
  'Authenticated cannot execute confirm v2'
);

select extensions.ok(
  not has_function_privilege(
    'authenticated',
    'private.confirm_investment_day_v1(uuid, uuid)',
    'execute'
  ),
  'Authenticated cannot execute private confirm v1'
);

select extensions.ok(
  not has_function_privilege(
    'authenticated',
    'private.confirm_investment_day_v2(uuid, uuid, jsonb)',
    'execute'
  ),
  'Authenticated cannot execute private confirm v2'
);

select extensions.ok(
  not has_table_privilege('authenticated', 'public.member_cycle_participations', 'update'),
  'Authenticated cannot update participations directly'
);

select extensions.ok(
  not has_table_privilege('authenticated', 'public.member_investment_day_reports', 'insert'),
  'Authenticated cannot insert reports directly'
);

select extensions.ok(
  has_function_privilege(
    'authenticated',
    'public.current_investment_day_v1(uuid)',
    'execute'
  ),
  'Authenticated can execute the read-only current Investment Day'
);

select extensions.ok(
  not has_function_privilege(
    'authenticated',
    'public.ensure_open_investment_day_v1(uuid)',
    'execute'
  ),
  'Authenticated cannot execute the retired writing ensure-open'
);

select extensions.ok(
  not has_function_privilege(
    'authenticated',
    'private.ensure_open_investment_day_v1(uuid)',
    'execute'
  ),
  'Authenticated cannot execute private ensure-open'
);

select extensions.ok(
  not has_function_privilege(
    'authenticated',
    'public.advance_investment_cycles_v1(timestamptz, uuid)',
    'execute'
  ),
  'Authenticated cannot execute the trusted lifecycle mutation'
);

select extensions.ok(
  not has_function_privilege(
    'authenticated',
    'private.report_investment_day_at_v1(uuid, uuid, uuid, public.investment_day_report_mode, public.participation_outcome, jsonb, timestamptz)',
    'execute'
  ),
  'Authenticated cannot execute the clock-parameter reporter'
);

select extensions.ok(
  not has_function_privilege(
    'authenticated',
    'private.current_investment_day_v1(uuid, timestamptz)',
    'execute'
  ),
  'Authenticated cannot execute the clock-parameter current-day reader'
);

select extensions.ok(
  pg_catalog.pg_get_function_identity_arguments(
    'public.report_investment_day_v1(uuid, uuid, uuid, public.investment_day_report_mode, public.participation_outcome, jsonb)'::regprocedure
  ) !~ 'timestamptz',
  'Public reporter does not accept a client clock'
);

set local role authenticated;
select tests.authenticate_as('00000000-0000-4000-8000-000000000091');

create temporary table alice_club as
select *
from public.create_club(
  'Reporting Club',
  'simple_majority',
  'world_mix',
  'NOK'
);

select *
from public.create_member_contribution_commitment_v1(
  (select club_id from alice_club),
  200000
);

create temporary table alice_day as
select *
from tests.open_investment_day_v1((select club_id from alice_club));

select extensions.is(
  (select expected_amount_minor from alice_day),
  200000::bigint,
  'Frozen plan is 2000 kr'
);

create temporary table alice_partial as
select *
from tests.report_investment_day_at_v1(
  (select club_id from alice_club),
  (select cycle_id from alice_day),
  '91000000-0000-4000-8000-000000000001'::uuid,
  'with_changes',
  'confirmed',
  jsonb_build_array(
    jsonb_build_object(
      'investment_target_id', '31000000-0000-4000-8000-000000000011',
      'amount_minor', 80000
    ),
    jsonb_build_object(
      'investment_target_id', '31000000-0000-4000-8000-000000000012',
      'amount_minor', 60000
    )
  )
);

select extensions.is(
  (
    select coalesce(sum(amount_minor), 0)::bigint
    from public.member_investment_transactions
    where membership_id = (select membership_id from alice_club)
      and investment_cycle_id = (select cycle_id from alice_day)
  ),
  140000::bigint,
  'Plan of 2000 kr with 1400 kr reported stores exactly 1400 kr'
);

select extensions.is(
  (
    select count(*)
    from public.member_investment_transactions
    where membership_id = (select membership_id from alice_club)
      and investment_cycle_id = (select cycle_id from alice_day)
      and investment_target_id = '31000000-0000-4000-8000-000000000013'
  ),
  0::bigint,
  'An omitted planned target does not receive a purchase row'
);

select extensions.is(
  (
    select amount_provenance::text
    from public.member_investment_transactions
    where membership_id = (select membership_id from alice_club)
      and investment_target_id = '31000000-0000-4000-8000-000000000011'
  ),
  'member_reported_actual',
  'Changed amounts are member_reported_actual'
);

select extensions.is(
  (select participation_outcome::text from alice_partial),
  'confirmed',
  'Partial purchases still confirm participation'
);

create temporary table alice_retry as
select *
from tests.report_investment_day_at_v1(
  (select club_id from alice_club),
  (select cycle_id from alice_day),
  '91000000-0000-4000-8000-000000000001'::uuid,
  'with_changes',
  'confirmed',
  jsonb_build_array(
    jsonb_build_object(
      'investment_target_id', '31000000-0000-4000-8000-000000000011',
      'amount_minor', 80000
    ),
    jsonb_build_object(
      'investment_target_id', '31000000-0000-4000-8000-000000000012',
      'amount_minor', 60000
    )
  )
);

select extensions.is(
  (
    select count(*)
    from public.member_investment_transactions
    where membership_id = (select membership_id from alice_club)
      and investment_cycle_id = (select cycle_id from alice_day)
  ),
  2::bigint,
  'Retry with the same client report id does not duplicate purchases'
);

select extensions.is(
  tests.statement_message(
    format(
      $statement$
        select tests.report_investment_day_at_v1(
          %L::uuid,
          %L::uuid,
          '91000000-0000-4000-8000-000000000001'::uuid,
          'with_changes',
          'confirmed',
          jsonb_build_array(
            jsonb_build_object(
              'investment_target_id', '31000000-0000-4000-8000-000000000011',
              'amount_minor', 140000
            )
          )
        )
      $statement$,
      (select club_id from alice_club),
      (select cycle_id from alice_day)
    )
  ),
  'vesty.report_conflict',
  'A different payload with the same client report id is rejected'
);

select extensions.is(
  tests.statement_message(
    format(
      $statement$
        select tests.report_investment_day_at_v1(
          %L::uuid,
          %L::uuid,
          '91000000-0000-4000-8000-000000000099'::uuid,
          'as_planned',
          'confirmed',
          '[]'::jsonb
        )
      $statement$,
      (select club_id from alice_club),
      (select cycle_id from alice_day)
    )
  ),
  'vesty.report_conflict',
  'A new client report id after completion is rejected'
);

select extensions.is(
  (
    select coalesce(sum(amount_minor), 0)::bigint
    from public.member_investment_transactions
    where membership_id = (select membership_id from alice_club)
      and investment_cycle_id = (select cycle_id from alice_day)
  ),
  140000::bigint,
  'Rejected conflict leaves the original 1400 kr intact'
);

select extensions.is(
  tests.statement_sqlstate(
    $statement$
      update public.member_cycle_participations
      set outcome = 'skipped',
          report_source = 'member_reported',
          reported_at = now()
      where membership_id = (select membership_id from alice_club)
    $statement$
  ),
  '42501',
  'Direct RLS updates of participation are rejected'
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
  existing.club_id,
  existing.investment_schedule_id,
  existing.strategy_version_id,
  existing.contribution_policy_version_id,
  existing.occurrence_key || '-legacy',
  existing.investment_day_at + interval '32 days',
  existing.configuration_deadline_at + interval '32 days',
  existing.reporting_opens_at + interval '32 days',
  existing.reporting_closes_at + interval '32 days',
  existing.timezone,
  'completed',
  existing.opened_at,
  now()
from public.investment_cycles as existing
where existing.id = (select cycle_id from alice_day);

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
select
  club.club_id,
  club.membership_id,
  cycle.id,
  '31000000-0000-4000-8000-000000000011',
  'buy',
  50000,
  'NOK',
  now(),
  'manual',
  'member_reported',
  'legacy_plan_assumed'
from alice_club as club
join public.investment_cycles as cycle
  on cycle.club_id = club.club_id
 and cycle.occurrence_key like '%-legacy';

select extensions.is(
  (
    select amount_provenance::text
    from public.member_investment_transactions
    where membership_id = (select membership_id from alice_club)
      and amount_minor = 50000
      and investment_cycle_id in (
        select id
        from public.investment_cycles
        where club_id = (select club_id from alice_club)
          and occurrence_key like '%-legacy'
      )
  ),
  'legacy_plan_assumed',
  'Historical v1/v2 amounts keep legacy_plan_assumed provenance'
);

set local role authenticated;
select tests.authenticate_as('00000000-0000-4000-8000-000000000091');

create temporary table alice_planned_club as
select *
from public.create_club(
  'Planned Report Club',
  'simple_majority',
  'world_mix',
  'NOK'
);

select *
from public.create_member_contribution_commitment_v1(
  (select club_id from alice_planned_club),
  200000
);

create temporary table alice_planned_day as
select *
from tests.open_investment_day_v1((select club_id from alice_planned_club));

create temporary table alice_planned as
select *
from tests.report_investment_day_at_v1(
  (select club_id from alice_planned_club),
  (select cycle_id from alice_planned_day),
  '91000000-0000-4000-8000-000000000002'::uuid,
  'as_planned',
  'confirmed',
  '[]'::jsonb
);

select extensions.is(
  (
    select coalesce(sum(amount_minor), 0)::bigint
    from public.member_investment_transactions
    where membership_id = (select membership_id from alice_planned_club)
  ),
  200000::bigint,
  'as_planned stores the full frozen plan after attestation'
);

select extensions.is(
  (
    select count(distinct amount_provenance::text)
    from public.member_investment_transactions
    where membership_id = (select membership_id from alice_planned_club)
      and amount_provenance = 'member_attested_plan'
  ),
  1::bigint,
  'as_planned provenance is member_attested_plan'
);

create temporary table alice_skip_club as
select *
from public.create_club(
  'Skip Report Club',
  'simple_majority',
  'world_mix',
  'NOK'
);

select *
from public.create_member_contribution_commitment_v1(
  (select club_id from alice_skip_club),
  200000
);

create temporary table alice_skip_day as
select *
from tests.open_investment_day_v1((select club_id from alice_skip_club));

create temporary table alice_skipped as
select *
from tests.report_investment_day_at_v1(
  (select club_id from alice_skip_club),
  (select cycle_id from alice_skip_day),
  '91000000-0000-4000-8000-000000000003'::uuid,
  'with_changes',
  'skipped',
  '[]'::jsonb
);

select extensions.is(
  (select participation_outcome::text from alice_skipped),
  'skipped',
  'Skipped reports store skipped participation'
);

select extensions.is(
  (
    select count(*)
    from public.member_investment_transactions
    where membership_id = (select membership_id from alice_skip_club)
  ),
  0::bigint,
  'Skipped reports create no purchase rows'
);

create temporary table alice_fail_club as
select *
from public.create_club(
  'Fail Report Club',
  'simple_majority',
  'world_mix',
  'NOK'
);

select *
from public.create_member_contribution_commitment_v1(
  (select club_id from alice_fail_club),
  200000
);

create temporary table alice_fail_day as
select *
from tests.open_investment_day_v1((select club_id from alice_fail_club));

create temporary table alice_failed as
select *
from tests.report_investment_day_at_v1(
  (select club_id from alice_fail_club),
  (select cycle_id from alice_fail_day),
  '91000000-0000-4000-8000-000000000004'::uuid,
  'with_changes',
  'failed',
  '[]'::jsonb
);

select extensions.is(
  (
    select count(*)
    from public.member_investment_transactions
    where membership_id = (select membership_id from alice_fail_club)
  ),
  0::bigint,
  'Failed reports create no purchase rows'
);

create temporary table alice_omit_zero_club as
select *
from public.create_club(
  'Zero Omit Club',
  'simple_majority',
  'world_mix',
  'NOK'
);

select *
from public.create_member_contribution_commitment_v1(
  (select club_id from alice_omit_zero_club),
  200000
);

create temporary table alice_omit_zero_day as
select *
from tests.open_investment_day_v1((select club_id from alice_omit_zero_club));

create temporary table alice_omit_zero as
select *
from tests.report_investment_day_at_v1(
  (select club_id from alice_omit_zero_club),
  (select cycle_id from alice_omit_zero_day),
  '91000000-0000-4000-8000-000000000005'::uuid,
  'with_changes',
  'confirmed',
  jsonb_build_array(
    jsonb_build_object(
      'investment_target_id', '31000000-0000-4000-8000-000000000011',
      'amount_minor', 140000
    ),
    jsonb_build_object(
      'investment_target_id', '31000000-0000-4000-8000-000000000012',
      'amount_minor', 0
    )
  )
);

select extensions.is(
  (
    select count(*)
    from public.member_investment_transactions
    where membership_id = (select membership_id from alice_omit_zero_club)
  ),
  1::bigint,
  'A zero amount line is omitted rather than stored'
);

create temporary table alice_partial_qty_club as
select *
from public.create_club(
  'Partial Quantity Club',
  'simple_majority',
  'world_mix',
  'NOK'
);

select *
from public.create_member_contribution_commitment_v1(
  (select club_id from alice_partial_qty_club),
  200000
);

create temporary table alice_partial_qty_day as
select *
from tests.open_investment_day_v1((select club_id from alice_partial_qty_club));

create temporary table alice_partial_qty as
select *
from tests.report_investment_day_at_v1(
  (select club_id from alice_partial_qty_club),
  (select cycle_id from alice_partial_qty_day),
  '91000000-0000-4000-8000-000000000006'::uuid,
  'as_planned',
  'confirmed',
  jsonb_build_array(
    jsonb_build_object(
      'investment_target_id', '31000000-0000-4000-8000-000000000011',
      'quantity', '0.5'
    )
  )
);

select extensions.is(
  (
    select coalesce(sum(amount_minor), 0)::bigint
    from public.member_investment_transactions
    where membership_id = (select membership_id from alice_partial_qty_club)
  ),
  200000::bigint,
  'as_planned with partial quantity still stores the full plan amounts'
);

select extensions.is(
  (
    select quantity
    from public.member_investment_transactions
    where membership_id = (select membership_id from alice_partial_qty_club)
      and investment_target_id = '31000000-0000-4000-8000-000000000012'
  ),
  null,
  'Unspecified quantity stays null and does not use plan amount as cost'
);

select extensions.is(
  tests.statement_sqlstate(
    $statement$
      insert into public.member_investment_day_reports (
        club_id,
        membership_id,
        investment_cycle_id,
        client_report_id,
        report_mode,
        outcome,
        payload_fingerprint
      )
      values (
        (select club_id from alice_planned_club),
        (select membership_id from alice_planned_club),
        (select cycle_id from alice_planned_day),
        '91000000-0000-4000-8000-000000000077'::uuid,
        'as_planned',
        'confirmed',
        repeat('a', 64)
      )
    $statement$
  ),
  '42501',
  'Authenticated cannot insert reports directly'
);

create temporary table bob_invite as
select *
from public.create_club_invitation((select club_id from alice_planned_club));

reset role;

set local role authenticated;
select tests.authenticate_as('00000000-0000-4000-8000-000000000092');

create temporary table bob_join as
select *
from public.accept_club_invitation((select invite_token from bob_invite));

select *
from public.create_member_contribution_commitment_v1(
  (select club_id from alice_planned_club),
  150000
);

create temporary table bob_day as
select *
from tests.open_investment_day_v1((select club_id from alice_planned_club));

select extensions.is(
  (
    select count(*)
    from public.member_investment_day_reports
    where membership_id = (select membership_id from alice_planned_club)
  ),
  0::bigint,
  'Another member cannot read private report rows'
);

select extensions.is(
  (
    select count(*)
    from public.member_investment_transactions
    where membership_id = (select membership_id from alice_planned_club)
  ),
  0::bigint,
  'Another member cannot read private purchase lines'
);

select extensions.is(
  (
    select completed
    from public.club_investment_day_participation_v1(
      (select club_id from alice_planned_club),
      (select cycle_id from alice_planned_day)
    )
    where membership_id = (select membership_id from alice_planned_club)
  ),
  true,
  'Social RPC shows allowed completed status'
);

select extensions.is(
  (
    select verification_level
    from public.club_investment_day_participation_v1(
      (select club_id from alice_planned_club),
      (select cycle_id from alice_planned_day)
    )
    where membership_id = (select membership_id from alice_planned_club)
  ),
  'member_reported',
  'Social RPC does not expose amounts or deviations'
);

select extensions.is(
  tests.statement_sqlstate(
    format(
      $statement$
        insert into public.member_investment_day_reports (
          club_id,
          membership_id,
          investment_cycle_id,
          client_report_id,
          report_mode,
          outcome,
          payload_fingerprint
        )
        values (
          %L::uuid,
          %L::uuid,
          %L::uuid,
          '92000000-0000-4000-8000-000000000001'::uuid,
          'as_planned',
          'confirmed',
          repeat('b', 64)
        )
      $statement$,
      (select club_id from alice_planned_club),
      (select membership_id from alice_planned_club),
      (select cycle_id from alice_planned_day)
    )
  ),
  '42501',
  'Another member cannot insert a report for the owner'
);

select tests.authenticate_as('00000000-0000-4000-8000-000000000093');

select extensions.is(
  tests.statement_message(
    format(
      $statement$
        select tests.report_investment_day_at_v1(
          %L::uuid,
          %L::uuid,
          '93000000-0000-4000-8000-000000000001'::uuid,
          'as_planned',
          'confirmed',
          '[]'::jsonb
        )
      $statement$,
      (select club_id from alice_planned_club),
      (select cycle_id from alice_planned_day)
    )
  ),
  'vesty.not_club_member',
  'An outsider cannot write private reports'
);

select extensions.is(
  (
    select count(*)
    from public.member_investment_day_reports
  ),
  0::bigint,
  'An outsider cannot read private reports'
);

reset role;

update public.club_memberships
set status = 'left', ended_at = now()
where id = (select membership_id from bob_join);

set local role authenticated;
select tests.authenticate_as('00000000-0000-4000-8000-000000000092');

select extensions.is(
  (
    select count(*)
    from public.member_investment_day_reports
    where membership_id = (select membership_id from bob_join)
  ),
  0::bigint,
  'A former member cannot read private reports'
);

select extensions.is(
  tests.statement_message(
    format(
      $statement$
        select tests.report_investment_day_at_v1(
          %L::uuid,
          %L::uuid,
          '92000000-0000-4000-8000-000000000002'::uuid,
          'as_planned',
          'confirmed',
          '[]'::jsonb
        )
      $statement$,
      (select club_id from alice_planned_club),
      (select cycle_id from bob_day)
    )
  ),
  'vesty.not_club_member',
  'A former member cannot write private reports'
);

reset role;
set local role anon;

select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.report_investment_day_v1(uuid, uuid, uuid, public.investment_day_report_mode, public.participation_outcome, jsonb)',
    'execute'
  ),
  'Anonymous cannot execute the reporter'
);

select extensions.ok(
  not has_table_privilege('anon', 'public.member_investment_day_reports', 'select'),
  'Anonymous cannot read reports'
);

select * from extensions.finish();

rollback;
