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
  perform pg_catalog.set_config('request.jwt.claims', '{}', true);
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
grant execute on function tests.clear_authentication() to authenticated;
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
    '00000000-0000-4000-8000-000000000011',
    'authenticated',
    'authenticated',
    'eve@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000000012',
    'authenticated',
    'authenticated',
    'frank@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000000013',
    'authenticated',
    'authenticated',
    'grace@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000000014',
    'authenticated',
    'authenticated',
    'hank@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

insert into public.profiles (id, display_name)
values
  ('00000000-0000-4000-8000-000000000011', 'Eve'),
  ('00000000-0000-4000-8000-000000000012', 'Frank'),
  ('00000000-0000-4000-8000-000000000013', 'Grace'),
  ('00000000-0000-4000-8000-000000000014', 'Hank');

set local role authenticated;

select tests.clear_authentication();

select extensions.is(
  tests.statement_message(
    format(
      $statement$
        select public.create_club(
          'Should Fail Unauthenticated',
          'simple_majority',
          %L::jsonb,
          'NOK'
        )
      $statement$,
      tests.genesis_allocations()::text
    )
  ),
  'vesty.unauthenticated',
  'Unauthenticated create_club is rejected'
);

reset role;

select extensions.is(
  (
    select count(*)
    from public.clubs
    where name = 'Should Fail Unauthenticated'
  ),
  0::bigint,
  'Rejected unauthenticated create leaves no club row'
);

select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.create_club(text, public.governance_threshold_kind, jsonb, text)',
    'execute'
  ),
  'Anonymous role cannot execute create_club'
);

select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.create_club_invitation(uuid)',
    'execute'
  ),
  'Anonymous role cannot execute create_club_invitation'
);

select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.accept_club_invitation(text)',
    'execute'
  ),
  'Anonymous role cannot execute accept_club_invitation'
);

select extensions.ok(
  not has_function_privilege(
    'authenticated',
    'private.require_authenticated_profile_id()',
    'execute'
  ),
  'Authenticated role cannot execute private identity helper'
);

select extensions.ok(
  not has_function_privilege(
    'authenticated',
    'private.hash_invite_token(text)',
    'execute'
  ),
  'Authenticated role cannot execute private token hash helper'
);

set local role authenticated;
select tests.authenticate_as('00000000-0000-4000-8000-000000000011');

select extensions.is(
  tests.statement_sqlstate(
    $statement$
      insert into public.clubs (
        id,
        name,
        base_currency,
        governance_threshold_kind,
        current_owner_membership_id
      )
      values (
        '11000000-0000-4000-8000-000000000099',
        'Direct Insert',
        'NOK',
        'simple_majority',
        '22000000-0000-4000-8000-000000000099'
      )
    $statement$
  ),
  '42501',
  'Direct club insert remains forbidden'
);

select extensions.is(
  tests.statement_sqlstate(
    $statement$
      insert into public.club_memberships (club_id, profile_id, status)
      values (
        '11000000-0000-4000-8000-000000000099',
        '00000000-0000-4000-8000-000000000011',
        'active'
      )
    $statement$
  ),
  '42501',
  'Direct membership insert remains forbidden'
);

select extensions.is(
  tests.statement_message(
    format(
      $statement$
        select public.create_club(
          'Bad Sum Club',
          'simple_majority',
          %L::jsonb,
          'NOK'
        )
      $statement$,
      $json$[
        {
          "investment_target_id": "31000000-0000-4000-8000-000000000001",
          "allocation_bps": 4000,
          "position": 1
        }
      ]$json$
    )
  ),
  'vesty.invalid_allocation_sum',
  'Invalid allocation sum is rejected'
);

reset role;

select extensions.is(
  (
    select count(*)
    from public.clubs
    where name = 'Bad Sum Club'
  ),
  0::bigint,
  'Invalid create leaves no partial club'
);

select extensions.is(
  (
    select count(*)
    from public.club_memberships as membership
    join public.profiles as profile on profile.id = membership.profile_id
    where profile.id = '00000000-0000-4000-8000-000000000011'
  ),
  0::bigint,
  'Invalid create leaves no partial membership'
);

