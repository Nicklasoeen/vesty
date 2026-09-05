begin;

create extension if not exists pgtap with schema extensions;

create schema tests;
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

create function tests.statement_row_count(p_statement text)
returns bigint
language plpgsql
volatile
security invoker
set search_path = ''
as $function$
declare
  affected_rows bigint;
begin
  execute p_statement;
  get diagnostics affected_rows = row_count;
  return affected_rows;
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
grant execute on function tests.statement_row_count(text) to authenticated;
grant execute on function tests.statement_sqlstate(text) to authenticated;

select extensions.no_plan();

set constraints all deferred;

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
    '00000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'alice@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'bob@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000000003',
    'authenticated',
    'authenticated',
    'charlie@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000000004',
    'authenticated',
    'authenticated',
    'diana@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

insert into public.profiles (id, display_name)
values
  ('00000000-0000-4000-8000-000000000001', 'Alice'),
  ('00000000-0000-4000-8000-000000000002', 'Bob'),
  ('00000000-0000-4000-8000-000000000003', 'Charlie'),
  ('00000000-0000-4000-8000-000000000004', 'Diana');

insert into public.clubs (
  id,
  name,
  base_currency,
  governance_threshold_kind,
  current_owner_membership_id
)
values
  (
    '10000000-0000-4000-8000-000000000001',
    'Club A',
    'NOK',
    'simple_majority',
    '20000000-0000-4000-8000-000000000001'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    'Club B',
    'NOK',
    'unanimous',
    '20000000-0000-4000-8000-000000000003'
  );

insert into public.club_memberships (
  id,
  club_id,
  profile_id,
  status,
  joined_at,
  ended_at
)
values
  (
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001',
    'active',
    now() - interval '1 year',
    null
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002',
    'active',
    now() - interval '6 months',
    null
  ),
  (
    '20000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000003',
    'active',
    now() - interval '3 months',
    null
  ),
  (
    '20000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000004',
    'left',
    now() - interval '1 year',
    now() - interval '1 month'
  );

insert into public.club_invitations (
  id,
  club_id,
  invited_by_membership_id,
  invitee_profile_id,
  status,
  expires_at
)
values (
  'b0000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000003',
  'pending',
  now() + interval '7 days'
);

insert into public.club_invitations (
  id,
  club_id,
  invited_by_membership_id,
  invitee_email,
  status,
  expires_at
)
values (
  'b0000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  'email-only@example.test',
  'pending',
  now() + interval '7 days'
);

insert into public.ownership_transfers (
  id,
  club_id,
  initiating_owner_membership_id,
  target_membership_id,
  status,
  expires_at
)
values (
  'c0000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  'pending',
  now() + interval '7 days'
);

insert into public.investment_targets (
  id,
  name,
  kind,
  status,
  isin,
  currency
)
values
  (
    '30000000-0000-4000-8000-000000000001',
    'Active Test Fund',
    'fund',
    'active',
    'NO0000000001',
    'NOK'
  ),
  (
    '30000000-0000-4000-8000-000000000002',
    'Inactive Historical ETF',
    'etf',
    'inactive',
    'NO0000000002',
    'NOK'
  );

insert into public.strategy_versions (
  id,
  club_id,
  version_number,
  created_by_membership_id,
  origin,
  effective_at
)
values
  (
    '40000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    1,
    '20000000-0000-4000-8000-000000000001',
    'genesis',
    now()
  ),
  (
    '40000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002',
    1,
    '20000000-0000-4000-8000-000000000003',
    'genesis',
    now()
  );

insert into public.strategy_allocations (
  id,
  strategy_version_id,
  investment_target_id,
  allocation_bps,
  position,
  target_name,
  target_kind,
  target_isin
)
values
  (
    '41000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    10000,
    1,
    'Active Test Fund',
    'fund',
    'NO0000000001'
  ),
  (
    '41000000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000001',
    10000,
    1,
    'Active Test Fund',
    'fund',
    'NO0000000001'
  );

insert into public.strategy_proposals (
  id,
  club_id,
  proposer_membership_id,
  base_strategy_version_id,
  status,
  reason
)
values
  (
    '50000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000001',
    'draft',
    'Bob draft'
  ),
  (
    '50000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    'draft',
    'Alice draft'
  );

