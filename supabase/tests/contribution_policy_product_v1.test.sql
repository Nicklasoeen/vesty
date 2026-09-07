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
    '71000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'product-owner@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '71000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'product-member@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '71000000-0000-4000-8000-000000000003',
    'authenticated',
    'authenticated',
    'product-outsider@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

insert into public.profiles (id, display_name)
values
  ('71000000-0000-4000-8000-000000000001', 'Owner'),
  ('71000000-0000-4000-8000-000000000002', 'Member'),
  ('71000000-0000-4000-8000-000000000003', 'Outsider');

select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.create_club_v2(text, public.governance_threshold_kind, text, public.contribution_policy_mode, bigint, bigint, text)',
    'execute'
  ),
  'Anonymous role cannot execute create_club_v2'
);

select extensions.ok(
  to_regprocedure(
    'public.create_club_v2(text, public.governance_threshold_kind, text, public.contribution_policy_mode, bigint, bigint, text)'
  ) is not null,
  'create_club_v2 is installed'
);

set local role authenticated;
select tests.authenticate_as('71000000-0000-4000-8000-000000000001');

select extensions.is(
  tests.statement_message(
    $statement$
      select public.create_club_v2(
        'Missing Equal Amount',
        'simple_majority',
        'world_mix',
        'equal',
        null,
        null,
        'NOK'
      )
    $statement$
  ),
  'vesty.contribution_policy_invalid',
  'Equal create_club_v2 requires a positive shared amount'
);

select extensions.is(
  tests.statement_message(
    $statement$
      select public.create_club_v2(
        'Equal With Private Amount',
        'simple_majority',
        'world_mix',
        'equal',
        200000,
        100000,
        'NOK'
      )
    $statement$
  ),
  'vesty.contribution_policy_invalid',
  'Equal create_club_v2 forbids a creator private amount'
);

select extensions.is(
  tests.statement_message(
    $statement$
      select public.create_club_v2(
        'Flexible Missing Own Amount',
        'simple_majority',
        'world_mix',
        'flexible',
        null,
        null,
        'NOK'
      )
    $statement$
  ),
  'vesty.contribution_commitment_invalid',
  'Flexible create_club_v2 requires the creator private amount'
);

select extensions.is(
  tests.statement_message(
    $statement$
      select public.create_club_v2(
        'Flexible With Shared Amount',
        'simple_majority',
        'world_mix',
        'flexible',
        200000,
        150000,
        'NOK'
      )
    $statement$
  ),
  'vesty.contribution_policy_invalid',
  'Flexible create_club_v2 forbids a shared equal amount'
);

create temporary table equal_club as
select *
from public.create_club_v2(
  'Equal Product Club',
  'simple_majority',
  'world_mix',
  'equal',
  200000,
  null,
  'NOK'
);

select extensions.is(
  (
    select mode::text
    from public.contribution_policy_versions
    where club_id = (select club_id from equal_club)
      and version_number = 1
  ),
  'equal',
  'create_club_v2 equal writes policy v1 as equal'
);

select extensions.is(
  (
    select equal_amount_minor
    from public.contribution_policy_versions
    where club_id = (select club_id from equal_club)
      and version_number = 1
  ),
  200000::bigint,
  'create_club_v2 equal stores the shared amount'
);

select extensions.is(
  (
    select count(*)
    from public.member_contribution_commitment_versions
    where club_id = (select club_id from equal_club)
  ),
  0::bigint,
  'Equal create does not invent a private owner commitment'
);

select extensions.is(
  (
    select count(*)
    from public.club_memberships
    where club_id = (select club_id from equal_club)
      and status = 'active'
  ),
  1::bigint,
  'Equal create still creates the owner membership'
);

create temporary table equal_day as
select *
from public.ensure_open_investment_day_v1((select club_id from equal_club));

select extensions.is(
  (select expected_amount_minor from equal_day),
  200000::bigint,
  'Equal cycle freezes the shared policy amount for the owner'
);