select extensions.is(
  (
    select count(*)
    from public.strategy_versions
    where created_by_membership_id in (
      select id
      from public.club_memberships
      where profile_id = '00000000-0000-4000-8000-000000000011'
    )
  ),
  0::bigint,
  'Invalid create leaves no partial strategy'
);

set local role authenticated;
select tests.authenticate_as('00000000-0000-4000-8000-000000000011');

create temporary table eve_first_club as
select *
from public.create_club(
  '  Eve Club  ',
  'supermajority',
  tests.genesis_allocations(),
  'NOK'
);

select extensions.is(
  (select count(*) from eve_first_club),
  1::bigint,
  'Authenticated user can create a club'
);

select extensions.is(
  (
    select count(*)
    from public.club_memberships
    where club_id = (select club_id from eve_first_club)
      and status = 'active'
  ),
  1::bigint,
  'Create club makes exactly one active membership'
);

select extensions.is(
  (
    select profile_id
    from public.club_memberships
    where id = (select membership_id from eve_first_club)
  ),
  '00000000-0000-4000-8000-000000000011'::uuid,
  'Created membership belongs to the authenticated caller'
);

select extensions.is(
  (
    select current_owner_membership_id
    from public.clubs
    where id = (select club_id from eve_first_club)
  ),
  (select membership_id from eve_first_club),
  'current_owner_membership_id points at the caller membership'
);

select extensions.is(
  (
    select name
    from public.clubs
    where id = (select club_id from eve_first_club)
  ),
  'Eve Club',
  'Club name is trimmed'
);

select extensions.is(
  (
    select governance_threshold_kind::text
    from public.clubs
    where id = (select club_id from eve_first_club)
  ),
  'supermajority',
  'Governance mode is persisted as the existing enum value'
);

select extensions.is(
  (
    select base_currency
    from public.clubs
    where id = (select club_id from eve_first_club)
  ),
  'NOK',
  'V1 base currency is NOK'
);

select extensions.is(
  (
    select version_number
    from public.strategy_versions
    where id = (select strategy_version_id from eve_first_club)
  ),
  1,
  'Genesis StrategyVersion 1 is created'
);

select extensions.is(
  (
    select origin::text
    from public.strategy_versions
    where id = (select strategy_version_id from eve_first_club)
  ),
  'genesis',
  'StrategyVersion 1 uses genesis origin'
);

select extensions.is(
  (
    select coalesce(sum(allocation_bps), 0)
    from public.strategy_allocations
    where strategy_version_id = (select strategy_version_id from eve_first_club)
  ),
  10000::bigint,
  'Genesis allocation sum is 10000 bps'
);

create temporary table eve_second_club as
select *
from public.create_club(
  'Eve Second',
  'unanimous',
  tests.genesis_allocations(),
  'NOK'
);

select extensions.is(
  (
    select count(*)
    from public.clubs
    where id in (
      (select club_id from eve_first_club),
      (select club_id from eve_second_club)
    )
  ),
  2::bigint,
  'A user can belong to multiple clubs they created'
);

select tests.authenticate_as('00000000-0000-4000-8000-000000000012');

select extensions.is(
  tests.statement_message(
    format(
      $statement$
        select public.create_club_invitation(%L::uuid)
      $statement$,
      (select club_id from eve_first_club)
    )
  ),
  'vesty.invite_forbidden',
  'Unauthorized invitation creation is rejected'
);

select tests.authenticate_as('00000000-0000-4000-8000-000000000011');

create temporary table eve_invite as
select *
from public.create_club_invitation((select club_id from eve_first_club));

select extensions.ok(
  (select invite_token from eve_invite) ~ '^[0-9a-f]{24}$',
  'Invite token is a 24-character hex secret, not a sequential id'
);

select extensions.is(
  (
    select token_hash is not null
    from public.club_invitations
    where id = (select invitation_id from eve_invite)
  ),
  true,
  'Invitation stores a token hash rather than the raw secret'
);

select extensions.isnt(
  (
    select encode(token_hash, 'hex')
    from public.club_invitations
    where id = (select invitation_id from eve_invite)
  ),
  (select invite_token from eve_invite),
  'Stored hash is not the plaintext token'
);

select tests.authenticate_as('00000000-0000-4000-8000-000000000012');

select extensions.is(
  tests.statement_message(
    $statement$
      select public.accept_club_invitation('not-a-real-token')
    $statement$
  ),
  'vesty.invite_invalid',
  'Invalid token is rejected'
);

