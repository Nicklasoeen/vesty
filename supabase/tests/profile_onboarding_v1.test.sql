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
    '40000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'owner@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '40000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'member@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '40000000-0000-4000-8000-000000000003',
    'authenticated',
    'authenticated',
    'outsider@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '40000000-0000-4000-8000-000000000004',
    'authenticated',
    'authenticated',
    'former@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

insert into public.profiles (id, display_name)
values
  ('40000000-0000-4000-8000-000000000001', 'Owner'),
  ('40000000-0000-4000-8000-000000000002', null),
  ('40000000-0000-4000-8000-000000000003', 'Outsider'),
  ('40000000-0000-4000-8000-000000000004', 'Former');

insert into public.clubs (
  id,
  name,
  base_currency,
  governance_threshold_kind,
  current_owner_membership_id
)
values (
  '41000000-0000-4000-8000-000000000001',
  'Profile Club',
  'NOK',
  'simple_majority',
  '42000000-0000-4000-8000-000000000001'
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
    '42000000-0000-4000-8000-000000000001',
    '41000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    'active',
    now() - interval '30 days',
    null
  ),
  (
    '42000000-0000-4000-8000-000000000002',
    '41000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000002',
    'active',
    now() - interval '10 days',
    null
  ),
  (
    '42000000-0000-4000-8000-000000000004',
    '41000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000004',
    'left',
    now() - interval '20 days',
    now() - interval '2 days'
  );

set local role authenticated;
select tests.authenticate_as('40000000-0000-4000-8000-000000000001');

select extensions.is(
  tests.statement_row_count(
    $statement$
      update public.profiles
      set display_name = 'Nicklas Øen',
          avatar_path = '40000000-0000-4000-8000-000000000001/avatar.jpg'
      where id = '40000000-0000-4000-8000-000000000001'
    $statement$
  ),
  1::bigint,
  '1. Owner can update own display_name and avatar_path'
);

select extensions.is(
  tests.statement_row_count(
    $statement$
      update public.profiles
      set display_name = 'Hijacked'
      where id = '40000000-0000-4000-8000-000000000002'
    $statement$
  ),
  0::bigint,
  '2. Owner cannot update another profile'
);

select extensions.is(
  tests.statement_sqlstate(
    $statement$
      update public.profiles
      set display_name = repeat('x', 81)
      where id = '40000000-0000-4000-8000-000000000001'
    $statement$
  ),
  '23514',
  '3. Display name longer than 80 characters is rejected'
);

select extensions.ok(
  exists (
    select 1
    from public.profiles
    where id = '40000000-0000-4000-8000-000000000002'
      and display_name is null
      and avatar_path is null
  ),
  '4. Active club member can read fellow member identity fields'
);

select tests.authenticate_as('40000000-0000-4000-8000-000000000003');

select extensions.is(
  (select count(*) from public.profiles),
  1::bigint,
  '5. Outsider cannot read club member profiles'
);

select extensions.is(
  tests.statement_row_count(
    $statement$
      update public.profiles
      set avatar_path = 'stolen.jpg'
      where id = '40000000-0000-4000-8000-000000000001'
    $statement$
  ),
  0::bigint,
  '6. Outsider cannot update another avatar_path'
);

select tests.authenticate_as('40000000-0000-4000-8000-000000000001');

select extensions.is(
  tests.statement_sqlstate(
    $statement$
      insert into storage.objects (bucket_id, name)
      values (
        'avatars',
        '40000000-0000-4000-8000-000000000001/avatar.jpg'
      )
    $statement$
  ),
  null,
  '7. Owner can upload own avatar object'
);

select extensions.is(
  tests.statement_sqlstate(
    $statement$
      insert into storage.objects (bucket_id, name)
      values (
        'avatars',
        '40000000-0000-4000-8000-000000000002/avatar.jpg'
      )
    $statement$
  ),
  '42501',
  '8. Owner cannot upload to another user avatar path'
);

select tests.authenticate_as('40000000-0000-4000-8000-000000000002');

select extensions.ok(
  exists (
    select 1
    from storage.objects
    where bucket_id = 'avatars'
      and name = '40000000-0000-4000-8000-000000000001/avatar.jpg'
  ),
  '9. Active club member can read authorized avatar object'
);

select extensions.is(
  tests.statement_row_count(
    $statement$
      update storage.objects
      set metadata = '{"mutated":true}'::jsonb
      where bucket_id = 'avatars'
        and name = '40000000-0000-4000-8000-000000000001/avatar.jpg'
    $statement$
  ),
  0::bigint,
  '10. Member cannot overwrite another user avatar'
);

select tests.authenticate_as('40000000-0000-4000-8000-000000000003');

select extensions.is(
  (
    select count(*)
    from storage.objects
    where bucket_id = 'avatars'
      and name = '40000000-0000-4000-8000-000000000001/avatar.jpg'
  ),
  0::bigint,
  '11. Outsider cannot read another user avatar object'
);

select tests.authenticate_as('40000000-0000-4000-8000-000000000004');

select extensions.is(
  (select count(*) from public.profiles),
  1::bigint,
  '12. Former member cannot keep reading fellow club profiles'
);

select extensions.is(
  (
    select count(*)
    from storage.objects
    where bucket_id = 'avatars'
      and name = '40000000-0000-4000-8000-000000000001/avatar.jpg'
  ),
  0::bigint,
  '13. Former member cannot keep reading fellow club avatars'
);

select tests.authenticate_as('40000000-0000-4000-8000-000000000001');

select extensions.ok(
  exists (
    select 1
    from public.profiles
    where id = '40000000-0000-4000-8000-000000000004'
  ),
  '14. Active member can still read a former member identity'
);

select extensions.is(
  tests.statement_row_count(
    $statement$
      update storage.objects
      set metadata = '{"owner":true}'::jsonb
      where bucket_id = 'avatars'
        and name = '40000000-0000-4000-8000-000000000001/avatar.jpg'
    $statement$
  ),
  1::bigint,
  '15. Owner can overwrite own avatar object'
);

select extensions.ok(
  exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'avatars_delete_own'
      and qual like '%auth.uid()%'
      and qual like '%avatar.jpg%'
  ),
  '16. Own-avatar delete policy is restricted to the caller path'
);

select tests.clear_authentication();
reset role;

select extensions.finish();

rollback;
