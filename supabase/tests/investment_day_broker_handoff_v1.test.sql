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

grant execute on function tests.open_investment_day_v1(uuid, timestamptz) to authenticated;

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
    '76000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'handoff-owner@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '76000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'handoff-unfrozen@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '76000000-0000-4000-8000-000000000003',
    'authenticated',
    'authenticated',
    'handoff-outsider@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

insert into public.profiles (id, display_name)
values
  ('76000000-0000-4000-8000-000000000001', 'Handoff Owner'),
  ('76000000-0000-4000-8000-000000000002', 'Handoff Unfrozen'),
  ('76000000-0000-4000-8000-000000000003', 'Handoff Outsider');

select extensions.ok(
  private.is_allowed_nordnet_handoff_url(
    'https://www.nordnet.no/fond/liste/dnb-global-indeks-a-nok-7b4b0894'
  ),
  'Official Nordnet HTTPS product page is allowed'
);

select extensions.ok(
  not private.is_allowed_nordnet_handoff_url(
    'http://www.nordnet.no/fond/liste/dnb-global-indeks-a-nok-7b4b0894'
  )
  and not private.is_allowed_nordnet_handoff_url(
    'nordnet://fond/liste/dnb-global-indeks-a-nok-7b4b0894'
  )
  and not private.is_allowed_nordnet_handoff_url(
    'https://nordnet.no.example.com/fond/liste/dnb-global-indeks-a'
  )
  and not private.is_allowed_nordnet_handoff_url(
    'https://www.nordnet.no.example.com/fond/liste/dnb-global-indeks-a'
  )
  and not private.is_allowed_nordnet_handoff_url(
    'https://www.nordnet.no@evil.example/fond/liste/dnb-global-indeks-a'
  )
  and not private.is_allowed_nordnet_handoff_url(
    'https://evil.example@www.nordnet.no/fond/liste/dnb-global-indeks-a-nok-7b4b0894'
  )
  and not private.is_allowed_nordnet_handoff_url(
    'https://www.dnb.no/sparing/fond/fond-liste/d/dnb-global-indeks-a-NO0010582984'
  ),
  'HTTP, app schemes, lookalikes, userinfo, and DNB hosts are rejected for Nordnet handoff'
);

select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.investment_day_broker_handoff_v1(uuid, uuid, text)',
    'execute'
  ),
  'Anonymous role cannot execute the public broker handoff'
);

select extensions.ok(
  not has_function_privilege(
    'authenticated',
    'private.investment_day_broker_handoff_v1(uuid, uuid, text)',
    'execute'
  ),
  'Authenticated role cannot execute the private broker handoff'
);

select extensions.ok(
  not has_function_privilege(
    'authenticated',
    'private.is_allowed_nordnet_handoff_url(text)',
    'execute'
  ),
  'Authenticated role cannot execute the Nordnet URL helper'
);

select extensions.ok(
  has_function_privilege(
    'authenticated',
    'public.investment_day_broker_handoff_v1(uuid, uuid, text)',
    'execute'
  ),
  'Authenticated role can execute the public broker handoff wrapper'
);

reset role;
set local role authenticated;
select tests.authenticate_as('76000000-0000-4000-8000-000000000001');

create temporary table handoff_club as
select *
from public.create_club_v3(
  'Handoff Equal Club',
  'single_fund',
  '32000000-0000-4000-8000-000000000001',
  'simple_majority',
  'equal',
  '77000000-0000-4000-8000-000000000010',
  200000,
  null,
  'NOK'
);

create temporary table handoff_day as
select *
from tests.open_investment_day_v1((select club_id from handoff_club));

select extensions.is(
  (select viewer_state from handoff_day),
  'open',
  'Test helper opens a frozen Investment Day for the creator'
);

select extensions.ok(
  (select cycle_id from handoff_day) is not null,
  'Frozen Investment Day has a cycle id'
);

create temporary table other_club as
select *
from public.create_club_v3(
  'Handoff Other Club',
  'single_fund',
  '32000000-0000-4000-8000-000000000001',
  'simple_majority',
  'equal',
  '77000000-0000-4000-8000-000000000011',
  150000,
  null,
  'NOK'
);

