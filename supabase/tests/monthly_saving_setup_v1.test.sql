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
    '78000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'saving-owner@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '78000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'saving-member@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '78000000-0000-4000-8000-000000000003',
    'authenticated',
    'authenticated',
    'saving-outsider@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

insert into public.profiles (id, display_name)
values
  ('78000000-0000-4000-8000-000000000001', 'Saving Owner'),
  ('78000000-0000-4000-8000-000000000002', 'Saving Member'),
  ('78000000-0000-4000-8000-000000000003', 'Saving Outsider');

select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.monthly_saving_setup_v1(uuid)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'public.confirm_monthly_saving_setup_v1(uuid, uuid)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'public.end_monthly_saving_setup_v1(uuid)',
    'execute'
  ),
  'Anonymous role cannot execute monthly saving setup RPCs'
);

select extensions.ok(
  not has_function_privilege(
    'anon',
    'private.monthly_saving_setup_v1(uuid)',
    'execute'
  )
  and not has_function_privilege(
    'authenticated',
    'private.monthly_saving_setup_v1(uuid)',
    'execute'
  )
  and not has_function_privilege(
    'authenticated',
    'private.confirm_monthly_saving_setup_v1(uuid, uuid)',
    'execute'
  )
  and not has_function_privilege(
    'authenticated',
    'private.end_monthly_saving_setup_v1(uuid)',
    'execute'
  )
  and not has_function_privilege(
    'authenticated',
    'private.monthly_saving_setup_row_v1(uuid, uuid)',
    'execute'
  )
  and not has_function_privilege(
    'authenticated',
    'private.monthly_saving_setup_fingerprint_v1(public.preferred_broker, uuid, bigint, text, uuid, integer, smallint, text, text)',
    'execute'
  ),
  'Private monthly saving functions are closed to PUBLIC, anon, and authenticated'
);

select extensions.ok(
  has_function_privilege(
    'authenticated',
    'public.monthly_saving_setup_v1(uuid)',
    'execute'
  )
  and has_function_privilege(
    'authenticated',
    'public.confirm_monthly_saving_setup_v1(uuid, uuid)',
    'execute'
  )
  and has_function_privilege(
    'authenticated',
    'public.end_monthly_saving_setup_v1(uuid)',
    'execute'
  ),
  'Authenticated role can execute the public monthly saving wrappers'
);

select extensions.ok(
  not has_table_privilege(
    'authenticated',
    'public.member_monthly_saving_setup_attestations',
    'insert'
  )
  and not has_table_privilege(
    'authenticated',
    'public.member_monthly_saving_setup_attestations',
    'update'
  )
  and not has_table_privilege(
    'authenticated',
    'public.member_monthly_saving_setup_attestations',
    'delete'
  )
  and has_table_privilege(
    'authenticated',
    'public.member_monthly_saving_setup_attestations',
    'select'
  ),
  'Authenticated clients can only SELECT own monthly saving attestations'
);

reset role;
set local role authenticated;
select tests.authenticate_as('78000000-0000-4000-8000-000000000001');

create temporary table equal_club as
select *
from public.create_club_v3(
  'Monthly Equal Club',
  'single_fund',
  '32000000-0000-4000-8000-000000000001',
  'simple_majority',
  'equal',
  '79000000-0000-4000-8000-000000000010',
  200000,
  null,
  'NOK'
);

create temporary table before_counts as
select
  (select count(*) from public.member_cycle_participations) as participations,
  (select count(*) from public.member_investment_day_reports) as reports,
  (select count(*) from public.member_investment_transactions) as transactions;

create temporary table equal_setup as
select *
from public.monthly_saving_setup_v1((select club_id from equal_club));

select extensions.is(
  (select status from equal_setup),
  'not_set_up',
  'Setup context is readable immediately after club create, before cycle freeze'
);

select extensions.is(
  (select provenance from equal_setup),
  'member_attested',
  'Setup provenance is member_attested, never broker_verified'
);

select extensions.is(
  (select fund_name from equal_setup),
  'DNB Global Indeks A',
  'Recommended fund is derived from the current single-fund strategy'
);

