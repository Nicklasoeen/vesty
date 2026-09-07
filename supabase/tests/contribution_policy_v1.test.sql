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

create function tests.clear_authentication()
returns void
language plpgsql
volatile
security invoker
set search_path = ''
as $function$
begin
  perform pg_catalog.set_config('request.jwt.claim.sub', '', true);
  perform pg_catalog.set_config('request.jwt.claims', '{}'::text, true);
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
grant execute on function tests.clear_authentication() to authenticated;
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
    '70000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'policy-owner@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '70000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'policy-member@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '70000000-0000-4000-8000-000000000003',
    'authenticated',
    'authenticated',
    'policy-outsider@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

insert into public.profiles (id, display_name)
values
  ('70000000-0000-4000-8000-000000000001', 'Owner'),
  ('70000000-0000-4000-8000-000000000002', 'Member'),
  ('70000000-0000-4000-8000-000000000003', 'Outsider');

select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.club_contribution_policy_v1(uuid)',
    'execute'
  ),
  'Anonymous role cannot read club contribution policy'
);

select extensions.ok(
  not has_function_privilege(
    'authenticated',
    'private.resolve_member_expected_contribution_v1(uuid, uuid)',
    'execute'
  ),
  'Authenticated role cannot execute the private contribution resolver'
);

set local role authenticated;
select tests.authenticate_as('70000000-0000-4000-8000-000000000001');

create temporary table owner_club as
select *
from public.create_club(
  'Policy Club',
  'simple_majority',
  'world_mix',
  'NOK'
);

select extensions.is(
  (
    select mode::text
    from public.contribution_policy_versions
    where club_id = (select club_id from owner_club)
      and version_number = 1
  ),
  'flexible',
  'create_club writes genesis ContributionPolicyVersion 1 as flexible'
);

select extensions.is(
  (
    select equal_amount_minor
    from public.contribution_policy_versions
    where club_id = (select club_id from owner_club)
      and version_number = 1
  ),
  null,
  'Genesis flexible policy has no shared equal amount'
);

select extensions.is(
  tests.statement_sqlstate(
    $statement$
      insert into public.contribution_policy_versions (
        club_id,
        version_number,
        mode,
        currency,
        equal_amount_minor,
        created_by_membership_id
      )
      values (
        (select club_id from owner_club),
        2,
        'equal',
        'NOK',
        200000,
        (select membership_id from owner_club)
      )
    $statement$
  ),
  '42501',
  'Clients cannot insert contribution policy history'
);

reset role;

select extensions.is(
  tests.statement_sqlstate(
    format(
      $statement$
        insert into public.contribution_policy_versions (
          club_id,
          version_number,
          mode,
          currency,
          equal_amount_minor,
          created_by_membership_id
        )
        values (
          %L::uuid,
          2,
          'equal',
          'NOK',
          null,
          %L::uuid
        )
      $statement$,
      (select club_id from owner_club),
      (select membership_id from owner_club)
    )
  ),
  '23514',
  'Equal policy without amount is rejected'
);

select extensions.is(
  tests.statement_sqlstate(
    format(
      $statement$
        insert into public.contribution_policy_versions (
          club_id,
          version_number,
          mode,
          currency,
          equal_amount_minor,
          created_by_membership_id
        )
        values (
          %L::uuid,
          2,
          'equal',
          'NOK',
          0,
          %L::uuid
        )
      $statement$,
      (select club_id from owner_club),
      (select membership_id from owner_club)
    )
  ),
  '23514',
  'Equal policy with zero amount is rejected'
);

select extensions.is(
  tests.statement_sqlstate(
    format(
      $statement$
        insert into public.contribution_policy_versions (
          club_id,
          version_number,
          mode,
          currency,
          equal_amount_minor,
          created_by_membership_id
        )
        values (
          %L::uuid,
          2,
          'flexible',
          'NOK',
          200000,
          %L::uuid
        )
      $statement$,
      (select club_id from owner_club),
      (select membership_id from owner_club)
    )
  ),
  '23514',
  'Flexible policy with equal amount is rejected'
);

select extensions.is(
  tests.statement_sqlstate(
    format(
      $statement$
        insert into public.contribution_policy_versions (
          club_id,
          version_number,
          mode,
          currency,
          equal_amount_minor,
          created_by_membership_id
        )
        values (
          %L::uuid,
          1,
          'flexible',
          'NOK',
          null,
          %L::uuid
        )
      $statement$,
      (select club_id from owner_club),
      (select membership_id from owner_club)
    )
  ),
  '23505',
  'Duplicate policy version numbers are rejected'
);

select extensions.is(
  tests.statement_message(
    format(
      $statement$
        select private.resolve_member_expected_contribution_v1(
          %L::uuid,
          %L::uuid
        )
      $statement$,
      (
        select id
        from public.contribution_policy_versions
        where club_id = (select club_id from owner_club)
          and version_number = 1
      ),
      (select membership_id from owner_club)
    )
  ),
  'vesty.contribution_commitment_required',
  'Flexible resolution does not invent an amount when no commitment exists'
);

set local role authenticated;
select tests.authenticate_as('70000000-0000-4000-8000-000000000001');

