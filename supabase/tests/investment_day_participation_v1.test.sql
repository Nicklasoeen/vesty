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
  p_is3n text
)
returns jsonb
language sql
immutable
security invoker
set search_path = ''
as $function$
  select pg_catalog.jsonb_build_array(
    pg_catalog.jsonb_build_object(
      'investment_target_id', '31000000-0000-4000-8000-000000000011',
      'quantity', p_vwce
    ),
    pg_catalog.jsonb_build_object(
      'investment_target_id', '31000000-0000-4000-8000-000000000012',
      'quantity', p_eunk
    ),
    pg_catalog.jsonb_build_object(
      'investment_target_id', '31000000-0000-4000-8000-000000000013',
      'quantity', p_is3n
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

grant execute on function tests.statement_message(text) to authenticated;
grant execute on function tests.world_mix_reports(text, text, text) to authenticated;

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
    '00000000-0000-4000-8000-000000000081',
    'authenticated',
    'authenticated',
    'alice-participation@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000000082',
    'authenticated',
    'authenticated',
    'bob-participation@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000000083',
    'authenticated',
    'authenticated',
    'cara-participation@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000000084',
    'authenticated',
    'authenticated',
    'dana-participation@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000000085',
    'authenticated',
    'authenticated',
    'eve-participation@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

insert into public.profiles (id, display_name)
values
  ('00000000-0000-4000-8000-000000000081', 'Alice Participation'),
  ('00000000-0000-4000-8000-000000000082', 'Bob Participation'),
  ('00000000-0000-4000-8000-000000000083', 'Cara Participation'),
  ('00000000-0000-4000-8000-000000000084', 'Dana Participation'),
  ('00000000-0000-4000-8000-000000000085', 'Eve Participation');

select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.club_investment_day_participation_v1(uuid, uuid)',
    'execute'
  ),
  'Anonymous role cannot read Investment Day participation'
);

select extensions.ok(
  not has_function_privilege(
    'authenticated',
    'private.member_investment_day_streak_v1(uuid, uuid, timestamptz)',
    'execute'
  ),
  'Authenticated role cannot execute the private streak helper'
);

select extensions.ok(
  not has_function_privilege(
    'authenticated',
    'private.member_completed_investment_cycle_v1(uuid, uuid)',
    'execute'
  ),
  'Authenticated role cannot execute the private completion helper'
);

select extensions.ok(
  pg_catalog.pg_get_function_result(
    'public.club_investment_day_participation_v1(uuid, uuid)'::regprocedure
  ) !~* 'amount|quantity|price|broker|expected',
  'Participation RPC result type does not expose amounts, quantities, prices, or broker'
);

set local role authenticated;
select tests.authenticate_as('00000000-0000-4000-8000-000000000081');

create temporary table alice_club as
select *
from public.create_club(
  'Participation Club',
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

select tests.authenticate_as('00000000-0000-4000-8000-000000000082');

create temporary table bob_join as
select *
from public.accept_club_invitation((select invite_token from alice_invite));

select *
from public.create_member_contribution_commitment_v1(
  (select club_id from alice_club),
  200000
);

select tests.authenticate_as('00000000-0000-4000-8000-000000000081');

create temporary table alice_day as
select *
from tests.open_investment_day_v1((select club_id from alice_club));

create temporary table bob_day as
select *
from tests.current_investment_day_v1((select club_id from alice_club));

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
  closed_at,
  roster_frozen_at
)
select
  cycle.club_id,
  cycle.investment_schedule_id,
  cycle.strategy_version_id,
  cycle.contribution_policy_version_id,
  '2026-06-05',
  timestamptz '2026-06-05 10:00:00+00',
  timestamptz '2026-06-02 10:00:00+00',
  timestamptz '2026-06-05 10:00:00+00',
  timestamptz '2026-06-12 10:00:00+00',
  cycle.timezone,
  'completed',
  timestamptz '2026-06-05 10:00:00+00',
  timestamptz '2026-06-12 10:00:00+00',
  timestamptz '2026-06-02 10:00:00+00'
from public.investment_cycles as cycle
where cycle.id = (select cycle_id from alice_day);

insert into public.member_cycle_participations (
  club_id,
  investment_cycle_id,
  membership_id,
  saving_plan_id,
  expected_amount_minor,
  currency,
  outcome,
  report_source,
  reported_at,
  created_at
)
select
  participation.club_id,
  cycle.id,
  participation.membership_id,
  participation.saving_plan_id,
  participation.expected_amount_minor,
  participation.currency,
  'confirmed',
  'member_reported',
  cycle.investment_day_at + interval '1 hour',
  cycle.investment_day_at
from public.member_cycle_participations as participation
join public.investment_cycles as cycle
  on cycle.club_id = participation.club_id
 and cycle.occurrence_key = '2026-06-05'
