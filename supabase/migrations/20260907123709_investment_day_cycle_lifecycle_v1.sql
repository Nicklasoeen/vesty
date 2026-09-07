-- F03/F04: server-owned Investment Day calendar, atomic roster freeze,
-- reporting-window enforcement, and snapshot-based social history.
-- Existing confirm/report meaning, provenance, and privacy are unchanged.

-- ---------------------------------------------------------------------------
-- Roster freeze marker. Existing cycles are frozen as stored; members are
-- not reconstructed from the live club list.
-- ---------------------------------------------------------------------------

alter table public.investment_cycles
  add column roster_frozen_at timestamptz;

update public.investment_cycles
set roster_frozen_at = coalesce(opened_at, created_at, pg_catalog.now())
where roster_frozen_at is null;

create index investment_cycles_club_reporting_window_idx
  on public.investment_cycles (club_id, reporting_opens_at, reporting_closes_at);

comment on column public.investment_cycles.roster_frozen_at is
  'When the cycle strategy, policy, eligible memberships, and expected amounts were frozen. Null only for generated upcoming cycles that have not reached the configuration deadline.';

create or replace function private.prevent_cycle_policy_rewrite()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if old.roster_frozen_at is not null and new.roster_frozen_at is null then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.cycle_roster_frozen';
  end if;

  if old.roster_frozen_at is not null
    and old.contribution_policy_version_id is distinct from new.contribution_policy_version_id
  then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.cycle_policy_frozen';
  end if;

  if old.roster_frozen_at is not null
    and old.strategy_version_id is distinct from new.strategy_version_id
  then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.cycle_strategy_frozen';
  end if;

  return new;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Calendar helpers
-- ---------------------------------------------------------------------------

create function private.investment_occurrence_at_v1(
  p_year integer,
  p_month integer,
  p_day_of_month integer,
  p_missing_day_policy text,
  p_timezone text
)
returns timestamptz
language plpgsql
immutable
security definer
set search_path = ''
as $function$
declare
  v_month_start date;
  v_last_day integer;
  v_day integer;
  v_local timestamp;
begin
  if p_year is null or p_month is null or p_day_of_month is null or p_timezone is null then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.schedule_invalid';
  end if;

  v_month_start := pg_catalog.make_date(p_year, p_month, 1);
  v_last_day := pg_catalog.date_part('day', v_month_start + interval '1 month - 1 day')::integer;
  v_day := case
    when p_missing_day_policy = 'last_day_of_month' then least(p_day_of_month, v_last_day)
    else p_day_of_month
  end;

  if v_day < 1 or v_day > v_last_day then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.schedule_invalid';
  end if;

  v_local := pg_catalog.make_timestamp(p_year, p_month, v_day, 12, 0, 0);
  return v_local at time zone p_timezone;
end;
$function$;

create function private.investment_occurrence_key_v1(
  p_investment_day_at timestamptz,
  p_timezone text
)
returns text
language sql
immutable
security definer
set search_path = ''
as $function$
  select pg_catalog.to_char((p_investment_day_at at time zone p_timezone)::date, 'YYYY-MM-DD');
$function$;

create function private.resolve_member_expected_contribution_at_v1(
  p_policy_id uuid,
  p_membership_id uuid,
  p_as_of timestamptz
)
returns bigint
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $function$
declare
  v_policy public.contribution_policy_versions%rowtype;
  v_amount bigint;
begin
  if p_policy_id is null or p_membership_id is null or p_as_of is null then
    return null;
  end if;

  select *
  into v_policy
  from public.contribution_policy_versions as policy
  where policy.id = p_policy_id;

  if not found then
    return null;
  end if;

  if v_policy.mode = 'equal' then
    return v_policy.equal_amount_minor;
  end if;

  select commitment.amount_minor
  into v_amount
  from public.member_contribution_commitment_versions as commitment
  where commitment.membership_id = p_membership_id
    and commitment.club_id = v_policy.club_id
    and commitment.created_at <= p_as_of
  order by commitment.version_number desc
  limit 1;

  return v_amount;
end;
$function$;