insert into public.strategy_proposals (
  id,
  club_id,
  proposer_membership_id,
  base_strategy_version_id,
  status,
  reason,
  voting_threshold_kind,
  electorate_size,
  required_yes_count,
  intended_effective_at,
  opened_at,
  deadline_at
)
values (
  '50000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  '40000000-0000-4000-8000-000000000001',
  'open',
  'Open proposal',
  'simple_majority',
  3,
  2,
  now() + interval '7 days',
  now() - interval '1 hour',
  now() + interval '2 days'
);

insert into public.strategy_proposals (
  id,
  club_id,
  proposer_membership_id,
  base_strategy_version_id,
  status,
  reason,
  voting_threshold_kind,
  electorate_size,
  required_yes_count,
  intended_effective_at,
  opened_at,
  deadline_at,
  closed_at
)
values (
  '50000000-0000-4000-8000-000000000004',
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000001',
  'rejected',
  'Terminal proposal',
  'simple_majority',
  2,
  2,
  now() + interval '7 days',
  now() - interval '2 days',
  now() - interval '1 day',
  now() - interval '1 day'
);

insert into public.strategy_proposals (
  id,
  club_id,
  proposer_membership_id,
  base_strategy_version_id,
  status,
  reason,
  voting_threshold_kind,
  electorate_size,
  required_yes_count,
  intended_effective_at,
  opened_at,
  deadline_at
)
values (
  '50000000-0000-4000-8000-000000000005',
  '10000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000003',
  '40000000-0000-4000-8000-000000000002',
  'open',
  'Past-deadline proposal',
  'unanimous',
  1,
  1,
  now() + interval '7 days',
  now() - interval '2 hours',
  now() - interval '1 hour'
);

insert into public.strategy_proposal_allocations (
  id,
  proposal_id,
  investment_target_id,
  allocation_bps,
  position,
  target_name,
  target_kind,
  target_isin
)
values
  (
    '51000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    10000,
    1,
    'Active Test Fund',
    'fund',
    'NO0000000001'
  ),
  (
    '51000000-0000-4000-8000-000000000002',
    '50000000-0000-4000-8000-000000000003',
    '30000000-0000-4000-8000-000000000001',
    10000,
    1,
    'Active Test Fund',
    'fund',
    'NO0000000001'
  ),
  (
    '51000000-0000-4000-8000-000000000003',
    '50000000-0000-4000-8000-000000000004',
    '30000000-0000-4000-8000-000000000002',
    10000,
    1,
    'Inactive Historical ETF',
    'etf',
    'NO0000000002'
  );

insert into public.proposal_electorate_members (
  proposal_id,
  membership_id,
  club_id,
  snapshotted_at
)
values
  (
    '50000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    now() - interval '1 hour'
  ),
  (
    '50000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    now() - interval '1 hour'
  ),
  (
    '50000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000001',
    now() - interval '1 hour'
  ),
  (
    '50000000-0000-4000-8000-000000000004',
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    now() - interval '2 days'
  ),
  (
    '50000000-0000-4000-8000-000000000004',
    '20000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    now() - interval '2 days'
  ),
  (
    '50000000-0000-4000-8000-000000000005',
    '20000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000002',
    now() - interval '2 hours'
  );

insert into public.votes (
  proposal_id,
  membership_id,
  choice,
  cast_at
)
values
  (
    '50000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000001',
    'yes',
    now() - interval '30 minutes'
  ),
  (
    '50000000-0000-4000-8000-000000000004',
    '20000000-0000-4000-8000-000000000001',
    'yes',
    now() - interval '2 days'
  ),
  (
    '50000000-0000-4000-8000-000000000004',
    '20000000-0000-4000-8000-000000000002',
    'no',
    now() - interval '2 days'
  );

insert into public.strategy_readiness (
  id,
  club_id,
  membership_id,
  strategy_version_id,
  status
)
values (
  'a0000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  '40000000-0000-4000-8000-000000000001',
  'pending'
);

