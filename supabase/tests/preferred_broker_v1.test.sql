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
grant execute on function tests.clear_authentication() to authenticated;
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
    '50000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'owner-broker@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '50000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'member-broker@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '50000000-0000-4000-8000-000000000003',
    'authenticated',
    'authenticated',
    'outsider-broker@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

insert into public.profiles (id, display_name)
values
  ('50000000-0000-4000-8000-000000000001', 'Owner'),
  ('50000000-0000-4000-8000-000000000002', 'Member'),
  ('50000000-0000-4000-8000-000000000003', 'Outsider');

insert into public.clubs (
  id,
  name,
  base_currency,
  governance_threshold_kind,
  current_owner_membership_id
)
values (
  '51000000-0000-4000-8000-000000000001',
  'Broker Club',
  'NOK',
  'simple_majority',
  '52000000-0000-4000-8000-000000000001'
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
    '52000000-0000-4000-8000-000000000001',
    '51000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000001',
    'active',
    now() - interval '30 days',
    null
  ),
  (
    '52000000-0000-4000-8000-000000000002',
    '51000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000002',
    'active',
    now() - interval '10 days',
    null
  );

select extensions.is(
  (
    select profile.preferred_broker
    from public.profiles as profile
    where profile.id = '50000000-0000-4000-8000-000000000001'
  ),
  null::public.preferred_broker,
  '1. preferred_broker is null by default'
);

select extensions.ok(
  exists (
    select 1
    from public.profiles
    where id = '50000000-0000-4000-8000-000000000001'
      and display_name = 'Owner'
      and preferred_broker is null
  ),
  '2. Existing complete profile remains valid without a broker'
);

set local role authenticated;
select tests.authenticate_as('50000000-0000-4000-8000-000000000001');

select extensions.is(
  tests.statement_row_count(
    $statement$
      update public.profiles
      set preferred_broker = 'nordnet'
      where id = '50000000-0000-4000-8000-000000000001'
    $statement$
  ),
  1::bigint,
  '3. Owner can set own preferred_broker to nordnet'
);

select extensions.is(
  public.get_own_preferred_broker(),
  'nordnet',
  '4. Owner reads own preferred_broker through the private getter'
);

select extensions.is(
  tests.statement_row_count(
    $statement$
      update public.profiles
      set preferred_broker = 'dnb'
      where id = '50000000-0000-4000-8000-000000000001'
    $statement$
  ),
  1::bigint,
  '5a. Valid broker dnb is accepted'
);

select extensions.is(
  tests.statement_row_count(
    $statement$
      update public.profiles
      set preferred_broker = 'kron'
      where id = '50000000-0000-4000-8000-000000000001'
    $statement$
  ),
  1::bigint,
  '5b. Valid broker kron is accepted'
);

select extensions.is(
  tests.statement_row_count(
    $statement$
      update public.profiles
      set preferred_broker = 'sparebank1'
      where id = '50000000-0000-4000-8000-000000000001'
    $statement$
  ),
  1::bigint,
  '5c. Valid broker sparebank1 is accepted'
);

select extensions.is(
  tests.statement_row_count(
    $statement$
      update public.profiles
      set preferred_broker = 'other'
      where id = '50000000-0000-4000-8000-000000000001'
    $statement$
  ),
  1::bigint,
  '5d. Valid broker other is accepted'
);

select extensions.is(
  tests.statement_sqlstate(
    $statement$
      update public.profiles
      set preferred_broker = 'sbanken'
      where id = '50000000-0000-4000-8000-000000000001'
    $statement$
  ),
  '22P02',
  '6. Invalid broker values are rejected'
);

select extensions.is(
  tests.statement_row_count(
    $statement$
      update public.profiles
      set preferred_broker = null
      where id = '50000000-0000-4000-8000-000000000001'
    $statement$
  ),
  1::bigint,
  '7. Owner can clear own preferred_broker'
);

select extensions.is(
  tests.statement_row_count(
    $statement$
      update public.profiles
      set display_name = 'Owner Updated'
      where id = '50000000-0000-4000-8000-000000000001'
    $statement$
  ),
  1::bigint,
  '8. Display-name update still works without requiring a broker'
);

select extensions.is(
  public.get_own_preferred_broker(),
  null,
  '9. Cleared broker stays null after an unrelated profile update'
);

select extensions.is(
  tests.statement_row_count(
    $statement$
      update public.profiles
      set preferred_broker = 'nordnet'
      where id = '50000000-0000-4000-8000-000000000002'
    $statement$
  ),
  0::bigint,
  '10. Owner cannot update another member preferred_broker'
);

select extensions.is(
  tests.statement_sqlstate(
    $statement$
      select preferred_broker
      from public.profiles
      where id = '50000000-0000-4000-8000-000000000002'
    $statement$
  ),
  '42501',
  '11. preferred_broker cannot be selected from profiles'
);

select extensions.ok(
  exists (
    select 1
    from public.profiles
    where id = '50000000-0000-4000-8000-000000000002'
      and display_name = 'Member'
  ),
  '12. Club member identity columns remain readable'
);

select tests.authenticate_as('50000000-0000-4000-8000-000000000002');

select extensions.is(
  public.get_own_preferred_broker(),
  null,
  '13. Fellow member getter returns only their own broker'
);

select extensions.is(
  tests.statement_sqlstate(
    $statement$
      select preferred_broker
      from public.profiles
      where id = '50000000-0000-4000-8000-000000000001'
    $statement$
  ),
  '42501',
  '14. Club member cannot read another profile preferred_broker'
);

select extensions.is(
  tests.statement_row_count(
    $statement$
      update public.profiles
      set preferred_broker = 'dnb'
      where id = '50000000-0000-4000-8000-000000000001'
    $statement$
  ),
  0::bigint,
  '15. Club member cannot update another preferred_broker'
);

select extensions.is(
  tests.statement_row_count(
    $statement$
      update public.profiles
      set preferred_broker = 'kron'
      where id = '50000000-0000-4000-8000-000000000002'
    $statement$
  ),
  1::bigint,
  '16. Member can update own preferred_broker'
);

select tests.authenticate_as('50000000-0000-4000-8000-000000000003');

select extensions.is(
  (select count(*) from public.profiles),
  1::bigint,
  '17. Outsider cannot enumerate club profiles'
);

select extensions.is(
  tests.statement_row_count(
    $statement$
      update public.profiles
      set preferred_broker = 'nordnet'
      where id = '50000000-0000-4000-8000-000000000001'
    $statement$
  ),
  0::bigint,
  '18. Outsider cannot update another preferred_broker'
);

select extensions.is(
  tests.statement_sqlstate(
    $statement$
      select preferred_broker
      from public.profiles
    $statement$
  ),
  '42501',
  '19. Outsider cannot select preferred_broker'
);

select extensions.is(
  public.get_own_preferred_broker(),
  null,
  '20. Outsider getter returns only their own unset broker'
);

select tests.clear_authentication();
reset role;

select extensions.finish();

rollback;