select extensions.is(
  tests.statement_message(
    format(
      $statement$
        select public.create_member_contribution_commitment_v1(%L::uuid, 300000)
      $statement$,
      (select club_id from equal_club)
    )
  ),
  'vesty.contribution_commitment_not_applicable',
  'Members cannot create a private commitment on an equal club'
);

select extensions.ok(
  to_regprocedure(
    'public.create_contribution_policy_version_v1(uuid, public.contribution_policy_mode, bigint)'
  ) is null,
  'Owners have no public RPC to append contribution policy versions'
);

select extensions.is(
  tests.statement_sqlstate(
    format(
      $statement$
        select private.create_contribution_policy_version_v1(%L::uuid, 'equal'::public.contribution_policy_mode, 350000::bigint, null, null)
      $statement$,
      (select club_id from equal_club)
    )
  ),
  '42501',
  'Club owner cannot execute trusted policy-version insert'
);

select tests.authenticate_as('71000000-0000-4000-8000-000000000002');

select extensions.is(
  tests.statement_sqlstate(
    format(
      $statement$
        select private.create_contribution_policy_version_v1(%L::uuid, 'equal'::public.contribution_policy_mode, 350000::bigint, null, null)
      $statement$,
      (select club_id from equal_club)
    )
  ),
  '42501',
  'Ordinary members cannot execute trusted policy-version insert'
);

select tests.authenticate_as('71000000-0000-4000-8000-000000000003');

select extensions.is(
  tests.statement_sqlstate(
    format(
      $statement$
        select private.create_contribution_policy_version_v1(%L::uuid, 'equal'::public.contribution_policy_mode, 350000::bigint, null, null)
      $statement$,
      (select club_id from equal_club)
    )
  ),
  '42501',
  'Cross-club callers cannot execute trusted policy-version insert'
);

select tests.authenticate_as('71000000-0000-4000-8000-000000000001');

create temporary table equal_invite as
select *
from public.create_club_invitation((select club_id from equal_club));

select tests.authenticate_as('71000000-0000-4000-8000-000000000002');

create temporary table equal_join as
select *
from public.accept_club_invitation((select invite_token from equal_invite));

create temporary table equal_member_day as
select *
from public.ensure_open_investment_day_v1((select club_id from equal_club));

select extensions.is(
  (select expected_amount_minor from equal_member_day),
  200000::bigint,
  'Joining an equal club freezes the shared amount without a private commitment'
);

select extensions.is(
  (
    select count(*)
    from public.member_contribution_commitment_versions
    where membership_id = (select membership_id from equal_join)
  ),
  0::bigint,
  'Equal join does not invent a private commitment'
);

select tests.authenticate_as('71000000-0000-4000-8000-000000000001');

reset role;

create temporary table equal_policy_v2 as
select *
from private.create_contribution_policy_version_v1(
  (select club_id from equal_club),
  'equal',
  350000
);

grant select on equal_policy_v2 to authenticated;

select extensions.ok(
  exists (select 1 from equal_policy_v2),
  'Trusted/internal path can append a later contribution policy version'
);

select extensions.is(
  (select version_number from equal_policy_v2),
  2,
  'Trusted append creates policy v2 without a client RPC'
);

set local role authenticated;
select tests.authenticate_as('71000000-0000-4000-8000-000000000001');

create temporary table equal_day_reload as
select *
from public.ensure_open_investment_day_v1((select club_id from equal_club));

select extensions.is(
  (select cycle_id from equal_day_reload),
  (select cycle_id from equal_day),
  'Existing equal cycle is reused after a later trusted policy v2'
);

select extensions.is(
  (
    select contribution_policy_version_id
    from public.investment_cycles
    where id = (select cycle_id from equal_day)
  ),
  (
    select id
    from public.contribution_policy_versions
    where club_id = (select club_id from equal_club)
      and version_number = 1
  ),
  'Existing equal cycle keeps policy v1 after trusted policy v2'
);

select extensions.is(
  (select expected_amount_minor from equal_day_reload),
  200000::bigint,
  'Existing equal cycle still freezes 2,000 after trusted policy v2'
);