create temporary table owner_commitment as
select *
from public.create_member_contribution_commitment_v1(
  (select club_id from owner_club),
  200000
);

select tests.authenticate_as('70000000-0000-4000-8000-000000000002');

select extensions.is(
  tests.statement_message(
    format(
      $statement$
        select public.create_member_contribution_commitment_v1(%L::uuid, 150000)
      $statement$,
      (select club_id from owner_club)
    )
  ),
  'vesty.not_club_member',
  'Outsiders cannot create a contribution commitment'
);

select tests.authenticate_as('70000000-0000-4000-8000-000000000001');

create temporary table owner_invite as
select *
from public.create_club_invitation((select club_id from owner_club));

select tests.authenticate_as('70000000-0000-4000-8000-000000000002');

create temporary table member_join as
select *
from public.accept_club_invitation((select invite_token from owner_invite));

create temporary table member_commitment as
select *
from public.create_member_contribution_commitment_v1(
  (select club_id from owner_club),
  150000
);

select extensions.is(
  (
    select amount_minor
    from public.my_contribution_commitment_v1((select club_id from owner_club))
  ),
  150000::bigint,
  'Member can read their own commitment'
);

select extensions.is(
  (
    select count(*)
    from public.member_contribution_commitment_versions
    where membership_id = (select membership_id from owner_club)
  ),
  0::bigint,
  'Member cannot read the owner private commitment'
);

select tests.authenticate_as('70000000-0000-4000-8000-000000000001');

select extensions.is(
  (
    select count(*)
    from public.member_contribution_commitment_versions
    where membership_id = (select membership_id from member_join)
  ),
  0::bigint,
  'Owner cannot read another member private commitment'
);

select extensions.is(
  (
    select equal_amount_minor
    from public.club_contribution_policy_v1((select club_id from owner_club))
  ),
  null,
  'Public flexible policy read does not include a shared amount'
);

create temporary table owner_day as
select *
from public.ensure_open_investment_day_v1((select club_id from owner_club));

select tests.authenticate_as('70000000-0000-4000-8000-000000000002');

create temporary table member_day as
select *
from public.ensure_open_investment_day_v1((select club_id from owner_club));

select extensions.is(
  (select expected_amount_minor from owner_day),
  200000::bigint,
  'Owner flexible freeze uses the owner commitment'
);

select extensions.is(
  (select expected_amount_minor from member_day),
  150000::bigint,
  'Member flexible freeze uses a different private commitment'
);

select extensions.is(
  (
    select contribution_policy_version_id
    from public.investment_cycles
    where id = (select cycle_id from owner_day)
  ),
  (
    select id
    from public.contribution_policy_versions
    where club_id = (select club_id from owner_club)
      and version_number = 1
  ),
  'Open cycle stores the frozen contribution policy version'
);

reset role;

select extensions.is(
  private.resolve_member_expected_contribution_v1(
    (
      select id
      from public.contribution_policy_versions
      where club_id = (select club_id from owner_club)
        and version_number = 1
    ),
    (select membership_id from owner_club)
  ),
  200000::bigint,
  'Equal-style helper returns the owner commitment under flexible policy'
);

select extensions.is(
  private.resolve_member_expected_contribution_v1(
    (
      select id
      from public.contribution_policy_versions
      where club_id = (select club_id from owner_club)
        and version_number = 1
    ),
    (select membership_id from member_join)
  ),
  150000::bigint,
  'Flexible helper returns a different amount for the other membership'
);

set local role authenticated;
select tests.authenticate_as('70000000-0000-4000-8000-000000000001');

select *
from public.create_member_contribution_commitment_v1(
  (select club_id from owner_club),
  350000
);

select extensions.is(
  (
    select expected_amount_minor
    from public.member_cycle_participations
    where investment_cycle_id = (select cycle_id from owner_day)
      and membership_id = (select membership_id from owner_club)
  ),
  200000::bigint,
  'A later commitment does not rewrite the frozen cycle expected amount'
);

reset role;

create temporary table later_policy as
select *
from private.create_contribution_policy_version_v1(
  (select club_id from owner_club),
  'equal',
  250000
);

grant select on later_policy to authenticated;

select extensions.is(
  (
    select contribution_policy_version_id
    from public.investment_cycles
    where id = (select cycle_id from owner_day)
  ),
  (
    select id
    from public.contribution_policy_versions
    where club_id = (select club_id from owner_club)
      and version_number = 1
  ),
  'A later policy version does not rewrite the frozen cycle policy'
);

set local role authenticated;
select tests.authenticate_as('70000000-0000-4000-8000-000000000001');

create temporary table owner_day_reload as
select *
from public.ensure_open_investment_day_v1((select club_id from owner_club));

select extensions.is(
  (select cycle_id from owner_day_reload),
  (select cycle_id from owner_day),
  'Reloading Investment Day reuses the already-open cycle'
);

select extensions.is(
  (
    select contribution_policy_version_id
    from public.investment_cycles
    where id = (select cycle_id from owner_day)
  ),
  (
    select id
    from public.contribution_policy_versions
    where club_id = (select club_id from owner_club)
      and version_number = 1
  ),
  'Existing cycle still stores policy v1 after a later trusted policy v2'
);

