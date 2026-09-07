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

create temporary table alice_day as
select *
from public.ensure_open_investment_day_v1((select club_id from alice_club));

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

create temporary table bob_day as
select *
from public.ensure_open_investment_day_v1((select club_id from alice_club));

reset role;

update public.club_memberships
set joined_at = now() - interval '120 days'
where id in (
  (select membership_id from alice_club),
  (select membership_id from bob_join)
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
  closed_at
)
select
  cycle.club_id,
  cycle.investment_schedule_id,
  cycle.strategy_version_id,
  cycle.contribution_policy_version_id,
  hist.occurrence_key,
  hist.investment_day_at,
  hist.investment_day_at - interval '1 day',
  hist.investment_day_at,
  hist.investment_day_at + interval '7 days',
  cycle.timezone,
  'completed',
  hist.investment_day_at,
  hist.investment_day_at + interval '7 days'
from public.investment_cycles as cycle
cross join (
  values
    ('hist-1', now() - interval '90 days'),
    ('hist-2', now() - interval '60 days'),
    ('hist-3', now() - interval '30 days')
) as hist(occurrence_key, investment_day_at)
where cycle.id = (select cycle_id from alice_day);

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
  cycle.club_id,
  cycle.investment_schedule_id,
  cycle.strategy_version_id,
  cycle.contribution_policy_version_id,
  'future-1',
  now() + interval '40 days',
  now() + interval '39 days',
  now() + interval '40 days',
  now() + interval '47 days',
  cycle.timezone,
  'upcoming'
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
where participation.investment_cycle_id = (select cycle_id from alice_day)
  and (
    (
      participation.membership_id = (select membership_id from alice_club)
      and cycle.occurrence_key in ('hist-1', 'hist-2', 'hist-3')
    )
    or (
      participation.membership_id = (select membership_id from bob_join)
      and cycle.occurrence_key in ('hist-1', 'hist-2')
    )
  );

set local role authenticated;
select tests.authenticate_as('00000000-0000-4000-8000-000000000081');

select extensions.is(
  (
    select count(*)
    from public.club_investment_day_participation_v1(
      (select club_id from alice_club),
      (select cycle_id from alice_day)
    )
  ),
  2::bigint,
  'Current roster includes only active club members'
);

select extensions.is(
  (
    select completed_count
    from public.club_investment_day_participation_v1(
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
    from public.club_investment_day_participation_v1(
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
    from public.club_investment_day_participation_v1(
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
    from public.club_investment_day_participation_v1(
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
from public.report_investment_day_v1(
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
    from public.club_investment_day_participation_v1(
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
    from public.club_investment_day_participation_v1(
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
    from public.club_investment_day_participation_v1(
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
    from public.club_investment_day_participation_v1(
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
from public.report_investment_day_v1(
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
    from public.club_investment_day_participation_v1(
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
    from public.club_investment_day_participation_v1(
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
    select current_streak
    from public.club_investment_day_participation_v1(
      (select club_id from alice_club),
      (select cycle_id from alice_day)
    )
    where membership_id = (select membership_id from cara_join)
  ),
  0,
  'A later joiner starts at streak 0 and is not penalized for earlier cycles'
);

select extensions.is(
  (
    select count(*)
    from public.club_investment_day_participation_v1(
      (select club_id from alice_club),
      (select cycle_id from alice_day)
    )
  ),
  3::bigint,
  'Later joiner appears in the current eligible roster'
);

select tests.authenticate_as('00000000-0000-4000-8000-000000000082');

create temporary table bob_confirm as
select *
from public.report_investment_day_v1(
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
    from public.club_investment_day_participation_v1(
      (select club_id from alice_club),
      (select cycle_id from alice_day)
    )
    where membership_id = (select membership_id from bob_join)
  ),
  1,
  'A new completion after a miss starts a streak of 1'
);

select tests.authenticate_as('00000000-0000-4000-8000-000000000083');

create temporary table cara_day as
select *
from public.ensure_open_investment_day_v1((select club_id from alice_club));

create temporary table cara_confirm as
select *
from public.report_investment_day_v1(
  (select club_id from alice_club),
  (select cycle_id from alice_day),
  '85000000-0000-4000-8000-000000000001'::uuid,
  'as_planned',
  'confirmed',
  '[]'::jsonb
);

select extensions.is(
  (
    select all_completed
    from public.club_investment_day_participation_v1(
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
    from public.club_investment_day_participation_v1(
      (select club_id from alice_club),
      (select cycle_id from alice_day)
    )
    limit 1
  ),
  3,
  'Completed count matches the eligible roster'
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
from public.ensure_open_investment_day_v1((select club_id from dana_club));

select extensions.is(
  tests.statement_message(
    format(
      $statement$
        select * from public.club_investment_day_participation_v1(%L::uuid, %L::uuid)
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
        select * from public.club_investment_day_participation_v1(%L::uuid, %L::uuid)
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
        select * from public.club_investment_day_participation_v1(%L::uuid, %L::uuid)
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
    from public.club_investment_day_participation_v1(
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