create temporary table frank_join as
select *
from public.accept_club_invitation((select invite_token from eve_invite));

select extensions.is(
  (select count(*) from frank_join),
  1::bigint,
  'Valid invitation acceptance succeeds'
);

select extensions.is(
  (
    select count(*)
    from public.club_memberships
    where club_id = (select club_id from eve_first_club)
      and status = 'active'
  ),
  2::bigint,
  'Acceptance creates exactly one additional active membership'
);

select extensions.is(
  (
    select current_owner_membership_id
    from public.clubs
    where id = (select club_id from eve_first_club)
  ),
  (select membership_id from eve_first_club),
  'Invitation acceptance does not change ownership'
);

select extensions.is(
  tests.statement_message(
    format(
      $statement$
        select public.accept_club_invitation(%L)
      $statement$,
      (select invite_token from eve_invite)
    )
  ),
  'vesty.invite_invalid',
  'Duplicate acceptance of the same invitation is rejected'
);

select tests.authenticate_as('00000000-0000-4000-8000-000000000011');

create temporary table eve_second_invite as
select *
from public.create_club_invitation((select club_id from eve_first_club));

select tests.authenticate_as('00000000-0000-4000-8000-000000000012');

select extensions.is(
  tests.statement_message(
    format(
      $statement$
        select public.accept_club_invitation(%L)
      $statement$,
      (select invite_token from eve_second_invite)
    )
  ),
  'vesty.already_member',
  'Existing active member cannot join twice'
);

reset role;

update public.club_invitations
set
  created_at = now() - interval '2 hours',
  expires_at = now() - interval '1 hour'
where id = (
  select invitation_id
  from eve_second_invite
);

insert into public.club_invitations (
  id,
  club_id,
  invited_by_membership_id,
  invitee_email,
  token_hash,
  status,
  expires_at
)
values (
  'b1000000-0000-4000-8000-000000000001',
  (select club_id from eve_first_club),
  (select membership_id from eve_first_club),
  'hank@example.test',
  private.hash_invite_token('aabbccddeeff001122334455'),
  'pending',
  now() + interval '7 days'
);

insert into public.club_invitations (
  id,
  club_id,
  invited_by_membership_id,
  token_hash,
  status,
  expires_at,
  revoked_at
)
values (
  'b1000000-0000-4000-8000-000000000002',
  (select club_id from eve_first_club),
  (select membership_id from eve_first_club),
  private.hash_invite_token('ffffffffffff001122334455'),
  'revoked',
  now() + interval '7 days',
  now()
);

set local role authenticated;
select tests.authenticate_as('00000000-0000-4000-8000-000000000013');

select extensions.is(
  tests.statement_message(
    format(
      $statement$
        select public.accept_club_invitation(%L)
      $statement$,
      (select invite_token from eve_second_invite)
    )
  ),
  'vesty.invite_expired',
  'Expired invitation is rejected'
);

select extensions.is(
  tests.statement_message(
    $statement$
      select public.accept_club_invitation('ffffffffffff001122334455')
    $statement$
  ),
  'vesty.invite_invalid',
  'Revoked invitation is rejected'
);

select extensions.is(
  tests.statement_message(
    $statement$
      select public.accept_club_invitation('aabbccddeeff001122334455')
    $statement$
  ),
  'vesty.invite_not_recipient',
  'Wrong authenticated recipient is rejected for an email-bound invitation'
);

select tests.authenticate_as('00000000-0000-4000-8000-000000000014');

create temporary table hank_join as
select *
from public.accept_club_invitation('aabbccddeeff001122334455');

select extensions.is(
  (select count(*) from hank_join),
  1::bigint,
  'Matching authenticated email recipient can accept an email-bound invitation'
);

select extensions.is(
  (
    select current_owner_membership_id
    from public.clubs
    where id = (select club_id from eve_first_club)
  ),
  (select membership_id from eve_first_club),
  'Email-bound acceptance still leaves ownership unchanged'
);

reset role;

select extensions.ok(
  not has_function_privilege(
    'anon',
    'private.create_club(text, public.governance_threshold_kind, jsonb, text)',
    'execute'
  ),
  'Anonymous role cannot execute private create_club'
);

select * from extensions.finish();

rollback;