select extensions.is(
  (select expected_amount_minor from owner_day_reload),
  200000::bigint,
  'Existing cycle still resolves the frozen amount after a later trusted policy v2'
);

select tests.authenticate_as('70000000-0000-4000-8000-000000000002');

select extensions.ok(
  to_regprocedure(
    'public.create_contribution_policy_version_v1(uuid, public.contribution_policy_mode, bigint)'
  ) is null,
  'Public contribution-policy write RPC is removed'
);

select extensions.ok(
  not has_function_privilege(
    'authenticated',
    'private.create_contribution_policy_version_v1(uuid, public.contribution_policy_mode, bigint, uuid, uuid)',
    'execute'
  ),
  'Authenticated members cannot execute trusted policy-version insert'
);

select extensions.is(
  (
    select equal_amount_minor
    from public.club_contribution_policy_v1((select club_id from owner_club))
  ),
  250000::bigint,
  'Club members can read the shared equal amount on the latest policy'
);

select tests.authenticate_as('70000000-0000-4000-8000-000000000003');

select extensions.is(
  tests.statement_message(
    format(
      $statement$
        select public.club_contribution_policy_v1(%L::uuid)
      $statement$,
      (select club_id from owner_club)
    )
  ),
  'vesty.not_club_member',
  'Non-members cannot read another club contribution policy'
);

reset role;

select extensions.is(
  tests.statement_message(
    format(
      $statement$
        update public.investment_cycles
        set contribution_policy_version_id = %L::uuid
        where id = %L::uuid
      $statement$,
      (select policy_version_id from later_policy),
      (select cycle_id from owner_day)
    )
  ),
  'vesty.cycle_policy_frozen',
  'Frozen cycle policy references cannot be rewritten'
);

update public.investment_cycles
set status = 'completed',
    closed_at = now(),
    occurrence_key = occurrence_key || '-done'
where id = (select cycle_id from owner_day);

set local role authenticated;
select tests.authenticate_as('70000000-0000-4000-8000-000000000001');

create temporary table later_day as
select *
from public.ensure_open_investment_day_v1((select club_id from owner_club));

select extensions.is(
  (
    select contribution_policy_version_id
    from public.investment_cycles
    where id = (select cycle_id from later_day)
  ),
  (select policy_version_id from later_policy),
  'A future cycle uses the latest contribution policy version'
);

select extensions.is(
  (select expected_amount_minor from later_day),
  250000::bigint,
  'Equal policy freezes the shared amount for the owner'
);

select tests.authenticate_as('70000000-0000-4000-8000-000000000002');

create temporary table later_member_day as
select *
from public.ensure_open_investment_day_v1((select club_id from owner_club));

select extensions.is(
  (select expected_amount_minor from later_member_day),
  250000::bigint,
  'Equal policy freezes the same shared amount for another member'
);

select tests.authenticate_as('70000000-0000-4000-8000-000000000001');

select extensions.ok(
  exists (
    select 1
    from public.report_investment_day_v1(
      (select club_id from owner_club),
      (select cycle_id from later_day),
      '83000000-0000-4000-8000-000000000001'::uuid,
      'as_planned',
      'confirmed',
      '[]'::jsonb
    )
  ),
  'report_investment_day_v1 still succeeds after policy freeze'
);

select extensions.is(
  (
    select expected_amount_minor
    from public.member_cycle_participations
    where investment_cycle_id = (select cycle_id from owner_day)
      and membership_id = (select membership_id from owner_club)
  ),
  200000::bigint,
  'Historical expected_amount_minor is never rewritten to match a later policy'
);

select tests.authenticate_as('70000000-0000-4000-8000-000000000003');

create temporary table other_club as
select *
from public.create_club(
  'Other Policy Club',
  'simple_majority',
  'world_mix',
  'NOK'
);

select *
from public.create_member_contribution_commitment_v1(
  (select club_id from other_club),
  200000
);

select *
from public.ensure_open_investment_day_v1((select club_id from other_club));

select extensions.is(
  (
    select count(*)
    from public.contribution_policy_versions
    where club_id = (select club_id from owner_club)
  ),
  0::bigint,
  'Cross-club members cannot read another club policy rows'
);

reset role;

select extensions.is(
  tests.statement_sqlstate(
    format(
      $statement$
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
          opened_at
        )
        select
          (select club_id from other_club),
          schedule.id,
          version.id,
          (
            select id
            from public.contribution_policy_versions
            where club_id = (select club_id from owner_club)
            order by version_number desc
            limit 1
          ),
          'cross-club-policy',
          now() + interval '14 days',
          now() + interval '13 days',
          now() + interval '14 days',
          now() + interval '21 days',
          'Europe/Oslo',
          'upcoming',
          null
        from public.investment_schedules as schedule
        join public.strategy_versions as version
          on version.club_id = schedule.club_id
        where schedule.club_id = (select club_id from other_club)
        limit 1
      $statement$
    )
  ),
  '23503',
  'Cycles cannot reference a contribution policy from another club'
);

select * from extensions.finish();

rollback;