where participation.investment_cycle_id = (select cycle_id from alice_day);

update public.member_cycle_participations as participation
set
  outcome = 'confirmed',
  report_source = 'member_reported',
  reported_at = cycle.investment_day_at + interval '1 hour'
from public.investment_cycles as cycle
where cycle.id = participation.investment_cycle_id
  and cycle.club_id = (select club_id from alice_club)
  and (
    (
      participation.membership_id = (select membership_id from alice_club)
      and cycle.occurrence_key in ('2026-07-05', '2026-08-05')
    )
    or (
      participation.membership_id = (select membership_id from bob_join)
      and cycle.occurrence_key = '2026-07-05'
    )
  );

set local role authenticated;
select tests.authenticate_as('00000000-0000-4000-8000-000000000081');

select extensions.is(
  (
    select count(*)
    from tests.club_investment_day_participation_at_v1(
      (select club_id from alice_club),
      (select cycle_id from alice_day)
    )
  ),
  2::bigint,
  'Current roster is the frozen participation snapshot'
);

select extensions.is(
  (
    select completed_count
    from tests.club_investment_day_participation_at_v1(
      (select club_id from alice_club),
      (select cycle_id from alice_day)
    )
    limit 1
  ),
  0,
  'Incomplete current cycle has zero completed members'
);

select extensions.is(
  (
    select current_streak
    from tests.club_investment_day_participation_at_v1(
      (select club_id from alice_club),
      (select cycle_id from alice_day)
    )
    where membership_id = (select membership_id from alice_club)
  ),
  3,
  'Current pending cycle does not prematurely break a prior streak'
);

select extensions.is(
  (
    select current_streak
    from tests.club_investment_day_participation_at_v1(
      (select club_id from alice_club),
      (select cycle_id from alice_day)
    )
    where membership_id = (select membership_id from bob_join)
  ),
  0,
  'A missed past cycle resets the current streak to 0'
);

select extensions.is(
  (
    select completed
    from tests.club_investment_day_participation_at_v1(
      (select club_id from alice_club),
      (select cycle_id from alice_day)
    )
    where membership_id = (select membership_id from bob_join)
  ),
  false,
  'A member without confirmation is pending'
);

create temporary table alice_confirm as
select *
from tests.report_investment_day_at_v1(
  (select club_id from alice_club),
  (select cycle_id from alice_day),
  '85000000-0000-4000-8000-000000000001'::uuid,
  'as_planned',
  'confirmed',
  '[]'::jsonb
);

select extensions.is(
  (
    select completed
    from tests.club_investment_day_participation_at_v1(
      (select club_id from alice_club),
      (select cycle_id from alice_day)
    )
    where membership_id = (select membership_id from alice_club)
  ),
  true,
  'V1 confirmation is the authoritative completed state'
);

select extensions.is(
  (
    select current_streak
    from tests.club_investment_day_participation_at_v1(
      (select club_id from alice_club),
      (select cycle_id from alice_day)
    )
    where membership_id = (select membership_id from alice_club)
  ),
  4,
  'Completing the current cycle extends the streak by one'
);

select extensions.is(
  (
    select completed_count
    from tests.club_investment_day_participation_at_v1(
      (select club_id from alice_club),
      (select cycle_id from alice_day)
    )
    limit 1
  ),
  1,
  'Completed count follows v1 confirmation'
);

select extensions.is(
  (
    select verification_level
    from tests.club_investment_day_participation_at_v1(
      (select club_id from alice_club),
      (select cycle_id from alice_day)
    )
    where membership_id = (select membership_id from alice_club)
  ),
  'member_reported',
  'Completed social state stays member_reported'
);

create temporary table alice_v2 as
select *
from tests.report_investment_day_at_v1(
  (select club_id from alice_club),
  (select cycle_id from alice_day),
  '85000000-0000-4000-8000-000000000001'::uuid,
  'as_planned',
  'confirmed',
  '[]'::jsonb
);

select extensions.is(
  (
    select current_streak
    from tests.club_investment_day_participation_at_v1(
      (select club_id from alice_club),
      (select cycle_id from alice_day)
    )
    where membership_id = (select membership_id from alice_club)
  ),
  4,
  'Idempotent report retry does not increment the streak twice'
);

select extensions.is(
  (
    select completed_count
    from tests.club_investment_day_participation_at_v1(
      (select club_id from alice_club),
      (select cycle_id from alice_day)
    )
    limit 1
  ),
  1,
  'Idempotent report retry does not create a second participation event'
);

create temporary table alice_late_invite as
select *
from public.create_club_invitation((select club_id from alice_club));

select tests.authenticate_as('00000000-0000-4000-8000-000000000083');