reset role;

update public.investment_cycles
set status = 'completed',
    closed_at = now(),
    occurrence_key = occurrence_key || '-done'
where id = (select cycle_id from equal_day);

set local role authenticated;
select tests.authenticate_as('71000000-0000-4000-8000-000000000001');

create temporary table equal_next_day as
select *
from public.ensure_open_investment_day_v1((select club_id from equal_club));

select extensions.is(
  (
    select contribution_policy_version_id
    from public.investment_cycles
    where id = (select cycle_id from equal_next_day)
  ),
  (select policy_version_id from equal_policy_v2),
  'A later equal cycle may select the latest trusted policy v2'
);

select extensions.is(
  (select expected_amount_minor from equal_next_day),
  350000::bigint,
  'A later equal cycle freezes the v2 shared amount'
);

create temporary table flexible_club as
select *
from public.create_club_v2(
  'Flexible Product Club',
  'simple_majority',
  'world_mix',
  'flexible',
  null,
  200000,
  'NOK'
);

select extensions.is(
  (
    select mode::text
    from public.contribution_policy_versions
    where club_id = (select club_id from flexible_club)
      and version_number = 1
  ),
  'flexible',
  'create_club_v2 flexible writes policy v1 as flexible'
);

select extensions.is(
  (
    select equal_amount_minor
    from public.contribution_policy_versions
    where club_id = (select club_id from flexible_club)
      and version_number = 1
  ),
  null,
  'Flexible policy has no shared amount'
);

select extensions.is(
  (
    select amount_minor
    from public.member_contribution_commitment_versions
    where membership_id = (select membership_id from flexible_club)
      and version_number = 1
  ),
  200000::bigint,
  'Flexible create writes owner commitment v1'
);

select extensions.is(
  (
    select count(*)
    from public.member_saving_plans
    where membership_id = (select membership_id from flexible_club)
      and status = 'active'
  ),
  1::bigint,
  'Flexible create writes a legacy saving-plan artifact for the owner'
);

create temporary table flexible_owner_day as
select *
from public.ensure_open_investment_day_v1((select club_id from flexible_club));

select extensions.is(
  (select expected_amount_minor from flexible_owner_day),
  200000::bigint,
  'Flexible owner cycle freezes the creator commitment'
);

create temporary table flexible_invite as
select *
from public.create_club_invitation((select club_id from flexible_club));

select tests.authenticate_as('71000000-0000-4000-8000-000000000002');

create temporary table flexible_join as
select *
from public.accept_club_invitation((select invite_token from flexible_invite));

select extensions.is(
  (
    select count(*)
    from public.member_contribution_commitment_versions
    where membership_id = (select membership_id from flexible_join)
  ),
  0::bigint,
  'Flexible join does not invent a member amount'
);

select extensions.is(
  tests.statement_message(
    format(
      $statement$
        select public.ensure_open_investment_day_v1(%L::uuid)
      $statement$,
      (select club_id from flexible_club)
    )
  ),
  'vesty.contribution_commitment_required',
  'Flexible member without a commitment gets setup-required, not an invented amount'
);

select tests.authenticate_as('71000000-0000-4000-8000-000000000001');

select extensions.is(
  (select expected_amount_minor from flexible_owner_day),
  200000::bigint,
  'Configured owner freeze is unchanged when another member still needs setup'
);

select extensions.is(
  (
    select count(*)
    from public.member_cycle_participations
    where investment_cycle_id = (select cycle_id from flexible_owner_day)
      and membership_id = (select membership_id from flexible_join)
  ),
  0::bigint,
  'Unconfigured flexible member does not receive a fake cycle participation'
);

select tests.authenticate_as('71000000-0000-4000-8000-000000000002');

create temporary table flexible_member_commitment as
select *
from public.create_member_contribution_commitment_v1(
  (select club_id from flexible_club),
  100000
);

create temporary table flexible_member_day as
select *
from public.ensure_open_investment_day_v1((select club_id from flexible_club));