insert into public.investment_schedules (
  id,
  club_id,
  revision_number,
  status,
  day_of_month,
  missing_day_policy,
  timezone,
  configuration_lead_days,
  effective_from,
  created_by_membership_id
)
values
  (
    '60000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    1,
    'active',
    15,
    'last_day_of_month',
    'Europe/Oslo',
    3,
    now() - interval '1 year',
    '20000000-0000-4000-8000-000000000001'
  ),
  (
    '60000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002',
    1,
    'active',
    20,
    'last_day_of_month',
    'Europe/Oslo',
    3,
    now() - interval '1 year',
    '20000000-0000-4000-8000-000000000003'
  );

insert into public.investment_cycles (
  id,
  club_id,
  investment_schedule_id,
  strategy_version_id,
  occurrence_key,
  investment_day_at,
  configuration_deadline_at,
  reporting_opens_at,
  reporting_closes_at,
  timezone,
  status,
  opened_at,
  closed_at,
  cancellation_reason
)
values
  (
    '70000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    'club-a-open',
    now() + interval '1 day',
    now() - interval '3 days',
    now() - interval '1 hour',
    now() + interval '2 days',
    'Europe/Oslo',
    'open',
    now() - interval '1 hour',
    null,
    null
  ),
  (
    '70000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    'club-a-completed',
    now() - interval '1 month',
    now() - interval '1 month 3 days',
    now() - interval '1 month 1 day',
    now() - interval '3 weeks',
    'Europe/Oslo',
    'completed',
    now() - interval '1 month 1 day',
    now() - interval '3 weeks',
    null
  ),
  (
    '70000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000002',
    '60000000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000002',
    'club-b-open',
    now() + interval '2 days',
    now() - interval '2 days',
    now() - interval '1 hour',
    now() + interval '3 days',
    'Europe/Oslo',
    'open',
    now() - interval '1 hour',
    null,
    null
  );

insert into public.member_saving_plans (
  id,
  club_id,
  membership_id,
  amount_minor,
  currency,
  status,
  active_from,
  active_until
)
values
  (
    '80000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    100000,
    'NOK',
    'active',
    now() - interval '1 year',
    null
  ),
  (
    '80000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002',
    200000,
    'NOK',
    'active',
    now() - interval '6 months',
    null
  ),
  (
    '80000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000003',
    300000,
    'NOK',
    'active',
    now() - interval '3 months',
    null
  ),
  (
    '80000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000004',
    150000,
    'NOK',
    'inactive',
    now() - interval '1 year',
    now() - interval '1 month'
  );

insert into public.member_cycle_participations (
  id,
  club_id,
  investment_cycle_id,
  membership_id,
  saving_plan_id,
  expected_amount_minor,
  currency
)
values
  (
    '90000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '70000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '80000000-0000-4000-8000-000000000001',
    100000,
    'NOK'
  ),
  (
    '90000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    '70000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002',
    '80000000-0000-4000-8000-000000000002',
    200000,
    'NOK'
  ),
  (
    '90000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000001',
    '70000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002',
    '80000000-0000-4000-8000-000000000002',
    200000,
    'NOK'
  );

set constraints all immediate;

set local role authenticated;

select tests.authenticate_as('00000000-0000-4000-8000-000000000001');