create or replace function private.latest_contribution_policy_version_id_v1(p_club_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
set row_security = off
as $function$
  select policy.id
  from public.contribution_policy_versions as policy
  where policy.club_id = p_club_id
  order by policy.version_number desc
  limit 1;
$function$;

create function private.ensure_club_investment_schedule_v1(p_club_id uuid)
returns public.investment_schedules
language plpgsql
volatile
security definer
set search_path = ''
set row_security = off
as $function$
declare
  v_schedule public.investment_schedules%rowtype;
  v_owner uuid;
begin
  select *
  into v_schedule
  from public.investment_schedules as schedule
  where schedule.club_id = p_club_id
    and schedule.status in ('active', 'paused')
  order by schedule.revision_number desc
  limit 1;

  if found then
    return v_schedule;
  end if;

  select club.current_owner_membership_id
  into v_owner
  from public.clubs as club
  where club.id = p_club_id
    and club.status = 'active';

  if v_owner is null then
    return null;
  end if;

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
    p_club_id,
    1,
    'active',
    5,
    'last_day_of_month',
    'Europe/Oslo',
    3,
    pg_catalog.now(),
    v_owner
  )
  returning * into v_schedule;

  return v_schedule;
end;
$function$;

create or replace function private.ensure_legacy_saving_plan_for_amount_v1(
  p_club_id uuid,
  p_membership_id uuid,
  p_amount_minor bigint,
  p_currency text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
set row_security = off
as $function$
declare
  v_plan public.member_saving_plans%rowtype;
begin
  if p_club_id is null or p_membership_id is null or p_amount_minor is null or p_amount_minor <= 0 then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.contribution_commitment_invalid';
  end if;

  select *
  into v_plan
  from public.member_saving_plans as plan
  where plan.membership_id = p_membership_id
    and plan.club_id = p_club_id
    and plan.status = 'active'
  order by plan.active_from desc
  limit 1;

  if v_plan.id is not null then
    return v_plan.id;
  end if;

  insert into public.member_saving_plans (
    club_id,
    membership_id,
    amount_minor,
    currency,
    status,
    active_from
  )
  values (
    p_club_id,
    p_membership_id,
    p_amount_minor,
    p_currency,
    'active',
    pg_catalog.now()
  )
  returning id into v_plan.id;

  return v_plan.id;
end;
$function$;

create function private.freeze_investment_cycle_roster_v1(
  p_cycle_id uuid,
  p_now timestamptz
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
set row_security = off
as $function$
declare
  v_cycle public.investment_cycles%rowtype;
  v_club public.clubs%rowtype;
  v_strategy_id uuid;
  v_policy_id uuid;
begin
  select *
  into v_cycle
  from public.investment_cycles as cycle
  where cycle.id = p_cycle_id
  for update;

  if not found then
    return;
  end if;

  if v_cycle.roster_frozen_at is not null then
    return;
  end if;

  if p_now < v_cycle.configuration_deadline_at then
    return;
  end if;

  select *
  into v_club
  from public.clubs as club
  where club.id = v_cycle.club_id;

  select version.id
  into v_strategy_id
  from public.strategy_versions as version
  where version.club_id = v_cycle.club_id
  order by version.version_number desc
  limit 1;

  v_policy_id := private.latest_contribution_policy_version_id_v1(v_cycle.club_id);

  if v_strategy_id is null or v_policy_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.strategy_missing';
  end if;

  update public.investment_cycles as cycle
  set
    strategy_version_id = v_strategy_id,
    contribution_policy_version_id = v_policy_id
  where cycle.id = v_cycle.id
    and cycle.roster_frozen_at is null;

  select *
  into v_cycle
  from public.investment_cycles as cycle
  where cycle.id = p_cycle_id;

  insert into public.member_cycle_participations (
    club_id,
    investment_cycle_id,
    membership_id,
    saving_plan_id,
    expected_amount_minor,
    currency,
    created_at
  )
  select
    v_cycle.club_id,
    v_cycle.id,
    eligible.membership_id,
    private.ensure_legacy_saving_plan_for_amount_v1(
      v_cycle.club_id,
      eligible.membership_id,
      eligible.expected_amount_minor,
      v_club.base_currency
    ),
    eligible.expected_amount_minor,
    v_club.base_currency,
    v_cycle.configuration_deadline_at
  from (
    select
      membership.id as membership_id,
      private.resolve_member_expected_contribution_at_v1(
        v_cycle.contribution_policy_version_id,
        membership.id,
        v_cycle.configuration_deadline_at
      ) as expected_amount_minor
    from public.club_memberships as membership
    where membership.club_id = v_cycle.club_id
      and membership.joined_at <= v_cycle.configuration_deadline_at
      and (
        membership.ended_at is null
        or membership.ended_at > v_cycle.configuration_deadline_at
      )
  ) as eligible
  where eligible.expected_amount_minor is not null
    and eligible.expected_amount_minor > 0
  on conflict on constraint member_cycle_participations_cycle_membership_key do nothing;

  update public.investment_cycles as cycle
  set roster_frozen_at = p_now
  where cycle.id = v_cycle.id
    and cycle.roster_frozen_at is null;
end;
$function$;

create function private.advance_club_investment_cycles_v1(
  p_club_id uuid,
  p_now timestamptz
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
set row_security = off
as $function$
declare
  v_now timestamptz := coalesce(p_now, pg_catalog.now());
  v_club public.clubs%rowtype;
  v_schedule public.investment_schedules%rowtype;
  v_strategy_id uuid;
  v_policy_id uuid;
  v_local timestamp;
  v_month timestamp;
  v_end timestamp;
  v_year integer;
  v_month_no integer;
  v_investment_day timestamptz;
  v_deadline timestamptz;
  v_opens timestamptz;
  v_closes timestamptz;
  v_key text;
  v_cycle public.investment_cycles%rowtype;
  v_lead interval;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_club_id::text, 17)
  );

  select *
  into v_club
  from public.clubs as club
  where club.id = p_club_id
    and club.status = 'active';

  if not found then
    return;
  end if;

  v_schedule := private.ensure_club_investment_schedule_v1(p_club_id);
  if v_schedule.id is null then
    return;
  end if;

  select version.id
  into v_strategy_id
  from public.strategy_versions as version
  where version.club_id = p_club_id
  order by version.version_number desc
  limit 1;

  v_policy_id := private.latest_contribution_policy_version_id_v1(p_club_id);

  if v_strategy_id is null or v_policy_id is null then
    return;
  end if;

  if v_schedule.status = 'active' then
    v_local := v_now at time zone v_schedule.timezone;
    v_month := pg_catalog.date_trunc('month', v_local) - interval '2 months';
    v_end := pg_catalog.date_trunc('month', v_local) + interval '2 months';
    v_lead := pg_catalog.make_interval(days => greatest(v_schedule.configuration_lead_days, 0));

    while v_month <= v_end loop
      v_year := pg_catalog.date_part('year', v_month)::integer;
      v_month_no := pg_catalog.date_part('month', v_month)::integer;
      v_investment_day := private.investment_occurrence_at_v1(
        v_year,
        v_month_no,
        v_schedule.day_of_month,
        v_schedule.missing_day_policy,
        v_schedule.timezone
      );
      v_key := private.investment_occurrence_key_v1(v_investment_day, v_schedule.timezone);
      v_opens := v_investment_day;
      v_closes := v_investment_day + interval '7 days';
      if v_lead = interval '0' then
        v_deadline := v_investment_day - interval '1 second';
      else
        v_deadline := v_investment_day - v_lead;
      end if;

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
      values (
        p_club_id,
        v_schedule.id,
        v_strategy_id,
        v_policy_id,
        v_key,
        v_investment_day,
        v_deadline,
        v_opens,
        v_closes,
        v_schedule.timezone,
        'upcoming'
      )
      on conflict on constraint investment_cycles_club_occurrence_key do nothing;

      v_month := v_month + interval '1 month';
    end loop;
  end if;

  for v_cycle in
    select *
    from public.investment_cycles as cycle
    where cycle.club_id = p_club_id
      and cycle.status <> 'cancelled'
    order by cycle.investment_day_at
    for update
  loop
    perform private.freeze_investment_cycle_roster_v1(v_cycle.id, v_now);

    select *
    into v_cycle
    from public.investment_cycles as cycle
    where cycle.id = v_cycle.id;

    if v_cycle.status = 'upcoming'
      and v_cycle.roster_frozen_at is not null
      and v_now >= v_cycle.reporting_opens_at
      and v_now < v_cycle.reporting_closes_at
    then
      update public.investment_cycles as cycle
      set
        status = 'open',
        opened_at = v_cycle.reporting_opens_at
      where cycle.id = v_cycle.id
        and cycle.status = 'upcoming';
    elsif v_cycle.status = 'upcoming'
      and v_now >= v_cycle.reporting_closes_at
    then
      perform private.freeze_investment_cycle_roster_v1(v_cycle.id, v_now);
      update public.investment_cycles as cycle
      set
        status = 'completed',
        opened_at = cycle.reporting_opens_at,
        closed_at = cycle.reporting_closes_at
      where cycle.id = v_cycle.id
        and cycle.status = 'upcoming';
    elsif v_cycle.status = 'open'
      and v_now >= v_cycle.reporting_closes_at
    then
      update public.investment_cycles as cycle
      set
        status = 'completed',
        closed_at = v_cycle.reporting_closes_at
      where cycle.id = v_cycle.id
        and cycle.status = 'open';
    end if;
  end loop;
end;
$function$;

create function private.advance_investment_cycles_v1(
  p_now timestamptz default pg_catalog.now(),
  p_club_id uuid default null
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
set row_security = off
as $function$
declare
  v_now timestamptz := coalesce(p_now, pg_catalog.now());
  v_count integer := 0;
  v_club uuid;
begin
  if p_club_id is not null then
    perform private.advance_club_investment_cycles_v1(p_club_id, v_now);
    return 1;
  end if;

  for v_club in
    select club.id
    from public.clubs as club
    where club.status = 'active'
  loop
    perform private.advance_club_investment_cycles_v1(v_club, v_now);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$function$;

create function public.advance_investment_cycles_v1(
  p_now timestamptz default pg_catalog.now(),
  p_club_id uuid default null
)
returns integer
language sql
volatile
security definer
set search_path = ''
set row_security = off
as $function$
  select private.advance_investment_cycles_v1(p_now, p_club_id);
$function$;

comment on function public.advance_investment_cycles_v1(timestamptz, uuid) is
  'Trusted Investment Day lifecycle. Authenticated clients have no EXECUTE. A delayed run never reopens an elapsed reporting window.';

-- ---------------------------------------------------------------------------
-- Reporting window. Idempotent retries still return the stored report.
-- ---------------------------------------------------------------------------

create function private.report_investment_day_at_v1(
  p_club_id uuid,
  p_cycle_id uuid,
  p_client_report_id uuid,
  p_report_mode public.investment_day_report_mode,
  p_outcome public.participation_outcome,
  p_purchase_lines jsonb,
  p_now timestamptz
)
returns table (
  club_id uuid,
  club_name text,
  membership_id uuid,
  cycle_id uuid,
  investment_day_at timestamptz,
  cycle_status public.investment_cycle_status,
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
declare
  v_user_id uuid;
  v_membership public.club_memberships%rowtype;
  v_club public.clubs%rowtype;
  v_cycle public.investment_cycles%rowtype;
  v_participation public.member_cycle_participations%rowtype;
  v_existing public.member_investment_day_reports%rowtype;
  v_strategy_lines jsonb;
  v_planned jsonb;
  v_normalized jsonb;
  v_final_lines jsonb;
  v_fingerprint text;
  v_report_id uuid;
  v_now timestamptz := coalesce(p_now, pg_catalog.now());
  v_provenance public.investment_amount_provenance;
begin
  v_user_id := private.require_authenticated_profile_id();

  if p_client_report_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.client_report_id_invalid';
  end if;

  if p_report_mode is null then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.report_mode_invalid';
  end if;

  if p_outcome is null or p_outcome not in ('confirmed', 'skipped', 'failed') then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.outcome_invalid';
  end if;

  if p_report_mode = 'as_planned' and p_outcome <> 'confirmed' then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.report_mode_invalid';
  end if;

  select *
  into v_club
  from public.clubs as club
  where club.id = p_club_id;

  if not found or v_club.status <> 'active' then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.not_club_member';
  end if;

  select *
  into v_membership
  from public.club_memberships as membership
  where membership.club_id = p_club_id
    and membership.profile_id = v_user_id
    and membership.status = 'active';

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.not_club_member';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_membership.id::text || p_cycle_id::text, 0)
  );

  select *
  into v_cycle
  from public.investment_cycles as cycle
  where cycle.id = p_cycle_id
    and cycle.club_id = p_club_id;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.cycle_invalid';
  end if;

  select *
  into v_participation
  from public.member_cycle_participations as participation
  where participation.investment_cycle_id = p_cycle_id
    and participation.membership_id = v_membership.id
    and participation.club_id = p_club_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.cycle_invalid';
  end if;

  if v_participation.expected_amount_minor <= 0
    or v_participation.currency is null
    or v_participation.currency !~ '^[A-Z]{3}$'
    or v_participation.currency <> v_club.base_currency
  then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.amount_invalid';
  end if;

  select *
  into v_existing
  from public.member_investment_day_reports as report
  where report.membership_id = v_membership.id
    and report.investment_cycle_id = p_cycle_id
  for update;

  select pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'investment_target_id', allocation.investment_target_id,
      'allocation_bps', allocation.allocation_bps,
      'position', allocation.position
    )
    order by allocation.position
  )
  into v_strategy_lines
  from public.strategy_allocations as allocation
  where allocation.strategy_version_id = v_cycle.strategy_version_id;

  if v_strategy_lines is null then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.strategy_missing';
  end if;

  select pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'investment_target_id', allocated.investment_target_id,
      'amount_minor', allocated.amount_minor,
      'instrument_currency', target.currency
    )
    order by allocated.investment_target_id
  )
  into v_planned
  from private.allocate_minor_by_bps(
    v_participation.expected_amount_minor,
    v_strategy_lines
  ) as allocated
  join public.investment_targets as target
    on target.id = allocated.investment_target_id;

  v_normalized := private.normalize_report_purchase_lines_v1(
    p_report_mode,
    coalesce(p_purchase_lines, '[]'::jsonb),
    v_planned
  );
  v_final_lines := private.compose_report_lines_v1(
    p_report_mode,
    p_outcome,
    v_normalized,
    v_planned
  );
  v_fingerprint := private.investment_day_report_fingerprint_v1(
    p_report_mode,
    p_outcome,
    v_final_lines
  );

  if v_existing.id is not null then
    if v_existing.client_report_id = p_client_report_id
      and v_existing.payload_fingerprint = v_fingerprint
    then
      return query
      select *
      from private.investment_day_plan_v1(p_club_id, v_membership.id, p_cycle_id);
      return;
    end if;

    raise exception using
      errcode = 'P0001',
      message = 'vesty.report_conflict';
  end if;

  if v_participation.outcome <> 'expected' then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.report_conflict';
  end if;

  if v_now < v_cycle.reporting_opens_at then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.reporting_not_open';
  end if;

  if v_now >= v_cycle.reporting_closes_at then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.reporting_closed';
  end if;

  if v_cycle.status <> 'open' then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.cycle_not_open';
  end if;

  v_provenance := case
    when p_report_mode = 'as_planned' then 'member_attested_plan'::public.investment_amount_provenance
    else 'member_reported_actual'::public.investment_amount_provenance
  end;

  insert into public.member_investment_day_reports (
    club_id,
    membership_id,
    investment_cycle_id,
    client_report_id,
    report_mode,
    outcome,
    payload_fingerprint
  )
  values (
    p_club_id,
    v_membership.id,
    p_cycle_id,
    p_client_report_id,
    p_report_mode,
    p_outcome,
    v_fingerprint
  )
  returning id into v_report_id;

  if p_outcome = 'confirmed' then
    insert into public.member_investment_transactions (
      club_id,
      membership_id,
      investment_cycle_id,
      investment_target_id,
      transaction_type,
      amount_minor,
      currency,
      quantity,
      unit_price_minor,
      execution_unit_price,
      execution_unit_price_currency,
      executed_at,
      reported_at,
      source,
      verification_status,
      report_id,
      amount_provenance
    )
    select
      p_club_id,
      v_membership.id,
      p_cycle_id,
      (line.value->>'investment_target_id')::uuid,
      'buy',
      (line.value->>'amount_minor')::bigint,
      v_club.base_currency,
      (line.value->>'quantity')::numeric,
      null,
      (line.value->>'execution_unit_price')::numeric,
      line.value->>'execution_unit_price_currency',
      v_now,
      v_now,
      'manual',
      'member_reported',
      v_report_id,
      v_provenance
    from pg_catalog.jsonb_array_elements(v_final_lines) as line(value);
  end if;

  update public.member_cycle_participations as participation
  set
    outcome = p_outcome,
    report_source = 'member_reported',
    reported_at = v_now
  where participation.id = v_participation.id
    and participation.outcome = 'expected';

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.report_conflict';
  end if;

  return query
  select *
  from private.investment_day_plan_v1(p_club_id, v_membership.id, p_cycle_id);