select extensions.is(
  (select expected_amount_minor from flexible_member_day),
  100000::bigint,
  'After setup, the member freezes once under the already-open cycle'
);

select extensions.is(
  (select cycle_id from flexible_member_day),
  (select cycle_id from flexible_owner_day),
  'Late flexible setup joins the existing cycle instead of creating a new one'
);

select extensions.is(
  (
    select contribution_policy_version_id
    from public.investment_cycles
    where id = (select cycle_id from flexible_member_day)
  ),
  (
    select id
    from public.contribution_policy_versions
    where club_id = (select club_id from flexible_club)
      and version_number = 1
  ),
  'Late flexible setup still freezes under the existing cycle policy v1'
);

reset role;

select extensions.is(
  (
    select expected_amount_minor
    from public.member_cycle_participations
    where investment_cycle_id = (select cycle_id from flexible_owner_day)
      and membership_id = (select membership_id from flexible_club)
  ),
  200000::bigint,
  'Late flexible setup does not rewrite another member frozen amount'
);

set local role authenticated;
select tests.authenticate_as('71000000-0000-4000-8000-000000000002');

select extensions.is(
  (
    select amount_minor
    from public.my_contribution_commitment_v1((select club_id from flexible_club))
  ),
  100000::bigint,
  'Member can read their own flexible amount'
);

select extensions.is(
  (
    select count(*)
    from public.member_contribution_commitment_versions
    where membership_id = (select membership_id from flexible_club)
  ),
  0::bigint,
  'Member cannot read the owner private amount'
);

select extensions.is(
  (
    select equal_amount_minor
    from public.club_contribution_policy_v1((select club_id from flexible_club))
  ),
  null,
  'Public flexible policy read does not leak a shared or aggregate amount'
);

select tests.authenticate_as('71000000-0000-4000-8000-000000000001');

select extensions.is(
  (
    select count(*)
    from public.member_contribution_commitment_versions
    where membership_id = (select membership_id from flexible_join)
  ),
  0::bigint,
  'Owner cannot read another member private amount'
);

select *
from public.create_member_contribution_commitment_v1(
  (select club_id from flexible_club),
  300000
);

select extensions.is(
  (
    select count(*)
    from public.member_contribution_commitment_versions
    where membership_id = (select membership_id from flexible_club)
  ),
  2::bigint,
  'Editing a flexible amount creates a new commitment version'
);

select extensions.is(
  (
    select expected_amount_minor
    from public.member_cycle_participations
    where investment_cycle_id = (select cycle_id from flexible_owner_day)
      and membership_id = (select membership_id from flexible_club)
  ),
  200000::bigint,
  'Current frozen cycle keeps the old amount after a later self-edit'
);

create temporary table flexible_owner_reload as
select *
from public.ensure_open_investment_day_v1((select club_id from flexible_club));

select extensions.is(
  (select expected_amount_minor from flexible_owner_reload),
  200000::bigint,
  'Reloading Investment Day after a 2,000 to 3,000 edit keeps the frozen 2,000'
);

select extensions.is(
  (select cycle_id from flexible_owner_reload),
  (select cycle_id from flexible_owner_day),
  'Reloading after a flexible edit does not open a new cycle'
);

select extensions.is(
  (
    select amount_minor
    from public.member_contribution_commitment_versions
    where membership_id = (select membership_id from flexible_club)
      and version_number = 1
  ),
  200000::bigint,
  'The old commitment version is retained'
);

reset role;

update public.investment_cycles
set status = 'completed',
    closed_at = now(),
    occurrence_key = occurrence_key || '-done'
where id = (select cycle_id from flexible_owner_day);

set local role authenticated;
select tests.authenticate_as('71000000-0000-4000-8000-000000000001');

create temporary table flexible_next_day as
select *
from public.ensure_open_investment_day_v1((select club_id from flexible_club));

select extensions.is(
  (select expected_amount_minor from flexible_next_day),
  300000::bigint,
  'The next cycle freezes the new flexible amount'
);

select tests.authenticate_as('71000000-0000-4000-8000-000000000003');