select extensions.is(
  (
    select count(*)
    from public.clubs
    where id = '10000000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  '1. Alice can read Club A'
);

select tests.authenticate_as('00000000-0000-4000-8000-000000000002');

select extensions.is(
  (
    select count(*)
    from public.clubs
    where id = '10000000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  '2. Bob can read Club A'
);

select tests.authenticate_as('00000000-0000-4000-8000-000000000003');

select extensions.is(
  (
    select count(*)
    from public.clubs
    where id = '10000000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  '3. Charlie cannot read Club A'
);

select tests.authenticate_as('00000000-0000-4000-8000-000000000002');

select extensions.is(
  (
    select count(*)
    from public.clubs
    where id = '10000000-0000-4000-8000-000000000002'
  ),
  0::bigint,
  '4. Club A members cannot read Club B'
);

select tests.authenticate_as('00000000-0000-4000-8000-000000000004');

select extensions.is(
  (
    select count(*)
    from public.clubs
    where id = '10000000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  '5. Former membership does not preserve Club A access'
);

select tests.authenticate_as('00000000-0000-4000-8000-000000000001');

select extensions.is(
  (select count(*) from public.profiles),
  3::bigint,
  '6. Alice sees only profiles from her current club history'
);

select tests.authenticate_as('00000000-0000-4000-8000-000000000003');

select extensions.is(
  (select count(*) from public.profiles),
  1::bigint,
  '7. Charlie cannot enumerate unrelated profiles'
);

select tests.authenticate_as('00000000-0000-4000-8000-000000000001');

select extensions.is(
  tests.statement_row_count(
    $statement$
      update public.profiles
      set display_name = 'Alice Updated'
      where id = '00000000-0000-4000-8000-000000000001'
    $statement$
  ),
  1::bigint,
  '8a. Alice can update her own profile'
);

select extensions.is(
  tests.statement_row_count(
    $statement$
      update public.profiles
      set display_name = 'Spoofed Bob'
      where id = '00000000-0000-4000-8000-000000000002'
    $statement$
  ),
  0::bigint,
  '8b. Alice cannot update another profile'
);

select tests.authenticate_as('00000000-0000-4000-8000-000000000002');

select extensions.is(
  tests.statement_sqlstate(
    $statement$
      update public.club_memberships
      set status = 'removed', ended_at = now(),
          removed_by_membership_id = '20000000-0000-4000-8000-000000000002'
      where id = '20000000-0000-4000-8000-000000000001'
    $statement$
  ),
  '42501',
  '9. Bob cannot remove Alice'
);

select extensions.is(
  tests.statement_sqlstate(
    $statement$
      update public.clubs
      set current_owner_membership_id =
        '20000000-0000-4000-8000-000000000002'
      where id = '10000000-0000-4000-8000-000000000001'
    $statement$
  ),
  '42501',
  '10. Bob cannot promote himself to owner'
);

select tests.authenticate_as('00000000-0000-4000-8000-000000000003');

select extensions.is(
  tests.statement_sqlstate(
    $statement$
      insert into public.club_memberships (club_id, profile_id)
      values (
        '10000000-0000-4000-8000-000000000001',
        '00000000-0000-4000-8000-000000000003'
      )
    $statement$
  ),
  '42501',
  '11. Charlie cannot create a Club A membership'
);

select tests.authenticate_as('00000000-0000-4000-8000-000000000002');

select extensions.is(
  tests.statement_sqlstate(
    $statement$
      delete from public.club_memberships
      where id = '20000000-0000-4000-8000-000000000004'
    $statement$
  ),
  '42501',
  '12. Normal clients cannot destroy membership history'
);

select tests.authenticate_as('00000000-0000-4000-8000-000000000001');

select extensions.is(
  (
    select count(*)
    from public.member_saving_plans
    where membership_id = '20000000-0000-4000-8000-000000000001'
      and amount_minor = 100000
  ),
  1::bigint,
  '13. Alice can read her exact saving plan'
);

select tests.authenticate_as('00000000-0000-4000-8000-000000000002');

select extensions.is(
  (
    select count(*)
    from public.member_saving_plans
    where membership_id = '20000000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  '14. Bob cannot read Alice saving plan'
);

select tests.authenticate_as('00000000-0000-4000-8000-000000000001');

select extensions.is(
  (
    select count(*)
    from public.member_saving_plans
    where membership_id = '20000000-0000-4000-8000-000000000002'
  ),
  0::bigint,
  '15. Owner status does not reveal Bob saving amount'
);

select tests.authenticate_as('00000000-0000-4000-8000-000000000002');

select extensions.is(
  tests.statement_row_count(
    $statement$
      update public.member_saving_plans
      set status = 'inactive', active_until = now()
      where id = '80000000-0000-4000-8000-000000000002'
    $statement$
  ),
  1::bigint,
  '16. Bob can end his own saving plan'
);

select extensions.is(
  tests.statement_row_count(
    $statement$
      insert into public.member_saving_plans (
        club_id,
        membership_id,
        amount_minor,
        currency,
        active_from,
        replaces_plan_id
      )
      values (
        '10000000-0000-4000-8000-000000000001',
        '20000000-0000-4000-8000-000000000002',
        250000,
        'NOK',
        now(),
        '80000000-0000-4000-8000-000000000002'
      )
    $statement$
  ),
  1::bigint,
  '16b. Bob can create his own replacement saving plan'
);

select extensions.is(
  tests.statement_row_count(
    $statement$
      update public.member_saving_plans
      set status = 'inactive', active_until = now()
      where id = '80000000-0000-4000-8000-000000000001'
    $statement$
  ),
  0::bigint,
  '17. Bob cannot update Alice saving plan'
);

select extensions.is(
  (
    select count(*)
    from public.strategy_versions
    where club_id = '10000000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  '18. Club A members can read Club A strategy'
);

select tests.authenticate_as('00000000-0000-4000-8000-000000000003');

select extensions.is(
  (
    select count(*)
    from public.strategy_versions
    where club_id = '10000000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  '19. Charlie cannot read Club A strategy'
);

select extensions.is(
  tests.statement_sqlstate(
    $statement$
      update public.strategy_versions
      set effective_at = now() + interval '1 day'
      where id = '40000000-0000-4000-8000-000000000001'
    $statement$
  ),
  '42501',
  '20. Normal clients cannot mutate StrategyVersion'
);

select tests.authenticate_as('00000000-0000-4000-8000-000000000002');

select extensions.is(
  tests.statement_row_count(
    $statement$
      insert into public.strategy_proposals (
        club_id,
        proposer_membership_id,
        base_strategy_version_id,
        reason
      )
      values (
        '10000000-0000-4000-8000-000000000001',
        '20000000-0000-4000-8000-000000000002',
        '40000000-0000-4000-8000-000000000001',
        'Bob client-created draft'
      )
    $statement$
  ),
  1::bigint,
  '21. Bob can create his own Club A draft'
);

select tests.authenticate_as('00000000-0000-4000-8000-000000000003');

select extensions.is(
  tests.statement_sqlstate(
    $statement$
      insert into public.strategy_proposals (
        club_id,
        proposer_membership_id,
        base_strategy_version_id,
        reason
      )
      values (
        '10000000-0000-4000-8000-000000000001',
        '20000000-0000-4000-8000-000000000003',
        '40000000-0000-4000-8000-000000000001',
        'Charlie unauthorized draft'
      )
    $statement$
  ),
  '42501',
  '22. Charlie cannot create a Club A proposal'
);

select tests.authenticate_as('00000000-0000-4000-8000-000000000002');

select extensions.is(
  tests.statement_sqlstate(
    $statement$
      insert into public.strategy_proposals (
        club_id,
        proposer_membership_id,
        base_strategy_version_id,
        reason
      )
      values (
        '10000000-0000-4000-8000-000000000001',
        '20000000-0000-4000-8000-000000000001',
        '40000000-0000-4000-8000-000000000001',
        'Spoofed Alice proposer'
      )
    $statement$
  ),
  '42501',
  '23. Bob cannot spoof Alice as proposer'
);

select extensions.is(
  tests.statement_row_count(
    $statement$
      update public.strategy_proposals
      set reason = 'Bob edited his draft'
      where id = '50000000-0000-4000-8000-000000000001'
    $statement$
  ),
  1::bigint,
  '24a. Bob can edit his own draft'
);

select extensions.is(
  tests.statement_row_count(
    $statement$
      update public.strategy_proposals
      set reason = 'Bob edited Alice draft'
      where id = '50000000-0000-4000-8000-000000000002'
    $statement$
  ),
  0::bigint,
  '24b. Bob cannot edit another proposer draft'
);

select extensions.is(
  tests.statement_row_count(
    $statement$
      update public.strategy_proposals
      set reason = 'Changed open proposal'
      where id = '50000000-0000-4000-8000-000000000003'
    $statement$
  ),
  0::bigint,
  '25. Open proposals cannot be arbitrarily changed'
);

select extensions.is(
  tests.statement_row_count(
    $statement$
      update public.strategy_proposal_allocations
      set allocation_bps = 5000
      where id = '51000000-0000-4000-8000-000000000001'
    $statement$
  ),
  1::bigint,
  '26. Proposer can edit allocation rows in own draft'
);

select tests.authenticate_as('00000000-0000-4000-8000-000000000001');

select extensions.is(
  tests.statement_row_count(
    $statement$
      update public.strategy_proposal_allocations
      set allocation_bps = 9000
      where id = '51000000-0000-4000-8000-000000000001'
    $statement$
  ),
  0::bigint,
  '27. Other members cannot alter proposer draft allocations'
);

select tests.authenticate_as('00000000-0000-4000-8000-000000000002');

select extensions.is(
  tests.statement_row_count(
    $statement$
      update public.strategy_proposal_allocations
      set allocation_bps = 9000
      where id = '51000000-0000-4000-8000-000000000002'
    $statement$
  ),
  0::bigint,
  '28. Open proposal allocations are frozen from clients'
);

select tests.authenticate_as('00000000-0000-4000-8000-000000000003');

select extensions.is(
  tests.statement_sqlstate(
    $statement$
      insert into public.votes (proposal_id, membership_id, choice)
      values (
        '50000000-0000-4000-8000-000000000003',
        '20000000-0000-4000-8000-000000000003',
        'yes'
      )
    $statement$
  ),
  '42501',
  '29. Users outside the frozen electorate cannot vote'
);

select tests.authenticate_as('00000000-0000-4000-8000-000000000002');

select extensions.is(
  tests.statement_row_count(
    $statement$
      insert into public.votes (proposal_id, membership_id, choice)
      values (
        '50000000-0000-4000-8000-000000000003',
        '20000000-0000-4000-8000-000000000002',
        'no'
      )
    $statement$
  ),
  1::bigint,
  '30. Electorate member can cast one vote'
);

select extensions.is(
  tests.statement_sqlstate(
    $statement$
      insert into public.votes (proposal_id, membership_id, choice)
      values (
        '50000000-0000-4000-8000-000000000003',
        '20000000-0000-4000-8000-000000000002',
        'yes'
      )
    $statement$
  ),
  '23505',
  '31. Duplicate vote is rejected'
);

select extensions.is(
  tests.statement_sqlstate(
    $statement$
      update public.votes
      set choice = 'yes'
      where proposal_id = '50000000-0000-4000-8000-000000000003'
        and membership_id = '20000000-0000-4000-8000-000000000002'
    $statement$
  ),
  '42501',
  '32. Vote cannot be updated'
);

select extensions.is(
  tests.statement_sqlstate(
    $statement$
      delete from public.votes
      where proposal_id = '50000000-0000-4000-8000-000000000003'
        and membership_id = '20000000-0000-4000-8000-000000000002'
    $statement$
  ),
  '42501',
  '33. Vote cannot be deleted'
);

select extensions.is(
  (
    select count(*)
    from public.votes
    where proposal_id = '50000000-0000-4000-8000-000000000003'
  ),
  0::bigint,
  '34. Individual vote choices are hidden while proposal is open'
);

select extensions.is(
  (
    select count(*)
    from public.votes
    where proposal_id = '50000000-0000-4000-8000-000000000004'
  ),
  2::bigint,
  '35. Active members can read terminal historical votes'
);

select tests.authenticate_as('00000000-0000-4000-8000-000000000001');

select extensions.is(
  tests.statement_row_count(
    $statement$
      insert into public.strategy_readiness (
        club_id,
        membership_id,
        strategy_version_id,
        status,
        confirmed_at
      )
      values (
        '10000000-0000-4000-8000-000000000001',
        '20000000-0000-4000-8000-000000000001',
        '40000000-0000-4000-8000-000000000001',
        'ready',
        now()
      )
    $statement$
  ),
  1::bigint,
  '36. Alice can set her own readiness'
);

select extensions.is(
  tests.statement_row_count(
    $statement$
      update public.strategy_readiness
      set status = 'ready', confirmed_at = now()
      where id = 'a0000000-0000-4000-8000-000000000001'
    $statement$
  ),
  0::bigint,
  '37. Alice cannot set Bob readiness'
);

select tests.authenticate_as('00000000-0000-4000-8000-000000000002');

select extensions.is(
  (
    select count(*)
    from public.investment_cycles
    where club_id = '10000000-0000-4000-8000-000000000001'
  ),
  2::bigint,
  '38. Bob can read Club A cycle metadata'
);

select tests.authenticate_as('00000000-0000-4000-8000-000000000003');

select extensions.is(
  (
    select count(*)
    from public.investment_cycles
    where club_id = '10000000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  '39. Charlie cannot read Club A cycles'
);

select tests.authenticate_as('00000000-0000-4000-8000-000000000002');

select extensions.is(
  tests.statement_sqlstate(
    $statement$
      insert into public.investment_cycles (
        club_id,
        investment_schedule_id,
        strategy_version_id,
        occurrence_key,
        investment_day_at,
        configuration_deadline_at,
        reporting_opens_at,
        reporting_closes_at,
        timezone
      )
      values (
        '10000000-0000-4000-8000-000000000001',
        '60000000-0000-4000-8000-000000000001',
        '40000000-0000-4000-8000-000000000001',
        'client-created',
        now() + interval '10 days',
        now() + interval '7 days',
        now() + interval '9 days',
        now() + interval '11 days',
        'Europe/Oslo'
      )
    $statement$
  ),
  '42501',
  '40. Bob cannot create arbitrary cycles'
);

select extensions.is(
  tests.statement_row_count(
    $statement$
      update public.member_cycle_participations
      set outcome = 'confirmed',
          report_source = 'member_reported',
          reported_at = now()
      where id = '90000000-0000-4000-8000-000000000002'
    $statement$
  ),
  1::bigint,
  '41. Bob can report his own open participation'
);

select extensions.is(
  tests.statement_sqlstate(
    $statement$
      update public.member_cycle_participations
      set outcome = 'expected',
          report_source = null,
          reported_at = null
      where id = '90000000-0000-4000-8000-000000000002'
    $statement$
  ),
  '42501',
  'Submitted participation cannot revert to expected'
);

select extensions.is(
  tests.statement_row_count(
    $statement$
      update public.member_cycle_participations
      set outcome = 'failed', corrected_at = now()
      where id = '90000000-0000-4000-8000-000000000002'
    $statement$
  ),
  1::bigint,
  'Bob can correct his own report while the cycle remains open'
);

select extensions.is(
  tests.statement_row_count(
    $statement$
      update public.member_cycle_participations
      set outcome = 'confirmed',
          report_source = 'member_reported',
          reported_at = now()
      where id = '90000000-0000-4000-8000-000000000001'
    $statement$
  ),
  0::bigint,
  '42. Bob cannot modify Alice participation'
);

select extensions.is(
  tests.statement_row_count(
    $statement$
      update public.member_cycle_participations
      set outcome = 'failed',
          report_source = 'member_reported',
          reported_at = now()
      where id = '90000000-0000-4000-8000-000000000003'
    $statement$
  ),
  0::bigint,
  '43. Bob cannot report after cycle completion'
);

select extensions.is(
  tests.statement_sqlstate(
    $statement$
      update public.member_cycle_participations
      set verification_state = 'verified',
          verification_source = 'broker_api',
          verified_at = now()
      where id = '90000000-0000-4000-8000-000000000002'
    $statement$
  ),
  '42501',
  '44. Bob cannot write broker verification fields'
);

select tests.authenticate_as('00000000-0000-4000-8000-000000000001');

select extensions.is(
  (
    select count(*)
    from public.member_cycle_participations
    where membership_id = '20000000-0000-4000-8000-000000000002'
  ),
  0::bigint,
  '45. Alice cannot read Bob exact participation amount'
);

select tests.authenticate_as('00000000-0000-4000-8000-000000000002');

select extensions.is(
  (
    select count(*)
    from public.investment_targets
    where status = 'active'
  ),
  10::bigint,
  '46. Authenticated users can read supported targets'
);

select extensions.is(
  tests.statement_sqlstate(
    $statement$
      insert into public.investment_targets (name, kind, status, currency)
      values ('Client Target', 'fund', 'active', 'NOK')
    $statement$
  ),
  '42501',
  '47a. Normal users cannot create targets'
);

select extensions.is(
  tests.statement_sqlstate(
    $statement$
      update public.investment_targets
      set name = 'Client Rewrite'
      where id = '30000000-0000-4000-8000-000000000001'
    $statement$
  ),
  '42501',
  '47b. Normal users cannot update targets'
);

select extensions.is(
  tests.statement_sqlstate(
    $statement$
      delete from public.investment_targets
      where id = '30000000-0000-4000-8000-000000000001'
    $statement$
  ),
  '42501',
  '47c. Normal users cannot delete targets'
);

select extensions.is(
  tests.statement_sqlstate(
    $statement$
      update public.clubs
      set current_owner_membership_id =
        '20000000-0000-4000-8000-000000000002'
      where id = '10000000-0000-4000-8000-000000000001'
    $statement$
  ),
  '42501',
  '48. Ordinary member cannot change owner pointer'
);

select extensions.is(
  tests.statement_sqlstate(
    $statement$
      update public.ownership_transfers
      set status = 'accepted',
          resolved_by_membership_id =
            '20000000-0000-4000-8000-000000000002',
          accepted_at = now()
      where id = 'c0000000-0000-4000-8000-000000000001'
    $statement$
  ),
  '42501',
  '49. Ordinary member cannot fabricate ownership transfer state'
);

select tests.authenticate_as('00000000-0000-4000-8000-000000000001');

select extensions.is(
  (
    select count(*)
    from public.club_invitations
    where club_id = '10000000-0000-4000-8000-000000000001'
  ),
  2::bigint,
  'Owner can read all invitations for the owned club'
);

select tests.authenticate_as('00000000-0000-4000-8000-000000000003');

select extensions.is(
  (
    select count(*)
    from public.club_invitations
    where id = 'b0000000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'Profile-addressed recipient can read their invitation'
);

select extensions.is(
  (
    select count(*)
    from public.club_invitations
    where id = 'b0000000-0000-4000-8000-000000000002'
  ),
  0::bigint,
  'Email-only invitation is not exposed without trusted identity binding'
);

select extensions.is(
  tests.statement_sqlstate(
    $statement$
      insert into public.votes (proposal_id, membership_id, choice)
      values (
        '50000000-0000-4000-8000-000000000005',
        '20000000-0000-4000-8000-000000000003',
        'yes'
      )
    $statement$
  ),
  '42501',
  'Electorate member cannot vote after the proposal deadline'
);

select tests.authenticate_as('00000000-0000-4000-8000-000000000002');

select extensions.is(
  (
    select count(*)
    from public.ownership_transfers
    where id = 'c0000000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'Ownership-transfer target can read the pending transfer'
);

select extensions.is(
  tests.statement_sqlstate(
    $statement$
      insert into public.member_saving_plans (
        club_id,
        membership_id,
        amount_minor,
        currency,
        active_from
      )
      values (
        '10000000-0000-4000-8000-000000000002',
        '20000000-0000-4000-8000-000000000002',
        500000,
        'NOK',
        now()
      )
    $statement$
  ),
  '42501',
  'Saving-plan insert cannot cross club boundaries'
);

select extensions.is(
  tests.statement_sqlstate(
    $statement$
      insert into public.member_cycle_participations (
        club_id,
        investment_cycle_id,
        membership_id,
        saving_plan_id,
        expected_amount_minor,
        currency
      )
      values (
        '10000000-0000-4000-8000-000000000001',
        '70000000-0000-4000-8000-000000000001',
        '20000000-0000-4000-8000-000000000002',
        '80000000-0000-4000-8000-000000000002',
        900000,
        'NOK'
      )
    $statement$
  ),
  '42501',
  'Normal clients cannot create participation snapshots'
);

select tests.authenticate_as('00000000-0000-4000-8000-000000000004');

select extensions.is(
  (
    select count(*)
    from public.strategy_proposals
    where id = '50000000-0000-4000-8000-000000000003'
  ),
  1::bigint,
  'Former electorate member retains narrow open-proposal access'
);

select extensions.is(
  tests.statement_row_count(
    $statement$
      insert into public.votes (proposal_id, membership_id, choice)
      values (
        '50000000-0000-4000-8000-000000000003',
        '20000000-0000-4000-8000-000000000004',
        'no'
      )
    $statement$
  ),
  1::bigint,
  'Former electorate member can complete the frozen ballot'
);

select extensions.is(
  (
    select count(*)
    from public.votes
    where proposal_id = '50000000-0000-4000-8000-000000000004'
  ),
  0::bigint,
  'Former member cannot read terminal historical votes'
);

select extensions.is(
  (
    select count(*)
    from public.member_saving_plans
    where id = '80000000-0000-4000-8000-000000000004'
  ),
  0::bigint,
  'Former member cannot read their historical saving plan'
);

reset role;

select extensions.ok(
  not has_table_privilege('anon', 'public.clubs', 'select'),
  'Anonymous role has no club read grant'
);

select extensions.ok(
  not has_function_privilege(
    'anon',
    'private.is_active_club_member(uuid)',
    'execute'
  ),
  'Anonymous role cannot execute authorization helpers'
);

select * from extensions.finish();

rollback;
