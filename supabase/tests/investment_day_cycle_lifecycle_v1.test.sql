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
grant execute on function tests.statement_message(text) to authenticated;


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
set row_security = off
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
set row_security = off
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
set row_security = off
as $function$
  select *
  from private.club_investment_day_participation_at_v1(p_club_id, p_cycle_id, p_now);
$function$;

grant execute on function tests.open_investment_day_v1(uuid, timestamptz) to authenticated;
grant execute on function tests.current_investment_day_v1(uuid, timestamptz) to authenticated;
grant execute on function tests.advance_investment_cycles_v1(uuid, timestamptz) to authenticated;
grant execute on function tests.report_investment_day_at_v1(uuid, uuid, uuid, public.investment_day_report_mode, public.participation_outcome, jsonb, timestamptz) to authenticated;
grant execute on function tests.club_investment_day_participation_at_v1(uuid, uuid, timestamptz) to authenticated;

create function tests.cycle_participation_count_v1(p_cycle_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
set row_security = off
as $function$
  select count(*)
  from public.member_cycle_participations as participation
  where participation.investment_cycle_id = p_cycle_id;
$function$;

create function tests.cycle_participation_expected_v1(p_cycle_id uuid, p_membership_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
set row_security = off
as $function$
  select participation.expected_amount_minor
  from public.member_cycle_participations as participation
  where participation.investment_cycle_id = p_cycle_id
    and participation.membership_id = p_membership_id;
$function$;

grant execute on function tests.cycle_participation_count_v1(uuid) to authenticated;
grant execute on function tests.cycle_participation_expected_v1(uuid, uuid) to authenticated;

select extensions.no_plan();

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-4000-8000-0000000000c1', 'authenticated', 'authenticated', 'alice-cycle@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-0000000000c2', 'authenticated', 'authenticated', 'bob-cycle@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-0000000000c3', 'authenticated', 'authenticated', 'cara-cycle@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-0000000000c4', 'authenticated', 'authenticated', 'dana-cycle@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-0000000000c5', 'authenticated', 'authenticated', 'eve-cycle@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-0000000000c6', 'authenticated', 'authenticated', 'finn-cycle@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.profiles (id, display_name)
values
  ('00000000-0000-4000-8000-0000000000c1', 'Alice Cycle'),
  ('00000000-0000-4000-8000-0000000000c2', 'Bob Silent'),
  ('00000000-0000-4000-8000-0000000000c3', 'Cara Late'),
  ('00000000-0000-4000-8000-0000000000c4', 'Dana Flexible'),
  ('00000000-0000-4000-8000-0000000000c5', 'Eve Flexible'),
  ('00000000-0000-4000-8000-0000000000c6', 'Finn Winter');

select extensions.is(
  private.investment_occurrence_at_v1(2026, 9, 5, 'last_day_of_month', 'Europe/Oslo'),
  timestamptz '2026-09-05 10:00:00+00',
  'Summer Investment Day is 12:00 Europe/Oslo (CEST = UTC+2)'
);

select extensions.is(
  private.investment_occurrence_at_v1(2026, 1, 15, 'last_day_of_month', 'Europe/Oslo'),
  timestamptz '2026-01-15 11:00:00+00',
  'Winter Investment Day is 12:00 Europe/Oslo (CET = UTC+1)'
);

select extensions.is(
  private.investment_occurrence_at_v1(2026, 2, 31, 'last_day_of_month', 'Europe/Oslo'),
  timestamptz '2026-02-28 11:00:00+00',
  'last_day_of_month clamps 31 to 28 February 2026 at local noon'
);

select extensions.is(
  private.investment_occurrence_key_v1(
    timestamptz '2026-09-05 10:00:00+00',
    'Europe/Oslo'
  ),
  '2026-09-05',
  'Occurrence keys are local calendar dates'
);

select extensions.ok(
  has_function_privilege('service_role', 'public.advance_investment_cycles_v1(timestamptz, uuid)', 'execute'),
  'service_role can execute the trusted lifecycle mutation'
);

set local role authenticated;
select tests.authenticate_as('00000000-0000-4000-8000-0000000000c1');

create temporary table equal_club as
select *
from public.create_club_v2(
  'Cycle Equal Club',
  'simple_majority',
  'world_mix',
  'equal',
  200000,
  null,
  'NOK'
);

create temporary table bob_invite as
select *
from public.create_club_invitation((select club_id from equal_club));

select tests.authenticate_as('00000000-0000-4000-8000-0000000000c2');

create temporary table bob_join as
select *
from public.accept_club_invitation((select invite_token from bob_invite));

select tests.authenticate_as('00000000-0000-4000-8000-0000000000c1');

select extensions.is(
  (
    select count(*)
    from public.club_memberships
    where club_id = (select club_id from equal_club)
      and status = 'active'
  ),
  2::bigint,
  'Equal club has the owner and a silent member before freeze'
);

select extensions.is(
  (select viewer_state from tests.current_investment_day_v1((select club_id from equal_club))),
  'missing',
  'Reading Home/Invest before a trusted job creates a cycle returns missing'
);

create temporary table before_open as
select *
from tests.open_investment_day_v1(
  (select club_id from equal_club),
  timestamptz '2026-09-05 09:59:59+00'
);

select extensions.is(
  (select viewer_state from before_open),
  'upcoming',
  '11:59:59 local time is still upcoming'
);

select extensions.is(
  (select reporting_allowed from before_open),
  false,
  'Reporting is not allowed before local noon'
);

select extensions.ok(
  exists (
    select 1
    from public.club_memberships as membership
    join public.investment_cycles as cycle
      on cycle.club_id = membership.club_id
    where cycle.id = (select cycle_id from before_open)
      and membership.id = (select membership_id from bob_join)
      and membership.joined_at <= cycle.configuration_deadline_at
      and (membership.ended_at is null or membership.ended_at > cycle.configuration_deadline_at)
  ),
  'Silent member is eligible for the frozen September roster'
);

select extensions.is(
  tests.statement_message(
    format(
      $statement$
        select tests.report_investment_day_at_v1(
          %L::uuid, %L::uuid, 'c1000000-0000-4000-8000-000000000001'::uuid,
          'as_planned', 'confirmed', '[]'::jsonb,
          timestamptz '2026-09-05 09:59:59+00'
        )
      $statement$,
      (select club_id from equal_club),
      (select cycle_id from before_open)
    )
  ),
  'vesty.reporting_not_open',
  'Reporting at 11:59:59 local time is rejected'
);

select extensions.is(
  (
    select count(*)
    from public.member_investment_day_reports
    where investment_cycle_id = (select cycle_id from before_open)
  ),
  0::bigint,
  'Rejected pre-open report does not write a report row'
);

create temporary table open_day as
select *
from tests.open_investment_day_v1(
  (select club_id from equal_club),
  timestamptz '2026-09-05 10:00:00+00'
);

select extensions.is(
  (select viewer_state from open_day),
  'open',
  '12:00:00 local time opens reporting'
);

select extensions.is(
  (select reporting_allowed from open_day),
  true,
  'Reporting is allowed at local noon'
);

select extensions.is(
  tests.cycle_participation_count_v1((select cycle_id from open_day)),
  2::bigint,
  'Freeze includes a member who never opened the app'
);

select extensions.is(
  tests.cycle_participation_expected_v1(
    (select cycle_id from open_day),
    (select membership_id from bob_join)
  ),
  200000::bigint,
  'Silent equal member is frozen at the shared amount'
);

create temporary table noon_report as
select *
from tests.report_investment_day_at_v1(
  (select club_id from equal_club),
  (select cycle_id from open_day),
  'c1000000-0000-4000-8000-000000000001'::uuid,
  'as_planned',
  'confirmed',
  '[]'::jsonb,
  timestamptz '2026-09-05 10:00:00+00'
);

select extensions.is(
  (select participation_outcome::text from noon_report),
  'confirmed',
  'Reporting is accepted at exact opening'
);

create temporary table retry_after_open as
select *
from tests.report_investment_day_at_v1(
  (select club_id from equal_club),
  (select cycle_id from open_day),
  'c1000000-0000-4000-8000-000000000001'::uuid,
  'as_planned',
  'confirmed',
  '[]'::jsonb,
  timestamptz '2026-09-05 10:00:00+00'
);

select extensions.is(
  (select participation_outcome::text from retry_after_open),
  'confirmed',
  'F01/F02 identical retry remains idempotent'
);

select extensions.is(
  tests.statement_message(
    format(
      $statement$
        select tests.report_investment_day_at_v1(
          %L::uuid, %L::uuid, 'c1000000-0000-4000-8000-000000000099'::uuid,
          'with_changes', 'confirmed', jsonb_build_array(
            jsonb_build_object(
              'investment_target_id', '31000000-0000-4000-8000-000000000011',
              'amount_minor', 140000
            )
          ),
          timestamptz '2026-09-05 10:00:00+00'
        )
      $statement$,
      (select club_id from equal_club),
      (select cycle_id from open_day)
    )
  ),
  'vesty.report_conflict',
  'F01/F02 different payload after a finished report is conflict'
);

select tests.advance_investment_cycles_v1(
  (select club_id from equal_club),
  timestamptz '2026-09-05 10:00:00+00'
);

select tests.advance_investment_cycles_v1(
  (select club_id from equal_club),
  timestamptz '2026-09-05 10:00:00+00'
);

select extensions.is(
  (
    select count(*)
    from generate_series(1, 8) as attempt(n)
    cross join lateral tests.advance_investment_cycles_v1(
      (select club_id from equal_club),
      timestamptz '2026-09-05 10:00:00+00'
    ) as advanced
  ),
  8::bigint,
  'Overlapping lifecycle calls all complete against the same club'
);

select extensions.is(
  (
    select count(*)
    from public.investment_cycles
    where club_id = (select club_id from equal_club)
      and occurrence_key = '2026-09-05'
  ),
  1::bigint,
  'Repeated lifecycle calls create the September occurrence once'
);

select extensions.is(
  tests.cycle_participation_count_v1((select cycle_id from open_day)),
  2::bigint,
  'Repeated lifecycle calls do not duplicate frozen participations'
);

select tests.authenticate_as('00000000-0000-4000-8000-0000000000c2');

create temporary table second_before_close as
select *
from tests.report_investment_day_at_v1(
  (select club_id from equal_club),
  (select cycle_id from open_day),
  'c2000000-0000-4000-8000-000000000001'::uuid,
  'as_planned',
  'confirmed',
  '[]'::jsonb,
  timestamptz '2026-09-12 09:59:59+00'
);

select extensions.is(
  (select participation_outcome::text from second_before_close),
  'confirmed',
  'Reporting is accepted one second before close'
);

select tests.authenticate_as('00000000-0000-4000-8000-0000000000c1');

create temporary table cara_invite as
select *
from public.create_club_invitation((select club_id from equal_club));

select tests.authenticate_as('00000000-0000-4000-8000-0000000000c3');

create temporary table cara_join as
select *
from public.accept_club_invitation((select invite_token from cara_invite));

select extensions.is(
  (select viewer_state from tests.current_investment_day_v1(
    (select club_id from equal_club),
    timestamptz '2026-09-05 12:00:00+00'
  )),
  'not_in_snapshot',
  'Late joiner is not in the frozen snapshot'
);

select extensions.is(
  (
    select member_count
    from tests.club_investment_day_participation_at_v1(
      (select club_id from equal_club),
      (select cycle_id from open_day)
    )
    limit 1
  ),
  2,
  'Social history stays on the frozen snapshot after a late join'
);

select extensions.is(
  (
    select all_completed
    from tests.club_investment_day_participation_at_v1(
      (select club_id from equal_club),
      (select cycle_id from open_day)
    )
    limit 1
  ),
  true,
  'Late join cannot flip all_completed on a finished snapshot'
);

select extensions.is(
  (
    select count(*)
    from tests.club_investment_day_participation_at_v1(
      (select club_id from equal_club),
      (select cycle_id from open_day)
    ) as participation
    where to_jsonb(participation) ? 'expected_amount_minor'
       or to_jsonb(participation) ? 'amount_minor'
       or to_jsonb(participation) ? 'quantity'
       or to_jsonb(participation) ? 'execution_unit_price'
  ),
  0::bigint,
  'Snapshot social rows leak no money, quantity, or price'
);

reset role;

update public.club_memberships
set status = 'left',
    ended_at = timestamptz '2026-09-05 15:00:00+00'
where id = (select membership_id from bob_join);

set local role authenticated;
select tests.authenticate_as('00000000-0000-4000-8000-0000000000c1');

select extensions.is(
  (
    select count(*)
    from tests.club_investment_day_participation_at_v1(
      (select club_id from equal_club),
      (select cycle_id from open_day)
    )
  ),
  2::bigint,
  'Leaving after freeze does not remove historical participation'
);

reset role;

select extensions.is(
  tests.statement_message(
    format(
      $statement$
        update public.investment_cycles
        set contribution_policy_version_id = contribution_policy_version_id
        where id = %L::uuid
      $statement$,
      (select cycle_id from open_day)
    )
  ),
  null,
  'No-op policy update on a frozen cycle is allowed'
);

create temporary table later_equal_policy as
select *
from private.create_contribution_policy_version_v1(
  (select club_id from equal_club),
  'equal',
  350000
);

select extensions.is(
  tests.statement_message(
    format(
      $statement$
        update public.investment_cycles
        set contribution_policy_version_id = %L::uuid
        where id = %L::uuid
      $statement$,
      (select policy_version_id from later_equal_policy),
      (select cycle_id from open_day)
    )
  ),
  'vesty.cycle_policy_frozen',
  'A later policy cannot rewrite a frozen cycle'
);

select extensions.is(
  (
    select expected_amount_minor
    from public.member_cycle_participations
    where investment_cycle_id = (select cycle_id from open_day)
      and membership_id = (select membership_id from equal_club)
  ),
  200000::bigint,
  'Frozen expected amounts stay at the deadline snapshot'
);

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
  roster_frozen_at
)
select
  cycle.club_id,
  cycle.investment_schedule_id,
  cycle.strategy_version_id,
  cycle.contribution_policy_version_id,
  'stale-open-60d',
  timestamptz '2026-07-07 10:00:00+00',
  timestamptz '2026-07-04 10:00:00+00',
  timestamptz '2026-07-07 10:00:00+00',
  timestamptz '2026-07-14 10:00:00+00',
  cycle.timezone,
  'open',
  timestamptz '2026-07-07 10:00:00+00',
  timestamptz '2026-07-04 10:00:00+00'
from public.investment_cycles as cycle
where cycle.id = (select cycle_id from open_day);

select public.advance_investment_cycles_v1(
  timestamptz '2026-09-05 10:00:00+00',
  (select club_id from equal_club)
);

select extensions.is(
  (
    select occurrence_key
    from public.investment_cycles
    where club_id = (select club_id from equal_club)
      and reporting_opens_at <= timestamptz '2026-09-05 10:00:00+00'
      and timestamptz '2026-09-05 10:00:00+00' < reporting_closes_at
    order by investment_day_at desc
    limit 1
  ),
  '2026-09-05',
  'A 60-day-old open row is not reused as the current occurrence'
);

select extensions.is(
  (
    select status::text
    from public.investment_cycles
    where club_id = (select club_id from equal_club)
      and occurrence_key = 'stale-open-60d'
  ),
  'completed',
  'A delayed lifecycle marks the stale open row completed'
);

set local role authenticated;
select tests.authenticate_as('00000000-0000-4000-8000-0000000000c1');

create temporary table window_club as
select *
from public.create_club_v2(
  'Cycle Window Club',
  'simple_majority',
  'world_mix',
  'equal',
  200000,
  null,
  'NOK'
);

set local role authenticated;
select tests.authenticate_as('00000000-0000-4000-8000-0000000000c1');

create temporary table window_day as
select *
from tests.open_investment_day_v1(
  (select club_id from window_club),
  timestamptz '2026-09-05 10:00:00+00'
);

reset role;

update public.investment_cycles
set status = 'open'
where id = (select cycle_id from window_day)
  and status = 'open';

set local role authenticated;
select tests.authenticate_as('00000000-0000-4000-8000-0000000000c1');

select extensions.is(
  tests.statement_message(
    format(
      $statement$
        select tests.report_investment_day_at_v1(
          %L::uuid, %L::uuid, 'c1000000-0000-4000-8000-000000000011'::uuid,
          'as_planned', 'confirmed', '[]'::jsonb,
          timestamptz '2026-09-12 10:00:00+00'
        )
      $statement$,
      (select club_id from window_club),
      (select cycle_id from window_day)
    )
  ),
  'vesty.reporting_closed',
  'Reporting at exact close is rejected'
);

select extensions.is(
  tests.statement_message(
    format(
      $statement$
        select tests.report_investment_day_at_v1(
          %L::uuid, %L::uuid, 'c1000000-0000-4000-8000-000000000012'::uuid,
          'as_planned', 'confirmed', '[]'::jsonb,
          timestamptz '2026-09-12 10:00:01+00'
        )
      $statement$,
      (select club_id from window_club),
      (select cycle_id from window_day)
    )
  ),
  'vesty.reporting_closed',
  'Reporting after close is rejected even if status is still open'
);

select extensions.is(
  (
    select count(*)
    from public.member_investment_day_reports
    where investment_cycle_id = (select cycle_id from window_day)
  ),
  0::bigint,
  'Closed-window reports do not write data'
);

reset role;

update public.investment_cycles
set status = 'open',
    closed_at = null
where id = (select cycle_id from window_day);

set local role authenticated;
select tests.authenticate_as('00000000-0000-4000-8000-0000000000c1');

select extensions.is(
  tests.statement_message(
    format(
      $statement$
        select tests.report_investment_day_at_v1(
          %L::uuid, %L::uuid, 'c1000000-0000-4000-8000-000000000014'::uuid,
          'as_planned', 'confirmed', '[]'::jsonb,
          timestamptz '2026-09-20 10:00:00+00'
        )
      $statement$,
      (select club_id from window_club),
      (select cycle_id from window_day)
    )
  ),
  'vesty.reporting_closed',
  'A delayed job cannot reopen an elapsed reporting window'
);

create temporary table late_report_after_status as
select *
from tests.report_investment_day_at_v1(
  (select club_id from window_club),
  (select cycle_id from window_day),
  'c1000000-0000-4000-8000-000000000013'::uuid,
  'as_planned',
  'confirmed',
  '[]'::jsonb,
  timestamptz '2026-09-05 10:00:00+00'
);

select extensions.is(
  (select participation_outcome::text from late_report_after_status),
  'confirmed',
  'In-window reporting still succeeds on a separate open cycle'
);

create temporary table identical_retry_before_counts as
select
  (
    select count(*)
    from public.member_investment_day_reports
    where investment_cycle_id = (select cycle_id from window_day)
  ) as report_count,
  (
    select count(*)
    from public.member_investment_transactions
    where investment_cycle_id = (select cycle_id from window_day)
  ) as transaction_count,
  (
    select count(*)
    from public.member_cycle_participations
    where investment_cycle_id = (select cycle_id from window_day)
  ) as participation_count;

create temporary table retry_after_close as
select *
from tests.report_investment_day_at_v1(
  (select club_id from window_club),
  (select cycle_id from window_day),
  'c1000000-0000-4000-8000-000000000013'::uuid,
  'as_planned',
  'confirmed',
  '[]'::jsonb,
  timestamptz '2026-09-20 10:00:00+00'
);

select extensions.is(
  (select participation_outcome::text from retry_after_close),
  'confirmed',
  'Identical retry after close returns the stored report'
);

select extensions.is(
  (
    select row(
      (select count(*) from public.member_investment_day_reports
       where investment_cycle_id = (select cycle_id from window_day)),
      (select count(*) from public.member_investment_transactions
       where investment_cycle_id = (select cycle_id from window_day)),
      (select count(*) from public.member_cycle_participations
       where investment_cycle_id = (select cycle_id from window_day))
    )::text
  ),
  (
    select row(report_count, transaction_count, participation_count)::text
    from identical_retry_before_counts
  ),
  'Identical retry after close performs no report, transaction, or participation DML'
);

create temporary table retry_row_counts as
select
  (
    select count(*)
    from public.member_investment_day_reports
    where investment_cycle_id = (select cycle_id from window_day)
  ) as report_count,
  (
    select count(*)
    from public.member_investment_transactions
    where investment_cycle_id = (select cycle_id from window_day)
  ) as transaction_count,
  (
    select count(*)
    from public.member_cycle_participations
    where investment_cycle_id = (select cycle_id from window_day)
  ) as participation_count;

select extensions.is(
  tests.statement_message(
    format(
      $statement$
        select tests.report_investment_day_at_v1(
          %L::uuid, %L::uuid, 'c1000000-0000-4000-8000-000000000013'::uuid,
          'with_changes', 'skipped', '[]'::jsonb,
          timestamptz '2026-09-20 10:00:00+00'
        )
      $statement$,
      (select club_id from window_club),
      (select cycle_id from window_day)
    )
  ),
  'vesty.report_conflict',
  'Same report ID with changed payload conflicts after close'
);

select extensions.is(
  tests.statement_message(
    format(
      $statement$
        select tests.report_investment_day_at_v1(
          %L::uuid, %L::uuid, 'c1000000-0000-4000-8000-000000000099'::uuid,
          'as_planned', 'confirmed', '[]'::jsonb,
          timestamptz '2026-09-20 10:00:00+00'
        )
      $statement$,
      (select club_id from window_club),
      (select cycle_id from window_day)
    )
  ),
  'vesty.reporting_closed',
  'A new report ID after close is rejected by the closed window'
);

select extensions.is(
  (
    select row(
      (select count(*) from public.member_investment_day_reports
       where investment_cycle_id = (select cycle_id from window_day)),
      (select count(*) from public.member_investment_transactions
       where investment_cycle_id = (select cycle_id from window_day)),
      (select count(*) from public.member_cycle_participations
       where investment_cycle_id = (select cycle_id from window_day))
    )::text
  ),
  (
    select row(report_count, transaction_count, participation_count)::text
    from retry_row_counts
  ),
  'Rejected retries do not mutate reports, transactions, or participation'
);

reset role;

update public.investment_cycles
set
  status = 'completed',
  closed_at = reporting_closes_at
where id = (select cycle_id from window_day);

set local role authenticated;
select tests.authenticate_as('00000000-0000-4000-8000-0000000000c1');

select extensions.is(
  tests.statement_message(
    format(
      $statement$
        select tests.report_investment_day_at_v1(
          %L::uuid, %L::uuid, 'c1000000-0000-4000-8000-000000000098'::uuid,
          'as_planned', 'confirmed', '[]'::jsonb,
          timestamptz '2026-09-06 10:00:00+00'
        )
      $statement$,
      (select club_id from window_club),
      (select cycle_id from window_day)
    )
  ),
  'vesty.cycle_not_open',
  'A completed cycle rejects a new report inside its nominal time window'
);

select extensions.is(
  (
    select row(
      (select count(*) from public.member_investment_day_reports
       where investment_cycle_id = (select cycle_id from window_day)),
      (select count(*) from public.member_investment_transactions
       where investment_cycle_id = (select cycle_id from window_day)),
      (select count(*) from public.member_cycle_participations
       where investment_cycle_id = (select cycle_id from window_day))
    )::text
  ),
  (
    select row(report_count, transaction_count, participation_count)::text
    from retry_row_counts
  ),
  'Completed-cycle rejection performs no report, transaction, or participation DML'
);

reset role;

update public.contribution_policy_versions
set created_at = timestamptz '2027-09-01 10:00:00+00'
where id = (select policy_version_id from later_equal_policy);

insert into public.contribution_policy_versions (
  id,
  club_id,
  version_number,
  mode,
  currency,
  equal_amount_minor,
  created_by_membership_id,
  created_at
)
values (
  'd1000000-0000-4000-8000-000000000001',
  (select club_id from equal_club),
  3,
  'equal',
  'NOK',
  999000,
  (select membership_id from equal_club),
  timestamptz '2027-09-03 10:00:00+00'
);

insert into public.strategy_proposals (
  id,
  club_id,
  proposer_membership_id,
  base_strategy_version_id,
  status,
  created_at,
  updated_at
)
select
  'd1000000-0000-4000-8000-000000000002',
  (select club_id from equal_club),
  (select membership_id from equal_club),
  strategy.id,
  'draft',
  timestamptz '2027-09-03 10:00:00+00',
  timestamptz '2027-09-03 10:00:00+00'
from public.strategy_versions as strategy
where strategy.club_id = (select club_id from equal_club)
  and strategy.version_number = 1;

insert into public.strategy_versions (
  id,
  club_id,
  version_number,
  created_by_membership_id,
  origin,
  source_proposal_id,
  approved_at,
  effective_at,
  created_at
)
values (
  'd1000000-0000-4000-8000-000000000003',
  (select club_id from equal_club),
  2,
  (select membership_id from equal_club),
  'proposal',
  'd1000000-0000-4000-8000-000000000002',
  timestamptz '2027-09-03 10:00:00+00',
  timestamptz '2027-09-03 10:00:00+00',
  timestamptz '2027-09-03 10:00:00+00'
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
  'd1000000-0000-4000-8000-000000000003',
  allocation.investment_target_id,
  10000,
  1,
  allocation.target_name,
  allocation.target_kind,
  allocation.target_isin,
  allocation.target_ticker,
  allocation.target_exchange
from public.strategy_allocations as allocation
join public.strategy_versions as strategy
  on strategy.id = allocation.strategy_version_id
where strategy.club_id = (select club_id from equal_club)
  and strategy.version_number = 1
order by allocation.position
limit 1;

select public.advance_investment_cycles_v1(
  timestamptz '2027-09-05 10:00:00+00',
  (select club_id from equal_club)
);

create temporary table delayed_freeze_cycle as
select *
from public.investment_cycles
where club_id = (select club_id from equal_club)
  and occurrence_key = '2027-09-05';

select extensions.is(
  (select configuration_deadline_at from delayed_freeze_cycle),
  timestamptz '2027-09-02 10:00:00+00',
  'Delayed-freeze regression uses the 2 September configuration deadline'
);

select extensions.is(
  (select contribution_policy_version_id from delayed_freeze_cycle),
  (select policy_version_id from later_equal_policy),
  'Delayed freeze keeps the policy that existed before the deadline'
);

select extensions.is(
  (select strategy_version_id from delayed_freeze_cycle),
  (
    select id
    from public.strategy_versions
    where club_id = (select club_id from equal_club)
      and version_number = 1
  ),
  'Delayed freeze keeps the strategy effective before the deadline'
);

select extensions.is(
  (
    select expected_amount_minor
    from public.member_cycle_participations
    where investment_cycle_id = (select id from delayed_freeze_cycle)
      and membership_id = (select membership_id from equal_club)
  ),
  350000::bigint,
  'The post-deadline policy amount does not enter the frozen roster'
);

create temporary table delayed_freeze_snapshot as
select
  roster_frozen_at,
  strategy_version_id,
  contribution_policy_version_id,
  (
    select count(*)
    from public.member_cycle_participations
    where investment_cycle_id = cycle.id
  ) as participation_count
from delayed_freeze_cycle as cycle;

select public.advance_investment_cycles_v1(
  timestamptz '2027-09-09 10:00:00+00',
  (select club_id from equal_club)
);

select extensions.is(
  (
    select row(
      cycle.roster_frozen_at,
      cycle.strategy_version_id,
      cycle.contribution_policy_version_id,
      (
        select count(*)
        from public.member_cycle_participations
        where investment_cycle_id = cycle.id
      )
    )::text
    from public.investment_cycles as cycle
    where cycle.id = (select id from delayed_freeze_cycle)
  ),
  (
    select row(
      roster_frozen_at,
      strategy_version_id,
      contribution_policy_version_id,
      participation_count
    )::text
    from delayed_freeze_snapshot
  ),
  'Repeated delayed lifecycle calls cannot change the frozen result'
);

set local role authenticated;
select tests.authenticate_as('00000000-0000-4000-8000-0000000000c4');

create temporary table flexible_club as
select *
from public.create_club_v2(
  'Cycle Flexible Club',
  'simple_majority',
  'world_mix',
  'flexible',
  null,
  180000,
  'NOK'
);

create temporary table eve_invite as
select *
from public.create_club_invitation((select club_id from flexible_club));

select tests.authenticate_as('00000000-0000-4000-8000-0000000000c5');

create temporary table eve_join as
select *
from public.accept_club_invitation((select invite_token from eve_invite));

select tests.authenticate_as('00000000-0000-4000-8000-0000000000c4');

create temporary table flexible_day as
select *
from tests.open_investment_day_v1(
  (select club_id from flexible_club),
  timestamptz '2026-09-05 10:00:00+00'
);

select tests.authenticate_as('00000000-0000-4000-8000-0000000000c5');

select extensions.is(
  (select viewer_state from tests.current_investment_day_v1(
    (select club_id from flexible_club),
    timestamptz '2026-09-05 10:00:00+00'
  )),
  'setup_next',
  'Unconfigured Flexible member at freeze is setup_next'
);

select *
from public.create_member_contribution_commitment_v1(
  (select club_id from flexible_club),
  90000
);

select extensions.is(
  (
    select count(*)
    from public.member_cycle_participations
    where investment_cycle_id = (select cycle_id from flexible_day)
      and membership_id = (select membership_id from eve_join)
  ),
  0::bigint,
  'Flexible setup after the deadline does not join this cycle'
);

select tests.authenticate_as('00000000-0000-4000-8000-0000000000c4');

select *
from public.create_member_contribution_commitment_v1(
  (select club_id from flexible_club),
  220000
);

create temporary table flexible_next as
select *
from tests.open_investment_day_v1(
  (select club_id from flexible_club),
  timestamptz '2026-10-05 10:00:00+00'
);

select extensions.is(
  (select expected_amount_minor from flexible_next),
  220000::bigint,
  'Owner self-edit after freeze applies on the next Investment Day'
);

select tests.authenticate_as('00000000-0000-4000-8000-0000000000c5');

select extensions.is(
  (select expected_amount_minor from tests.current_investment_day_v1(
    (select club_id from flexible_club),
    timestamptz '2026-10-05 10:00:00+00'
  )),
  90000::bigint,
  'Late Flexible setup is included from the next Investment Day'
);

select tests.authenticate_as('00000000-0000-4000-8000-0000000000c6');

create temporary table winter_club as
select *
from public.create_club_v2(
  'Cycle Winter Club',
  'simple_majority',
  'world_mix',
  'equal',
  150000,
  null,
  'NOK'
);

reset role;

select extensions.ok(
  (
    select schedule.id is not null
    from private.ensure_club_investment_schedule_v1((select club_id from winter_club)) as schedule
  ),
  'Winter club has a trusted schedule before the January occurrence'
);

update public.investment_schedules
set day_of_month = 15
where club_id = (select club_id from winter_club)
  and status = 'active';

set local role authenticated;
select tests.authenticate_as('00000000-0000-4000-8000-0000000000c6');

create temporary table winter_day as
select *
from tests.open_investment_day_v1(
  (select club_id from winter_club),
  timestamptz '2026-01-15 11:00:00+00'
);

select extensions.is(
  (select investment_day_at from winter_day),
  timestamptz '2026-01-15 11:00:00+00',
  'Winter occurrence is stored as 12:00 Europe/Oslo'
);

select extensions.is(
  (select viewer_state from winter_day),
  'open',
  'Winter local noon opens reporting'
);

reset role;

set local role authenticated;
select tests.authenticate_as('00000000-0000-4000-8000-0000000000c3');

create temporary table missing_version_club as
select *
from public.create_club_v2(
  'Missing Historical Version Club',
  'simple_majority',
  'world_mix',
  'equal',
  123000,
  null,
  'NOK'
);

reset role;

select private.ensure_club_investment_schedule_v1(
  (select club_id from missing_version_club)
);

update public.club_memberships
set joined_at = timestamptz '2028-08-01 10:00:00+00'
where club_id = (select club_id from missing_version_club);

update public.investment_schedules
set effective_from = timestamptz '2028-08-01 10:00:00+00'
where club_id = (select club_id from missing_version_club);

update public.strategy_versions
set
  created_at = timestamptz '2028-08-01 10:00:00+00',
  effective_at = timestamptz '2028-08-01 10:00:00+00'
where club_id = (select club_id from missing_version_club);

update public.contribution_policy_versions
set created_at = timestamptz '2028-09-03 10:00:00+00'
where club_id = (select club_id from missing_version_club);

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
  status
)
select
  club.id,
  schedule.id,
  strategy.id,
  policy.id,
  '2028-09-05',
  timestamptz '2028-09-05 10:00:00+00',
  timestamptz '2028-09-02 10:00:00+00',
  timestamptz '2028-09-05 10:00:00+00',
  timestamptz '2028-09-12 10:00:00+00',
  'Europe/Oslo',
  'upcoming'
from public.clubs as club
join public.investment_schedules as schedule
  on schedule.club_id = club.id
join public.strategy_versions as strategy
  on strategy.club_id = club.id
join public.contribution_policy_versions as policy
  on policy.club_id = club.id
where club.id = (select club_id from missing_version_club);

select extensions.is(
  tests.statement_message(
    format(
      'select private.freeze_investment_cycle_roster_v1(%L::uuid, %L::timestamptz)',
      (
        select id
        from public.investment_cycles
        where club_id = (select club_id from missing_version_club)
          and occurrence_key = '2028-09-05'
      ),
      '2028-09-05 10:00:00+00'
    )
  ),
  'vesty.contribution_policy_missing',
  'Freeze fails explicitly when no policy existed at the deadline'
);

update public.contribution_policy_versions
set created_at = timestamptz '2028-08-01 10:00:00+00'
where club_id = (select club_id from missing_version_club);

update public.strategy_versions
set
  created_at = timestamptz '2028-09-03 10:00:00+00',
  effective_at = timestamptz '2028-09-03 10:00:00+00'
where club_id = (select club_id from missing_version_club);

select extensions.is(
  tests.statement_message(
    format(
      'select private.freeze_investment_cycle_roster_v1(%L::uuid, %L::timestamptz)',
      (
        select id
        from public.investment_cycles
        where club_id = (select club_id from missing_version_club)
          and occurrence_key = '2028-09-05'
      ),
      '2028-09-05 10:00:00+00'
    )
  ),
  'vesty.strategy_missing',
  'Freeze fails explicitly when no strategy was effective at the deadline'
);

select extensions.is(
  (
    select count(*)
    from public.member_cycle_participations
    where investment_cycle_id = (
      select id
      from public.investment_cycles
      where club_id = (select club_id from missing_version_club)
        and occurrence_key = '2028-09-05'
    )
  ),
  0::bigint,
  'Missing historical versions leave no partial roster'
);

set local role authenticated;
select tests.authenticate_as('00000000-0000-4000-8000-0000000000c3');

create temporary table revision_club as
select *
from public.create_club_v2(
  'Schedule Revision Boundary Club',
  'simple_majority',
  'world_mix',
  'equal',
  144000,
  null,
  'NOK'
);

reset role;

select private.ensure_club_investment_schedule_v1(
  (select club_id from revision_club)
);

update public.club_memberships
set joined_at = timestamptz '2028-08-01 10:00:00+00'
where club_id = (select club_id from revision_club);

update public.strategy_versions
set
  created_at = timestamptz '2028-08-01 10:00:00+00',
  effective_at = timestamptz '2028-08-01 10:00:00+00'
where club_id = (select club_id from revision_club);

update public.contribution_policy_versions
set created_at = timestamptz '2028-08-01 10:00:00+00'
where club_id = (select club_id from revision_club);

update public.investment_schedules
set
  status = 'replaced',
  day_of_month = 31,
  missing_day_policy = 'last_day_of_month',
  timezone = 'Europe/Oslo',
  configuration_lead_days = 3,
  effective_from = timestamptz '2028-08-01 10:00:00+00',
  effective_until = timestamptz '2028-10-10 16:00:00+00'
where club_id = (select club_id from revision_club)
  and revision_number = 1;

insert into public.investment_schedules (
  club_id,
  revision_number,
  status,
  day_of_month,
  missing_day_policy,
  timezone,
  configuration_lead_days,
  effective_from,
  created_by_membership_id,
  created_at
)
values (
  (select club_id from revision_club),
  2,
  'paused',
  15,
  'last_day_of_month',
  'America/New_York',
  5,
  timestamptz '2028-10-10 16:00:00+00',
  (select membership_id from revision_club),
  timestamptz '2028-10-11 10:00:00+00'
);

select extensions.is(
  (
    select count(*)
    from private.investment_schedule_occurrence_v1(
      (select club_id from revision_club),
      2028,
      7
    )
  ),
  0::bigint,
  'A month without a valid schedule revision is not built from the latest plan'
);

select public.advance_investment_cycles_v1(
  timestamptz '2028-10-15 16:00:00+00',
  (select club_id from revision_club)
);

select extensions.is(
  (
    select count(*)
    from public.investment_cycles
    where club_id = (select club_id from revision_club)
      and occurrence_key = '2028-10-15'
  ),
  0::bigint,
  'A paused valid revision blocks fallback to the older active plan'
);

update public.investment_schedules
set
  status = 'replaced',
  effective_until = timestamptz '2028-11-10 17:00:00+00'
where club_id = (select club_id from revision_club)
  and revision_number = 2;

insert into public.investment_schedules (
  club_id,
  revision_number,
  status,
  day_of_month,
  missing_day_policy,
  timezone,
  configuration_lead_days,
  effective_from,
  created_by_membership_id,
  created_at
)
values (
  (select club_id from revision_club),
  3,
  'active',
  20,
  'last_day_of_month',
  'America/New_York',
  10,
  timestamptz '2028-11-10 17:00:00+00',
  (select membership_id from revision_club),
  timestamptz '2028-11-11 10:00:00+00'
);

select public.advance_investment_cycles_v1(
  timestamptz '2028-11-20 17:00:00+00',
  (select club_id from revision_club)
);

select extensions.is(
  (
    select investment_day_at
    from public.investment_cycles
    where club_id = (select club_id from revision_club)
      and occurrence_key = '2028-09-30'
  ),
  timestamptz '2028-09-30 10:00:00+00',
  'The historical revision supplies September last-day and Oslo timezone'
);

select extensions.is(
  (
    select configuration_deadline_at
    from public.investment_cycles
    where club_id = (select club_id from revision_club)
      and occurrence_key = '2028-09-30'
  ),
  timestamptz '2028-09-27 10:00:00+00',
  'The historical revision supplies its three-day lead time'
);

select extensions.is(
  (
    select investment_schedule_id
    from public.investment_cycles
    where club_id = (select club_id from revision_club)
      and occurrence_key = '2028-10-15'
  ),
  (
    select id
    from public.investment_schedules
    where club_id = (select club_id from revision_club)
      and revision_number = 2
  ),
  'Catch-up selects revision 2 from its inclusive effective_from boundary'
);

select extensions.is(
  (
    select configuration_deadline_at
    from public.investment_cycles
    where club_id = (select club_id from revision_club)
      and occurrence_key = '2028-10-15'
  ),
  timestamptz '2028-10-10 16:00:00+00',
  'Revision 2 uses New York timezone and its five-day lead time'
);

select extensions.is(
  (
    select investment_schedule_id
    from public.investment_cycles
    where club_id = (select club_id from revision_club)
      and occurrence_key = '2028-11-20'
  ),
  (
    select id
    from public.investment_schedules
    where club_id = (select club_id from revision_club)
      and revision_number = 3
  ),
  'The exclusive effective_until boundary prevents revision 2 owning November'
);

select extensions.is(
  (
    select configuration_deadline_at
    from public.investment_cycles
    where club_id = (select club_id from revision_club)
      and occurrence_key = '2028-11-20'
  ),
  timestamptz '2028-11-10 17:00:00+00',
  'Revision 3 contributes its day, timezone, and ten-day lead time'
);

select extensions.is(
  (
    select count(distinct investment_schedule_id)
    from public.investment_cycles
    where club_id = (select club_id from revision_club)
      and occurrence_key in ('2028-10-15', '2028-11-20')
  ),
  2::bigint,
  'One catch-up run can materialize occurrences from different revisions'
);

select extensions.is(
  (
    select count(*)
    from public.investment_cycles
    where club_id = (select club_id from revision_club)
      and occurrence_key in ('2028-09-30', '2028-10-15', '2028-11-20')
  ),
  3::bigint,
  'Later schedule revisions neither rewrite nor duplicate historical occurrences'
);

select extensions.ok(
  not pg_catalog.has_function_privilege(
    'anon',
    function_name::regprocedure,
    'execute'
  )
  and not pg_catalog.has_function_privilege(
    'authenticated',
    function_name::regprocedure,
    'execute'
  )
  and not exists (
    select 1
    from pg_catalog.pg_proc as procedure
    cross join lateral pg_catalog.aclexplode(
      coalesce(
        procedure.proacl,
        pg_catalog.acldefault('f', procedure.proowner)
      )
    ) as privilege
    where procedure.oid = function_name::regprocedure
      and privilege.grantee = 0
      and privilege.privilege_type = 'EXECUTE'
  ),
  format('%s is not executable by PUBLIC, anon, or authenticated', function_name)
)
from (
  values
    ('private.prevent_cycle_policy_rewrite()'),
    ('private.investment_occurrence_at_v1(integer,integer,integer,text,text)'),
    ('private.investment_occurrence_key_v1(timestamptz,text)'),
    ('private.resolve_member_expected_contribution_at_v1(uuid,uuid,timestamptz)'),
    ('private.latest_contribution_policy_version_id_v1(uuid)'),
    ('private.latest_contribution_policy_version_id_at_v1(uuid,timestamptz)'),
    ('private.ensure_club_investment_schedule_v1(uuid)'),
    ('private.investment_schedule_occurrence_v1(uuid,integer,integer)'),
    ('private.ensure_legacy_saving_plan_for_amount_v1(uuid,uuid,bigint,text)'),
    ('private.freeze_investment_cycle_roster_v1(uuid,timestamptz)'),
    ('private.advance_club_investment_cycles_v1(uuid,timestamptz)'),
    ('private.advance_investment_cycles_v1(timestamptz,uuid)'),
    ('private.report_investment_day_at_v1(uuid,uuid,uuid,public.investment_day_report_mode,public.participation_outcome,jsonb,timestamptz)'),
    ('private.report_investment_day_v1(uuid,uuid,uuid,public.investment_day_report_mode,public.participation_outcome,jsonb)'),
    ('private.current_investment_day_v1(uuid,timestamptz)'),
    ('private.member_investment_day_streak_v1(uuid,uuid,timestamptz)'),
    ('private.club_investment_day_participation_at_v1(uuid,uuid,timestamptz)'),
    ('private.club_investment_day_participation_v1(uuid,uuid)')
) as private_function(function_name);

select extensions.throws_ok(
  format(
    $statement$
      insert into public.investment_cycles (
        club_id, investment_schedule_id, strategy_version_id, contribution_policy_version_id,
        occurrence_key, investment_day_at, configuration_deadline_at, reporting_opens_at,
        reporting_closes_at, timezone, status
      )
      select
        club_id, investment_schedule_id, strategy_version_id, contribution_policy_version_id,
        occurrence_key, investment_day_at, configuration_deadline_at, reporting_opens_at,
        reporting_closes_at, timezone, 'upcoming'
      from public.investment_cycles
      where id = %L::uuid
    $statement$,
    (select cycle_id from open_day)
  ),
  '23505',
  'duplicate key value violates unique constraint "investment_cycles_club_occurrence_key"',
  'Duplicate club+occurrence rows are rejected'
);

select * from extensions.finish();

rollback;