select extensions.is(
  tests.statement_message(
    format(
      $statement$
        select public.my_contribution_commitment_v1(%L::uuid)
      $statement$,
      (select club_id from flexible_club)
    )
  ),
  'vesty.not_club_member',
  'Cross-club callers cannot read a private commitment'
);

select tests.authenticate_as('71000000-0000-4000-8000-000000000001');

create temporary table legacy_v1_club as
select *
from public.create_club(
  'Legacy V1 Product Club',
  'simple_majority',
  'world_mix',
  'NOK'
);

select extensions.is(
  (
    select mode::text
    from public.contribution_policy_versions
    where club_id = (select club_id from legacy_v1_club)
  ),
  'flexible',
  'Legacy create_club still writes Flexible policy v1'
);

select extensions.is(
  (
    select count(*)
    from public.member_contribution_commitment_versions
    where club_id = (select club_id from legacy_v1_club)
  ),
  0::bigint,
  'Legacy create_club does not invent a creator amount'
);

select extensions.is(
  tests.statement_message(
    format(
      $statement$
        select public.ensure_open_investment_day_v1(%L::uuid)
      $statement$,
      (select club_id from legacy_v1_club)
    )
  ),
  'vesty.contribution_commitment_required',
  'Legacy 2000 NOK runtime bootstrap is gone'
);

select *
from public.create_member_contribution_commitment_v1(
  (select club_id from legacy_v1_club),
  150000
);

create temporary table legacy_day as
select *
from public.ensure_open_investment_day_v1((select club_id from legacy_v1_club));

select extensions.is(
  (select expected_amount_minor from legacy_day),
  150000::bigint,
  'After an explicit commitment, legacy v1 clubs can still open an Investment Day'
);

create temporary table confirm_v1 as
select *
from public.report_investment_day_v1(
  (select club_id from legacy_v1_club),
  (select cycle_id from legacy_day),
  '84000000-0000-4000-8000-000000000001'::uuid,
  'as_planned',
  'confirmed',
  '[]'::jsonb
);

select extensions.ok(
  exists (select 1 from confirm_v1),
  'report_investment_day_v1 still succeeds'
);

select extensions.is(
  (
    select outcome::text
    from public.member_cycle_participations
    where investment_cycle_id = (select cycle_id from legacy_day)
      and membership_id = (select membership_id from legacy_v1_club)
  ),
  'confirmed',
  'Participation outcome remains confirmed after v1 confirm'
);

reset role;

update public.investment_cycles
set status = 'completed',
    closed_at = now(),
    occurrence_key = occurrence_key || '-v2'
where id = (select cycle_id from legacy_day);

set local role authenticated;
select tests.authenticate_as('71000000-0000-4000-8000-000000000001');

create temporary table legacy_day_v2 as
select *
from public.ensure_open_investment_day_v1((select club_id from legacy_v1_club));

create temporary table confirm_v2 as
select *
from public.report_investment_day_v1(
  (select club_id from legacy_v1_club),
  (select cycle_id from legacy_day_v2),
  '84000000-0000-4000-8000-000000000002'::uuid,
  'as_planned',
  'confirmed',
  jsonb_build_array(
    jsonb_build_object(
      'investment_target_id', '31000000-0000-4000-8000-000000000011',
      'quantity', '1'
    ),
    jsonb_build_object(
      'investment_target_id', '31000000-0000-4000-8000-000000000012',
      'quantity', '1'
    ),
    jsonb_build_object(
      'investment_target_id', '31000000-0000-4000-8000-000000000013',
      'quantity', '1'
    )
  )
);

select extensions.ok(
  exists (select 1 from confirm_v2),
  'as_planned report with optional quantity still succeeds'
);

select extensions.is(
  (
    select expected_amount_minor
    from public.member_cycle_participations
    where investment_cycle_id = (select cycle_id from equal_day)
      and membership_id = (select membership_id from equal_club)
  ),
  200000::bigint,
  'Historical equal expected amounts remain unchanged'
);

select * from extensions.finish();

rollback;