select extensions.is(
  (select isin from equal_setup),
  'NO0010582984',
  'Recommended ISIN is derived server-side'
);

select extensions.is(
  (select recommended_amount_minor from equal_setup),
  200000::bigint,
  'Recommended amount is the Equal policy amount, not a client-supplied value'
);

select extensions.is(
  (select currency from equal_setup),
  'NOK',
  'Recommended currency comes from the contribution policy'
);

select extensions.is(
  (select schedule_day_of_month from equal_setup),
  5::smallint,
  'Recommended schedule comes from the current Investment Day schedule'
);

select extensions.ok(
  (select recommended_investment_day_at from equal_setup) is not null,
  'Recommended Investment Day is present without waiting for roster freeze'
);

select extensions.is(
  (select monthly_setup_url from equal_setup),
  'https://www.nordnet.no/monthlysavings/create',
  'Monthly setup URL is the verified Nordnet HTTPS monthly savings page'
);

select extensions.is(
  (select one_time_product_url from equal_setup),
  'https://www.nordnet.no/fond/liste/dnb-global-indeks-a-nok-7b4b0894',
  'One-time URL is the verified Nordnet product page'
);

select extensions.ok(
  (select monthly_setup_url from equal_setup) not like '%200000%'
  and (select monthly_setup_url from equal_setup) not like '%2000%'
  and (select one_time_product_url from equal_setup) not like '%200000%',
  'Nordnet URLs do not include the member amount'
);

select extensions.ok(
  (select one_time_available from equal_setup),
  'One-time purchase remains available while monthly saving is not set up'
);

select extensions.ok(
  (select attested_at from equal_setup) is null
  and (select attested_amount_minor from equal_setup) is null,
  'Not-set-up state has no attestation details'
);

select extensions.is(
  tests.statement_message(
    format(
      $sql$
        select public.confirm_monthly_saving_setup_v1(%L::uuid, null)
      $sql$,
      (select club_id from equal_club)
    )
  ),
  'vesty.client_attestation_id_invalid',
  'Confirm requires a client attestation id'
);

create temporary table confirmed_setup as
select *
from public.confirm_monthly_saving_setup_v1(
  (select club_id from equal_club),
  '79000000-0000-4000-8000-000000000021'
);

select extensions.is(
  (select status from confirmed_setup),
  'current',
  'Confirming I have set it up stores a current member_attested setup'
);

select extensions.is(
  (select attested_amount_minor from confirmed_setup),
  200000::bigint,
  'Stored amount is the server-derived Equal amount'
);

select extensions.is(
  (
    select count(*)
    from public.member_monthly_saving_setup_attestations
    where club_id = (select club_id from equal_club)
  ),
  1::bigint,
  'First confirmation inserts exactly one attestation'
);

select extensions.is(
  (
    select attestation_kind
    from public.member_monthly_saving_setup_attestations
    where club_id = (select club_id from equal_club)
  ),
  'member_attested',
  'Stored attestation is member_attested'
);

select extensions.is(
  (
    select status
    from public.confirm_monthly_saving_setup_v1(
      (select club_id from equal_club),
      '79000000-0000-4000-8000-000000000021'
    )
  ),
  'current',
  'Retry with the same client id and derived context is idempotent'
);

select extensions.is(
  (
    select count(*)
    from public.member_monthly_saving_setup_attestations
    where club_id = (select club_id from equal_club)
  ),
  1::bigint,
  'Idempotent retry does not insert a duplicate attestation'
);

select extensions.is(
  (select count(*) from public.member_cycle_participations),
  (select participations from before_counts),
  'Confirm does not write cycle participation'
);

select extensions.is(
  (select count(*) from public.member_investment_day_reports),
  (select reports from before_counts),
  'Confirm does not write an Investment Day report'
);

select extensions.is(
  (select count(*) from public.member_investment_transactions),
  (select transactions from before_counts),
  'Confirm does not write a purchase'
);

reset role;
select private.create_contribution_policy_version_v1(
  (select club_id from equal_club),
  'equal'::public.contribution_policy_mode,
  350000::bigint,
  null,
  null
);

set local role authenticated;
select tests.authenticate_as('78000000-0000-4000-8000-000000000001');