create temporary table cara_join as
select *
from public.accept_club_invitation((select invite_token from alice_late_invite));

select *
from public.create_member_contribution_commitment_v1(
  (select club_id from alice_club),
  200000
);

select extensions.is(
  (
    select count(*)
    from tests.club_investment_day_participation_at_v1(
      (select club_id from alice_club),
      (select cycle_id from alice_day)
    )
    where membership_id = (select membership_id from cara_join)
  ),
  0::bigint,
  'A later joiner is not added to a frozen participation snapshot'
);

select extensions.is(
  (
    select viewer_state
    from tests.current_investment_day_v1((select club_id from alice_club))
  ),
  'not_in_snapshot',
  'A later joiner sees not_in_snapshot for the frozen current cycle'
);

select extensions.is(
  (
    select count(*)
    from tests.club_investment_day_participation_at_v1(
      (select club_id from alice_club),
      (select cycle_id from alice_day)
    )
  ),
  2::bigint,
  'Late join does not change the frozen roster or all_completed denominator'
);

select tests.authenticate_as('00000000-0000-4000-8000-000000000082');

create temporary table bob_confirm as
select *
from tests.report_investment_day_at_v1(
  (select club_id from alice_club),
  (select cycle_id from alice_day),
  '85000000-0000-4000-8000-000000000001'::uuid,
  'as_planned',
  'confirmed',
  '[]'::jsonb
);

select extensions.is(
  (
    select current_streak
    from tests.club_investment_day_participation_at_v1(
      (select club_id from alice_club),
      (select cycle_id from alice_day)
    )
    where membership_id = (select membership_id from bob_join)
  ),
  1,
  'A new completion after a miss starts a streak of 1'
);

select extensions.is(
  (
    select all_completed
    from tests.club_investment_day_participation_at_v1(
      (select club_id from alice_club),
      (select cycle_id from alice_day)
    )
    limit 1
  ),
  true,
  'All completed is true when every eligible member has confirmed'
);

select extensions.is(
  (
    select completed_count
    from tests.club_investment_day_participation_at_v1(
      (select club_id from alice_club),
      (select cycle_id from alice_day)
    )
    limit 1
  ),
  2,
  'Completed count matches the frozen snapshot, not later joiners'
);

select tests.authenticate_as('00000000-0000-4000-8000-000000000084');

create temporary table dana_club as
select *
from public.create_club(
  'Other Participation Club',
  'simple_majority',
  'world_mix',
  'NOK'
);

select *
from public.create_member_contribution_commitment_v1(
  (select club_id from dana_club),
  200000
);

create temporary table dana_day as
select *
from tests.open_investment_day_v1((select club_id from dana_club));

select extensions.is(
  tests.statement_message(
    format(
      $statement$
        select * from tests.club_investment_day_participation_at_v1(%L::uuid, %L::uuid)
      $statement$,
      (select club_id from alice_club),
      (select cycle_id from alice_day)
    )
  ),
  'vesty.not_club_member',
  'Member of Club B cannot read Club A participation'
);

select tests.authenticate_as('00000000-0000-4000-8000-000000000081');

select extensions.is(
  tests.statement_message(
    format(
      $statement$
        select * from tests.club_investment_day_participation_at_v1(%L::uuid, %L::uuid)
      $statement$,
      (select club_id from dana_club),
      (select cycle_id from dana_day)
    )
  ),
  'vesty.not_club_member',
  'Member of Club A cannot read Club B participation'
);

select tests.authenticate_as('00000000-0000-4000-8000-000000000085');

select extensions.is(
  tests.statement_message(
    format(
      $statement$
        select * from tests.club_investment_day_participation_at_v1(%L::uuid, %L::uuid)
      $statement$,
      (select club_id from alice_club),
      (select cycle_id from alice_day)
    )
  ),
  'vesty.not_club_member',
  'Non-member cannot read participation'
);

select tests.authenticate_as('00000000-0000-4000-8000-000000000082');

select extensions.is(
  (
    select count(*)
    from public.member_investment_transactions
    where membership_id = (select membership_id from alice_club)
  ),
  0::bigint,
  'Participation read does not weaken private transaction RLS'
);

select extensions.is(
  (
    select count(*)
    from tests.club_investment_day_participation_at_v1(
      (select club_id from alice_club),
      (select cycle_id from alice_day)
    ) as participation
    where to_jsonb(participation) ? 'expected_amount_minor'
       or to_jsonb(participation) ? 'amount_minor'
       or to_jsonb(participation) ? 'quantity'
       or to_jsonb(participation) ? 'unit_price_minor'
       or to_jsonb(participation) ? 'execution_unit_price'
  ),
  0::bigint,
  'Returned participation rows do not include transaction amounts or prices'
);

reset role;

select extensions.finish();

rollback;
