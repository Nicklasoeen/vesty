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
    '60000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'rename-owner@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '60000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'rename-member@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '60000000-0000-4000-8000-000000000003',
    'authenticated',
    'authenticated',
    'rename-outsider@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

insert into public.profiles (id, display_name)
values
  ('60000000-0000-4000-8000-000000000001', 'Owner'),
  ('60000000-0000-4000-8000-000000000002', 'Member'),
  ('60000000-0000-4000-8000-000000000003', 'Outsider');

select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.update_club_name(uuid, text)',
    'execute'
  ),
  'Anonymous role cannot execute update_club_name'
);

set local role authenticated;
select tests.clear_authentication();

select extensions.is(
  tests.statement_message(
    $statement$
      select public.update_club_name(
        '61000000-0000-4000-8000-000000000001',
        'Should Fail Unauthenticated'
      )
    $statement$
  ),
  'vesty.unauthenticated',
  'Unauthenticated update_club_name is rejected'
);

select tests.authenticate_as('60000000-0000-4000-8000-000000000001');

create temporary table owner_club as
select *
from public.create_club(
  'Original Club',
  'simple_majority',
  'world_mix',
  'NOK'
);

select extensions.is(
  (
    select name
    from public.update_club_name(
      (select club_id from owner_club),
      '  Friday Club  '
    )
  ),
  'Friday Club',
  'Owner can rename an active club and the name is trimmed'
);

select extensions.is(
  (
    select name
    from public.clubs
    where id = (select club_id from owner_club)
  ),
  'Friday Club',
  'Renamed club name is persisted'
);

select extensions.is(
  (
    select governance_threshold_kind::text
    from public.clubs
    where id = (select club_id from owner_club)
  ),
  'simple_majority',
  'Rename does not change governance'
);

select extensions.is(
  tests.statement_message(
    format(
      $statement$
        select public.update_club_name(%L::uuid, '   ')
      $statement$,
      (select club_id from owner_club)
    )
  ),
  'vesty.club_name_invalid',
  'Whitespace-only club name is rejected'
);

select extensions.is(
  tests.statement_message(
    format(
      $statement$
        select public.update_club_name(%L::uuid, %L)
      $statement$,
      (select club_id from owner_club),
      repeat('a', 81)
    )
  ),
  'vesty.club_name_invalid',
  'Club names longer than 80 characters are rejected'
);

reset role;

insert into public.club_memberships (id, club_id, profile_id, status)
values (
  '62000000-0000-4000-8000-000000000002',
  (select club_id from owner_club),
  '60000000-0000-4000-8000-000000000002',
  'active'
);

set local role authenticated;
select tests.authenticate_as('60000000-0000-4000-8000-000000000002');

select extensions.is(
  tests.statement_message(
    format(
      $statement$
        select public.update_club_name(%L::uuid, 'Member Rename')
      $statement$,
      (select club_id from owner_club)
    )
  ),
  'vesty.club_rename_forbidden',
  'Active members cannot rename the club'
);

select tests.authenticate_as('60000000-0000-4000-8000-000000000003');

select extensions.is(
  tests.statement_message(
    format(
      $statement$
        select public.update_club_name(%L::uuid, 'Outsider Rename')
      $statement$,
      (select club_id from owner_club)
    )
  ),
  'vesty.club_rename_forbidden',
  'Outsiders cannot rename the club'
);

select extensions.is(
  tests.statement_sqlstate(
    format(
      $statement$
        update public.clubs
        set name = 'Direct Rename'
        where id = %L::uuid
      $statement$,
      (select club_id from owner_club)
    )
  ),
  '42501',
  'Direct club name updates remain forbidden'
);

reset role;

select extensions.is(
  (
    select name
    from public.clubs
    where id = (select club_id from owner_club)
  ),
  'Friday Club',
  'Rejected renames leave the stored name unchanged'
);

update public.clubs
set status = 'archived',
    archived_at = now()
where id = (select club_id from owner_club);

set local role authenticated;
select tests.authenticate_as('60000000-0000-4000-8000-000000000001');

select extensions.is(
  tests.statement_message(
    format(
      $statement$
        select public.update_club_name(%L::uuid, 'Archived Rename')
      $statement$,
      (select club_id from owner_club)
    )
  ),
  'vesty.club_rename_forbidden',
  'Archived clubs cannot be renamed'
);

select * from extensions.finish();

rollback;