create temporary table other_day as
select cycle.id as cycle_id
from public.investment_cycles as cycle
where cycle.club_id = (select club_id from other_club)
  and cycle.status <> 'cancelled'
order by cycle.investment_day_at
limit 1;

create temporary table before_counts as
select
  (select count(*) from public.member_cycle_participations) as participations,
  (select count(*) from public.member_investment_day_reports) as reports,
  (select count(*) from public.member_investment_transactions) as transactions,
  (
    select participation.outcome::text
    from public.member_cycle_participations as participation
    where participation.investment_cycle_id = (select cycle_id from handoff_day)
  ) as outcome;

create temporary table ready_handoff as
select *
from public.investment_day_broker_handoff_v1(
  (select club_id from handoff_club),
  (select cycle_id from handoff_day),
  'nordnet'
);

select extensions.is(
  (select status from ready_handoff),
  'ready',
  'Active member in a frozen cycle gets a ready Nordnet handoff'
);

select extensions.is(
  (select product_url from ready_handoff),
  'https://www.nordnet.no/fond/liste/dnb-global-indeks-a-nok-7b4b0894',
  'Ready handoff returns the verified official Nordnet HTTPS page'
);

select extensions.is(
  (select broker from ready_handoff),
  'nordnet',
  'Ready handoff names Nordnet'
);

select extensions.is(
  (select fund_name from ready_handoff),
  'DNB Global Indeks A',
  'Ready handoff returns DNB Global Indeks A'
);

select extensions.is(
  (select isin from ready_handoff),
  'NO0010582984',
  'Ready handoff returns the fund ISIN'
);

select extensions.ok(
  (select checked_on from ready_handoff) is not null,
  'Ready handoff returns the listing checked-on date'
);

select extensions.is(
  (
    select array(
      select jsonb_object_keys((select to_jsonb(ready_handoff) from ready_handoff))
      order by 1
    )
  ),
  array['broker', 'checked_on', 'fund_name', 'isin', 'product_url', 'status']::text[],
  'Handoff row returns only broker, fund name, ISIN, product page, checked-on date, and status'
);

select extensions.is(
  (select count(*) from public.member_cycle_participations),
  (select participations from before_counts),
  'Handoff does not add or remove participations'
);

select extensions.is(
  (select count(*) from public.member_investment_day_reports),
  (select reports from before_counts),
  'Handoff does not write an Investment Day report'
);

select extensions.is(
  (select count(*) from public.member_investment_transactions),
  (select transactions from before_counts),
  'Handoff does not write purchase rows'
);

select extensions.is(
  (
    select participation.outcome::text
    from public.member_cycle_participations as participation
    where participation.investment_cycle_id = (select cycle_id from handoff_day)
  ),
  (select outcome from before_counts),
  'Handoff does not change participation outcome'
);

select extensions.is(
  (
    select status
    from public.investment_day_broker_handoff_v1(
      (select club_id from handoff_club),
      (select cycle_id from handoff_day),
      'dnb'
    )
  ),
  'unavailable',
  'Unsupported broker preference returns unavailable rather than another broker URL'
);

select extensions.ok(
  (
    select product_url
    from public.investment_day_broker_handoff_v1(
      (select club_id from handoff_club),
      (select cycle_id from handoff_day),
      'dnb'
    )
  ) is null,
  'Unsupported broker preference does not return a product page'
);

select tests.authenticate_as('76000000-0000-4000-8000-000000000003');
select extensions.is(
  tests.statement_message(
    format(
      $sql$
        select public.investment_day_broker_handoff_v1(%L, %L, 'nordnet')
      $sql$,
      (select club_id from handoff_club),
      (select cycle_id from handoff_day)
    )
  ),
  'vesty.not_club_member',
  'Outsiders are rejected'
);