select extensions.is(
  tests.statement_message(
    format(
      $sql$
        select public.confirm_monthly_saving_setup_v1(%L::uuid, '79000000-0000-4000-8000-000000000021'::uuid)
      $sql$,
      (select club_id from equal_club)
    )
  ),
  'vesty.monthly_saving_setup_conflict',
  'Same client id with a changed derived payload conflicts'
);

create temporary table amount_changed as
select *
from public.monthly_saving_setup_v1((select club_id from equal_club));

select extensions.is(
  (select status from amount_changed),
  'needs_update',
  'A changed member amount marks the setup as needs_update'
);

select extensions.ok(
  (select amount_changed from amount_changed)
  and not (select fund_changed from amount_changed)
  and not (select schedule_changed from amount_changed),
  'Amount change is reported without inventing fund or schedule changes'
);

select extensions.is(
  (select recommended_amount_minor from amount_changed),
  350000::bigint,
  'Recommended amount follows the new Equal policy version'
);

select extensions.is(
  (
    select status
    from public.confirm_monthly_saving_setup_v1(
      (select club_id from equal_club),
      '79000000-0000-4000-8000-000000000022'
    )
  ),
  'current',
  'A new client id can replace the attestation after the plan changes'
);

select extensions.is(
  (
    select count(*) filter (where status = 'replaced')
    from public.member_monthly_saving_setup_attestations
    where club_id = (select club_id from equal_club)
  ),
  1::bigint,
  'Replacing an attestation keeps the previous row as replaced'
);

reset role;
update public.investment_schedules as schedule
set
  status = 'replaced',
  effective_until = pg_catalog.now() + interval '1 second'
where schedule.club_id = (select club_id from equal_club)
  and schedule.status = 'active';