end;
$function$;

create or replace function private.report_investment_day_v1(
  p_club_id uuid,
  p_cycle_id uuid,
  p_client_report_id uuid,
  p_report_mode public.investment_day_report_mode,
  p_outcome public.participation_outcome,
  p_purchase_lines jsonb
)
returns table (
  club_id uuid,
  club_name text,
  membership_id uuid,
  cycle_id uuid,
  investment_day_at timestamptz,
  cycle_status public.investment_cycle_status,
  participation_id uuid,
  participation_outcome public.participation_outcome,
  expected_amount_minor bigint,
  currency text,
  allocations jsonb,
  transactions jsonb
)
language sql
volatile
security definer
set search_path = ''
set row_security = off
as $function$
  select *
  from private.report_investment_day_at_v1(
    p_club_id,
    p_cycle_id,
    p_client_report_id,
    p_report_mode,
    p_outcome,
    p_purchase_lines,
    pg_catalog.now()
  );
$function$;

-- ---------------------------------------------------------------------------
-- Read-only current Investment Day projection
-- ---------------------------------------------------------------------------

create function private.current_investment_day_v1(
  p_club_id uuid,
  p_now timestamptz default pg_catalog.now()
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
stable
security definer
set search_path = ''
set row_security = off
as $function$
declare
  v_now timestamptz := coalesce(p_now, pg_catalog.now());
  v_user_id uuid;
  v_membership public.club_memberships%rowtype;
  v_club public.clubs%rowtype;
  v_cycle public.investment_cycles%rowtype;
  v_participation public.member_cycle_participations%rowtype;
  v_policy public.contribution_policy_versions%rowtype;
  v_state text;
  v_allowed boolean := false;
  v_plan record;
begin
  v_user_id := private.require_authenticated_profile_id();

  select *
  into v_club
  from public.clubs as club
  where club.id = p_club_id;

  if not found or v_club.status <> 'active' then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.not_club_member';
  end if;

  select *
  into v_membership
  from public.club_memberships as membership
  where membership.club_id = p_club_id
    and membership.profile_id = v_user_id
    and membership.status = 'active';

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.not_club_member';
  end if;

  select *
  into v_cycle
  from public.investment_cycles as cycle
  where cycle.club_id = p_club_id
    and cycle.status <> 'cancelled'
    and cycle.reporting_opens_at <= v_now
    and v_now < cycle.reporting_closes_at
  order by cycle.investment_day_at desc, cycle.id desc
  limit 1;

  if v_cycle.id is null then
    select *
    into v_cycle
    from public.investment_cycles as cycle
    where cycle.club_id = p_club_id
      and cycle.status <> 'cancelled'
      and v_now < cycle.reporting_opens_at
    order by cycle.reporting_opens_at, cycle.id
    limit 1;
  end if;

  if v_cycle.id is null then
    select *
    into v_cycle
    from public.investment_cycles as cycle
    where cycle.club_id = p_club_id
      and cycle.status <> 'cancelled'
      and cycle.reporting_closes_at <= v_now
    order by cycle.investment_day_at desc, cycle.id desc
    limit 1;
  end if;

  if v_cycle.id is null then
    club_id := v_club.id;
    club_name := v_club.name;
    membership_id := v_membership.id;
    viewer_state := 'missing';
    reporting_allowed := false;
    allocations := '[]'::jsonb;
    transactions := '[]'::jsonb;
    return next;
    return;
  end if;

  select *
  into v_participation
  from public.member_cycle_participations as participation
  where participation.investment_cycle_id = v_cycle.id
    and participation.membership_id = v_membership.id;

  select *
  into v_policy
  from public.contribution_policy_versions as policy
  where policy.id = v_cycle.contribution_policy_version_id;

  if v_cycle.status = 'completed' or v_now >= v_cycle.reporting_closes_at then
    v_state := 'closed';
  elsif v_now < v_cycle.reporting_opens_at then
    v_state := 'upcoming';
  elsif v_cycle.status = 'open' then
    v_state := 'open';
    v_allowed := true;
  else
    v_state := 'unavailable';
  end if;

  if v_participation.id is null then
    v_allowed := false;
    if v_cycle.roster_frozen_at is null
      and v_policy.mode = 'flexible'
      and private.resolve_member_expected_contribution_at_v1(
        v_cycle.contribution_policy_version_id,
        v_membership.id,
        v_now
      ) is null
    then
      v_state := 'setup_required';
    elsif v_cycle.roster_frozen_at is not null
      and v_policy.mode = 'flexible'
      and v_membership.joined_at <= v_cycle.configuration_deadline_at
    then
      v_state := 'setup_next';
    elsif v_cycle.roster_frozen_at is not null then
      v_state := 'not_in_snapshot';
    end if;
  elsif v_state = 'open' and v_participation.outcome <> 'expected' then
    v_allowed := false;
  end if;

  if v_participation.id is not null then
    select *
    into v_plan
    from private.investment_day_plan_v1(p_club_id, v_membership.id, v_cycle.id);

    club_id := v_plan.club_id;
    club_name := v_plan.club_name;
    membership_id := v_plan.membership_id;
    cycle_id := v_plan.cycle_id;
    investment_day_at := v_plan.investment_day_at;
    reporting_opens_at := v_cycle.reporting_opens_at;
    reporting_closes_at := v_cycle.reporting_closes_at;
    cycle_status := v_plan.cycle_status;
    viewer_state := v_state;
    reporting_allowed := v_allowed;
    participation_id := v_plan.participation_id;
    participation_outcome := v_plan.participation_outcome;
    expected_amount_minor := v_plan.expected_amount_minor;
    currency := v_plan.currency;
    allocations := v_plan.allocations;
    transactions := v_plan.transactions;
    return next;
    return;
  end if;

  club_id := v_club.id;
  club_name := v_club.name;
  membership_id := v_membership.id;
  cycle_id := v_cycle.id;
  investment_day_at := v_cycle.investment_day_at;
  reporting_opens_at := v_cycle.reporting_opens_at;
  reporting_closes_at := v_cycle.reporting_closes_at;
  cycle_status := v_cycle.status;
  viewer_state := v_state;
  reporting_allowed := false;
  allocations := '[]'::jsonb;
  transactions := '[]'::jsonb;
  return next;
end;
$function$;

create function public.current_investment_day_v1(p_club_id uuid)
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
language sql
stable
security definer
set search_path = ''
set row_security = off
as $function$
  select *
  from private.current_investment_day_v1(p_club_id, pg_catalog.now());
$function$;

comment on function public.current_investment_day_v1(uuid) is
  'Authenticated read of the current or next Investment Day. Never creates cycles, freezes policy, or writes participations.';

-- ---------------------------------------------------------------------------
-- Social history from frozen participations
-- ---------------------------------------------------------------------------

create or replace function private.member_investment_day_streak_v1(
  p_club_id uuid,
  p_membership_id uuid,
  p_now timestamptz default pg_catalog.now()
)
returns integer
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $function$
declare
  v_streak integer := 0;
  v_row record;
begin
  for v_row in
    select
      cycle.id,
      cycle.status,
      cycle.reporting_closes_at,
      private.member_completed_investment_cycle_v1(p_membership_id, cycle.id) as completed
    from public.investment_cycles as cycle
    join public.club_memberships as membership
      on membership.id = p_membership_id
     and membership.club_id = cycle.club_id
    where cycle.club_id = p_club_id
      and cycle.status not in ('upcoming', 'cancelled')
      and cycle.investment_day_at <= p_now
      and cycle.investment_day_at >= membership.joined_at
      and (membership.ended_at is null or cycle.investment_day_at < membership.ended_at)
    order by cycle.investment_day_at desc, cycle.id desc
  loop
    if v_row.completed then
      v_streak := v_streak + 1;
    elsif v_row.status = 'open' and v_row.reporting_closes_at >= p_now then
      continue;
    else
      exit;
    end if;
  end loop;

  return v_streak;
end;
$function$;

create function private.club_investment_day_participation_at_v1(
  p_club_id uuid,
  p_cycle_id uuid,
  p_now timestamptz
)
returns table (
  membership_id uuid,
  profile_id uuid,
  display_name text,
  avatar_path text,
  cycle_id uuid,
  completed boolean,
  completed_at timestamptz,
  verification_level text,
  current_streak integer,
  member_count integer,
  completed_count integer,
  pending_count integer,
  all_completed boolean
)
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $function$
declare
  v_now timestamptz := coalesce(p_now, pg_catalog.now());
  v_cycle public.investment_cycles%rowtype;
  v_member_count integer;
  v_completed_count integer;
begin
  if p_club_id is null or p_cycle_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.cycle_invalid';
  end if;

  if not private.is_active_club_member(p_club_id) then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.not_club_member';
  end if;

  select *
  into v_cycle
  from public.investment_cycles as cycle
  where cycle.id = p_cycle_id
    and cycle.club_id = p_club_id;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.cycle_invalid';
  end if;

  select pg_catalog.count(*)
  into v_member_count
  from public.member_cycle_participations as participation
  where participation.investment_cycle_id = p_cycle_id
    and participation.club_id = p_club_id;

  select pg_catalog.count(*)
  into v_completed_count
  from public.member_cycle_participations as participation
  where participation.investment_cycle_id = p_cycle_id
    and participation.club_id = p_club_id
    and participation.outcome = 'confirmed';

  return query
  select
    membership.id,
    membership.profile_id,
    profile.display_name,
    profile.avatar_path,
    v_cycle.id,
    participation.outcome = 'confirmed',
    participation.reported_at,
    case
      when participation.outcome = 'confirmed' then 'member_reported'
      else null
    end,
    private.member_investment_day_streak_v1(p_club_id, membership.id, v_now),
    v_member_count,
    v_completed_count,
    v_member_count - v_completed_count,
    v_member_count > 0 and v_completed_count = v_member_count
  from public.member_cycle_participations as participation
  join public.club_memberships as membership
    on membership.id = participation.membership_id
   and membership.club_id = p_club_id
  join public.profiles as profile
    on profile.id = membership.profile_id
  where participation.investment_cycle_id = p_cycle_id
    and participation.club_id = p_club_id
  order by
    case
      when membership.id = (
        select club.current_owner_membership_id
        from public.clubs as club
        where club.id = p_club_id
      ) then 0
      else 1
    end,
    membership.joined_at,
    membership.id;
end;
$function$;

create or replace function private.club_investment_day_participation_v1(
  p_club_id uuid,
  p_cycle_id uuid
)
returns table (
  membership_id uuid,
  profile_id uuid,
  display_name text,
  avatar_path text,
  cycle_id uuid,
  completed boolean,
  completed_at timestamptz,
  verification_level text,
  current_streak integer,
  member_count integer,
  completed_count integer,
  pending_count integer,
  all_completed boolean
)
language sql
stable
security definer
set search_path = ''
set row_security = off
as $function$
  select *
  from private.club_investment_day_participation_at_v1(p_club_id, p_cycle_id, pg_catalog.now());
$function$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on function private.investment_occurrence_at_v1(integer, integer, integer, text, text) from public, anon, authenticated;
revoke all on function private.investment_occurrence_key_v1(timestamptz, text) from public, anon, authenticated;
revoke all on function private.resolve_member_expected_contribution_at_v1(uuid, uuid, timestamptz) from public, anon, authenticated;
revoke all on function private.ensure_club_investment_schedule_v1(uuid) from public, anon, authenticated;
revoke all on function private.freeze_investment_cycle_roster_v1(uuid, timestamptz) from public, anon, authenticated;
revoke all on function private.advance_club_investment_cycles_v1(uuid, timestamptz) from public, anon, authenticated;
revoke all on function private.advance_investment_cycles_v1(timestamptz, uuid) from public, anon, authenticated;
revoke all on function private.ensure_legacy_saving_plan_for_amount_v1(uuid, uuid, bigint, text) from public, anon, authenticated;
revoke all on function private.latest_contribution_policy_version_id_v1(uuid) from public, anon, authenticated;
revoke all on function private.member_investment_day_streak_v1(uuid, uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.advance_investment_cycles_v1(timestamptz, uuid) from public, anon, authenticated;
revoke all on function private.report_investment_day_at_v1(uuid, uuid, uuid, public.investment_day_report_mode, public.participation_outcome, jsonb, timestamptz) from public, anon, authenticated;
revoke all on function private.current_investment_day_v1(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.current_investment_day_v1(uuid) from public, anon;
revoke all on function private.club_investment_day_participation_at_v1(uuid, uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.ensure_open_investment_day_v1(uuid) from public, anon, authenticated;
revoke all on function private.ensure_open_investment_day_v1(uuid) from public, anon, authenticated;

grant execute on function public.advance_investment_cycles_v1(timestamptz, uuid) to service_role;
grant execute on function public.current_investment_day_v1(uuid) to authenticated;