select tests.authenticate_as('76000000-0000-4000-8000-000000000001');
select extensions.is(
  tests.statement_message(
    format(
      $sql$
        select public.investment_day_broker_handoff_v1(%L, %L, 'nordnet')
      $sql$,
      '86000000-0000-4000-8000-000000000001',
      (select cycle_id from handoff_day)
    )
  ),
  'vesty.not_club_member',
  'A club the caller does not belong to is rejected'
);

select tests.authenticate_as('76000000-0000-4000-8000-000000000001');
select extensions.is(
  tests.statement_message(
    format(
      $sql$
        select public.investment_day_broker_handoff_v1(%L, %L, 'nordnet')
      $sql$,
      (select club_id from handoff_club),
      (select cycle_id from other_day)
    )
  ),
  'vesty.cycle_invalid',
  'A cycle from another club is rejected'
);

select extensions.is(
  tests.statement_message(
    format(
      $sql$
        select public.investment_day_broker_handoff_v1(%L, %L, 'nordnet')
      $sql$,
      (select club_id from other_club),
      (select cycle_id from handoff_day)
    )
  ),
  'vesty.cycle_invalid',
  'The wrong club for a cycle is rejected'
);

reset role;
insert into public.club_memberships (club_id, profile_id, status, joined_at)
values (
  (select club_id from handoff_club),
  '76000000-0000-4000-8000-000000000002',
  'active',
  now()
);

set local role authenticated;
select tests.authenticate_as('76000000-0000-4000-8000-000000000002');
select extensions.is(
  tests.statement_message(
    format(
      $sql$
        select public.investment_day_broker_handoff_v1(%L, %L, 'nordnet')
      $sql$,
      (select club_id from handoff_club),
      (select cycle_id from handoff_day)
    )
  ),
  'vesty.not_in_snapshot',
  'An active member without a frozen participation is rejected'
);

reset role;
update private.single_fund_broker_listings
set is_verified = false
where broker = 'nordnet'
  and product_id = '32000000-0000-4000-8000-000000000001';

set local role authenticated;
select tests.authenticate_as('76000000-0000-4000-8000-000000000001');
select extensions.is(
  (
    select status
    from public.investment_day_broker_handoff_v1(
      (select club_id from handoff_club),
      (select cycle_id from handoff_day),
      'nordnet'
    )
  ),
  'unavailable',
  'Unverified Nordnet listings are not returned as ready'
);

select extensions.ok(
  (
    select product_url
    from public.investment_day_broker_handoff_v1(
      (select club_id from handoff_club),
      (select cycle_id from handoff_day),
      'nordnet'
    )
  ) is null,
  'Unverified Nordnet listings do not return a product page'
);

reset role;
update private.single_fund_broker_listings
set is_verified = true
where broker = 'nordnet'
  and product_id = '32000000-0000-4000-8000-000000000001';

update private.single_fund_products
set status = 'inactive'
where id = '32000000-0000-4000-8000-000000000001';

set local role authenticated;
select tests.authenticate_as('76000000-0000-4000-8000-000000000001');
select extensions.is(
  (
    select status
    from public.investment_day_broker_handoff_v1(
      (select club_id from handoff_club),
      (select cycle_id from handoff_day),
      'nordnet'
    )
  ),
  'unavailable',
  'Inactive catalog products are not returned as ready'
);

reset role;
update private.single_fund_products
set status = 'active'
where id = '32000000-0000-4000-8000-000000000001';

delete from private.single_fund_broker_listings
where broker = 'nordnet'
  and product_id = '32000000-0000-4000-8000-000000000001';

set local role authenticated;
select tests.authenticate_as('76000000-0000-4000-8000-000000000001');
select extensions.is(
  (
    select status
    from public.investment_day_broker_handoff_v1(
      (select club_id from handoff_club),
      (select cycle_id from handoff_day),
      'nordnet'
    )
  ),
  'unavailable',
  'A missing Nordnet listing is not returned as ready'
);

select extensions.ok(
  (
    select product_url
    from public.investment_day_broker_handoff_v1(
      (select club_id from handoff_club),
      (select cycle_id from handoff_day),
      'nordnet'
    )
  ) is null,
  'A missing Nordnet listing does not return a product page'
);

select extensions.finish();

rollback;