insert into public.investment_schedules (
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
values (
  (select club_id from equal_club),
  2,
  'active',
  12,
  'last_day_of_month',
  'Europe/Oslo',
  3,
  pg_catalog.now(),
  (select membership_id from equal_club)
);

set local role authenticated;
select tests.authenticate_as('78000000-0000-4000-8000-000000000001');

create temporary table schedule_changed as
select *
from public.monthly_saving_setup_v1((select club_id from equal_club));

select extensions.is(
  (select status from schedule_changed),
  'needs_update',
  'A changed Investment Day schedule marks the setup as needs_update'
);

select extensions.ok(
  (select schedule_changed from schedule_changed)
  and not (select amount_changed from schedule_changed)
  and not (select fund_changed from schedule_changed),
  'Schedule change is reported without inventing amount or fund changes'
);

select extensions.is(
  (select schedule_day_of_month from schedule_changed),
  12::smallint,
  'Recommended schedule day follows the new revision'
);

create temporary table schedule_confirmed as
select *
from public.confirm_monthly_saving_setup_v1(
  (select club_id from equal_club),
  '79000000-0000-4000-8000-000000000023'
);

reset role;
update public.strategy_allocations as allocation
set
  investment_target_id = '31000000-0000-4000-8000-000000000011',
  target_name = 'Vanguard FTSE All-World UCITS ETF - (USD) Acc',
  target_kind = 'etf',
  target_isin = 'IE00BK5BQT80',
  target_ticker = 'VWCE',
  target_exchange = 'Xetra'
where allocation.strategy_version_id = (select strategy_version_id from equal_club);

insert into private.single_fund_products (
  id,
  investment_target_id,
  legal_name,
  display_name,
  manager_name,
  short_description,
  risk_indicator,
  recommended_horizon,
  currency,
  status,
  display_order,
  allowed_investment_mode,
  checked_on
)
values (
  '32000000-0000-4000-8000-000000000099',
  '31000000-0000-4000-8000-000000000011',
  'Vanguard FTSE All-World UCITS ETF - (USD) Acc',
  'Vanguard FTSE All-World UCITS ETF - (USD) Acc',
  'Vanguard',
  'Global equity ETF used only in monthly saving tests',
  '5 of 7',
  'At least 5 years',
  'EUR',
  'active',
  99,
  'single_fund',
  '2026-09-08'
);

insert into private.single_fund_broker_listings (
  product_id,
  broker,
  is_verified,
  product_url,
  annual_cost_label,
  cost_source_label,
  cost_source_url,
  minimum_note
)
values (
  '32000000-0000-4000-8000-000000000099',
  'nordnet',
  true,
  'https://www.nordnet.no/etf/liste/vwce-test',
  'test cost',
  'test source',
  'https://www.nordnet.no/etf/liste/vwce-test',
  null
);

set local role authenticated;
select tests.authenticate_as('78000000-0000-4000-8000-000000000001');

create temporary table fund_changed as
select *
from public.monthly_saving_setup_v1((select club_id from equal_club));

select extensions.is(
  (select status from fund_changed),
  'needs_update',
  'A changed fund marks the setup as needs_update'
);

select extensions.ok(
  (select fund_changed from fund_changed)
  and not (select amount_changed from fund_changed)
  and not (select schedule_changed from fund_changed),
  'Fund change is reported without inventing amount or schedule changes'
);

select extensions.is(
  (select fund_name from fund_changed),
  'Vanguard FTSE All-World UCITS ETF - (USD) Acc',
  'Recommended fund name follows the current strategy allocation'
);

select tests.authenticate_as('78000000-0000-4000-8000-000000000001');

create temporary table equal_invite as
select *
from public.create_club_invitation((select club_id from equal_club));

select tests.authenticate_as('78000000-0000-4000-8000-000000000002');

create temporary table equal_join as
select *
from public.accept_club_invitation((select invite_token from equal_invite));

create temporary table member_view as
select *
from public.monthly_saving_setup_v1((select club_id from equal_club));

select extensions.is(
  (select status from member_view),
  'not_set_up',
  'Another member does not inherit the owner attestation'
);

select extensions.ok(
  (select attested_at from member_view) is null,
  'Another member never sees the owner attestation timestamp'
);

select extensions.is(
  (
    select count(*)
    from public.member_monthly_saving_setup_attestations
  ),
  0::bigint,
  'Another member cannot read the owner monthly saving rows'
);

select tests.authenticate_as('78000000-0000-4000-8000-000000000003');

select extensions.is(
  tests.statement_message(
    format(
      $sql$
        select public.monthly_saving_setup_v1(%L::uuid)
      $sql$,
      (select club_id from equal_club)
    )
  ),
  'vesty.not_club_member',
  'Outsiders cannot read monthly saving setup'
);

select extensions.is(
  tests.statement_message(
    format(
      $sql$
        select public.confirm_monthly_saving_setup_v1(%L::uuid, '79000000-0000-4000-8000-000000000099'::uuid)
      $sql$,
      (select club_id from equal_club)
    )
  ),
  'vesty.not_club_member',
  'Outsiders cannot confirm monthly saving setup'
);

select tests.authenticate_as('78000000-0000-4000-8000-000000000001');

create temporary table flexible_club as
select *
from public.create_club_v3(
  'Monthly Flexible Club',
  'single_fund',
  '32000000-0000-4000-8000-000000000001',
  'simple_majority',
  'flexible',
  '79000000-0000-4000-8000-000000000011',
  null,
  175000,
  'NOK'
);

create temporary table flexible_invite as
select *
from public.create_club_invitation((select club_id from flexible_club));

select tests.authenticate_as('78000000-0000-4000-8000-000000000002');

create temporary table flexible_join as
select *
from public.accept_club_invitation((select invite_token from flexible_invite));

create temporary table flexible_joiner as
select *
from public.monthly_saving_setup_v1((select club_id from flexible_club));

select extensions.is(
  (select status from flexible_joiner),
  'setup_required',
  'Flexible without a valid member amount is setup_required before freeze'
);

select extensions.ok(
  (select recommended_amount_minor from flexible_joiner) is null,
  'Flexible without a commitment does not invent an amount'
);

select extensions.is(
  tests.statement_message(
    format(
      $sql$
        select public.confirm_monthly_saving_setup_v1(%L::uuid, '79000000-0000-4000-8000-000000000031'::uuid)
      $sql$,
      (select club_id from flexible_club)
    )
  ),
  'vesty.monthly_saving_setup_required',
  'Flexible members cannot attest a setup until they have an amount'
);

select tests.authenticate_as('78000000-0000-4000-8000-000000000001');

create temporary table owner_flexible as
select *
from public.monthly_saving_setup_v1((select club_id from flexible_club));

select extensions.is(
  (select status from owner_flexible),
  'not_set_up',
  'Flexible creator with a private amount can set up monthly saving'
);

select extensions.is(
  (select recommended_amount_minor from owner_flexible),
  175000::bigint,
  'Flexible recommended amount is the caller''s private commitment, not another member''s'
);

create temporary table flexible_confirmed as
select *
from public.confirm_monthly_saving_setup_v1(
  (select club_id from flexible_club),
  '79000000-0000-4000-8000-000000000032'
);

create temporary table flexible_new_amount as
select *
from public.create_member_contribution_commitment_v1(
  (select club_id from flexible_club),
  225000
);

create temporary table flexible_amount_changed as
select *
from public.monthly_saving_setup_v1((select club_id from flexible_club));

select extensions.is(
  (select status from flexible_amount_changed),
  'needs_update',
  'A changed Flexible commitment marks the setup as needs_update'
);

select tests.authenticate_as('78000000-0000-4000-8000-000000000001');

create temporary table history_club as
select *
from public.create_club_v3(
  'Monthly History Club',
  'single_fund',
  '32000000-0000-4000-8000-000000000001',
  'simple_majority',
  'equal',
  '79000000-0000-4000-8000-000000000012',
  200000,
  null,
  'NOK'
);

create temporary table history_confirmed as
select *
from public.confirm_monthly_saving_setup_v1(
  (select club_id from history_club),
  '79000000-0000-4000-8000-000000000033'
);

create temporary table frozen_day as
select *
from tests.open_investment_day_v1((select club_id from history_club));

create temporary table after_freeze as
select
  (select count(*) from public.member_cycle_participations) as participations,
  (select count(*) from public.member_investment_day_reports) as reports;

select extensions.ok(
  (select participation_id from frozen_day) is not null,
  'Equal club can still freeze an Investment Day after monthly saving attestations'
);

create temporary table ended_setup as
select *
from public.end_monthly_saving_setup_v1((select club_id from history_club));

select extensions.is(
  (
    select status
    from public.monthly_saving_setup_v1((select club_id from history_club))
  ),
  'not_set_up',
  'Ending the attestation returns the caller to not_set_up'
);

select extensions.ok(
  exists (
    select 1
    from public.member_monthly_saving_setup_attestations
    where club_id = (select club_id from history_club)
      and status = 'ended'
  ),
  'Ended attestations are kept rather than deleted'
);

select extensions.is(
  (select count(*) from public.member_cycle_participations),
  (select participations from after_freeze),
  'Ending monthly saving does not delete Investment Day participations'
);

select extensions.is(
  (select count(*) from public.member_investment_day_reports),
  (select reports from after_freeze),
  'Ending monthly saving does not delete Investment Day reports'
);

select extensions.is(
  tests.statement_message(
    $sql$
      insert into public.member_monthly_saving_setup_attestations (
        club_id,
        membership_id,
        broker,
        investment_target_id,
        attested_amount_minor,
        currency,
        strategy_version_id,
        contribution_policy_version_id,
        investment_schedule_id,
        schedule_revision_number,
        schedule_day_of_month,
        schedule_timezone,
        schedule_missing_day_policy,
        context_fingerprint,
        client_attestation_id
      )
      values (
        '78000000-0000-4000-8000-000000000099',
        '78000000-0000-4000-8000-000000000099',
        'nordnet',
        '31000000-0000-4000-8000-000000000021',
        200000,
        'NOK',
        '78000000-0000-4000-8000-000000000099',
        '78000000-0000-4000-8000-000000000099',
        '78000000-0000-4000-8000-000000000099',
        1,
        5,
        'Europe/Oslo',
        'last_day_of_month',
        repeat('a', 64),
        '79000000-0000-4000-8000-000000000040'
      )
    $sql$
  ) is not null,
  true,
  'Direct attestation inserts by authenticated clients are rejected'
);

select extensions.finish();

rollback;
