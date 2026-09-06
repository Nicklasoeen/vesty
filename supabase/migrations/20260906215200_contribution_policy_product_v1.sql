-- Contribution Policy product flows: remove the invented 2000 NOK
-- runtime bootstrap, add create_club_v2, and make commitments the
-- only authority for future flexible amounts.
--
-- Activation invariant:
-- Creating a ContributionPolicyVersion means activating it for the
-- next eligible/unfrozen Investment Cycle. Open proposals must not
-- create policy versions. Prompt 3 will add proposal-gated writes.
--
-- Authority:
-- member_contribution_commitment_versions is the source of future
-- private flexible amounts. member_saving_plans is a legacy FK
-- artifact for member_cycle_participations.saving_plan_id only.

-- ---------------------------------------------------------------------------
-- Saving-plan compatibility: write-through from a resolved amount
-- ---------------------------------------------------------------------------

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

comment on function private.ensure_legacy_saving_plan_for_amount_v1(uuid, uuid, bigint, text) is
  'Creates a legacy member_saving_plans row only when none exists, using an already-resolved amount. Never invents an amount and never reads a plan as authority.';

-- ---------------------------------------------------------------------------
-- Commitments: flexible-only, and sync a legacy saving plan for FK use
-- ---------------------------------------------------------------------------

create or replace function private.create_member_contribution_commitment_v1(
  p_club_id uuid,
  p_amount_minor bigint
)
returns table (
  commitment_version_id uuid,
  version_number integer,
  amount_minor bigint,
  currency text
)
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid;
  v_membership public.club_memberships%rowtype;
  v_club public.clubs%rowtype;
  v_policy public.contribution_policy_versions%rowtype;
  v_next integer;
begin
  v_user_id := private.require_authenticated_profile_id();

  if p_club_id is null or p_amount_minor is null or p_amount_minor <= 0 then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.contribution_commitment_invalid';
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

  select *
  into v_policy
  from public.contribution_policy_versions as policy
  where policy.club_id = p_club_id
  order by policy.version_number desc
  limit 1;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.contribution_policy_missing';
  end if;

  if v_policy.mode <> 'flexible' then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.contribution_commitment_not_applicable';
  end if;

  select coalesce(max(commitment.version_number), 0) + 1
  into v_next
  from public.member_contribution_commitment_versions as commitment
  where commitment.membership_id = v_membership.id;

  insert into public.member_contribution_commitment_versions (
    club_id,
    membership_id,
    version_number,
    amount_minor,
    currency
  )
  values (
    p_club_id,
    v_membership.id,
    v_next,
    p_amount_minor,
    v_club.base_currency
  )
  returning
    public.member_contribution_commitment_versions.id,
    public.member_contribution_commitment_versions.version_number,
    public.member_contribution_commitment_versions.amount_minor,
    public.member_contribution_commitment_versions.currency
  into
    commitment_version_id,
    version_number,
    amount_minor,
    currency;

  perform private.ensure_legacy_saving_plan_for_amount_v1(
    p_club_id,
    v_membership.id,
    p_amount_minor,
    v_club.base_currency
  );

  return next;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Never invent a flexible amount. Historical 2000 NOK bootstrap is gone.
-- ---------------------------------------------------------------------------

create or replace function private.materialize_flexible_commitment_for_ensure_v1(
  p_club_id uuid,
  p_membership_id uuid,
  p_currency text,
  p_existing_plan public.member_saving_plans
)
returns bigint
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  -- p_currency and p_existing_plan are retained for signature compatibility.
  -- Saving-plan amounts are never authority. Callers must use
  -- private.resolve_member_expected_contribution_v1.
  raise exception using
    errcode = 'P0001',
    message = 'vesty.contribution_commitment_required';
end;
$function$;

comment on function private.materialize_flexible_commitment_for_ensure_v1(uuid, uuid, text, public.member_saving_plans) is
  'Retired TestFlight helper. The 2000.00 NOK bootstrap is removed. Flexible members without a commitment raise vesty.contribution_commitment_required.';

-- ---------------------------------------------------------------------------
-- ensure_open: resolve from policy + commitment only
-- ---------------------------------------------------------------------------

create or replace function private.ensure_open_investment_day_v1(p_club_id uuid)
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
as $function$
declare
  v_user_id uuid;
  v_membership public.club_memberships%rowtype;
  v_club public.clubs%rowtype;
  v_schedule public.investment_schedules%rowtype;
  v_cycle public.investment_cycles%rowtype;
  v_policy public.contribution_policy_versions%rowtype;
  v_strategy_id uuid;
  v_policy_id uuid;
  v_expected bigint;
  v_plan_id uuid;
  v_occurrence text;
  v_timezone text := 'Europe/Oslo';
  v_investment_day timestamptz;
begin
  v_user_id := private.require_authenticated_profile_id();
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_club_id::text, 0)
  );

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

  select version.id
  into v_strategy_id
  from public.strategy_versions as version
  where version.club_id = p_club_id
  order by version.version_number desc
  limit 1;

  if v_strategy_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.strategy_missing';
  end if;

  v_policy_id := private.ensure_genesis_contribution_policy_v1(
    p_club_id,
    v_membership.id
  );

  select *
  into v_schedule
  from public.investment_schedules as schedule
  where schedule.club_id = p_club_id
    and schedule.status in ('active', 'paused')
  order by schedule.revision_number desc
  limit 1;

  if not found then
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
      v_timezone,
      3,
      pg_catalog.now(),
      v_membership.id
    )
    returning * into v_schedule;
  end if;

  select *
  into v_cycle
  from public.investment_cycles as cycle
  where cycle.club_id = p_club_id
    and cycle.status = 'open'
  order by cycle.investment_day_at desc
  limit 1;

  if not found then
    v_occurrence := 'v1-' || pg_catalog.to_char(
      pg_catalog.timezone(v_timezone, pg_catalog.now()),
      'YYYY-MM'
    );

    select *
    into v_cycle
    from public.investment_cycles as cycle
    where cycle.club_id = p_club_id
      and cycle.occurrence_key = v_occurrence;
  end if;

  if v_cycle.id is not null then
    v_policy_id := v_cycle.contribution_policy_version_id;
  end if;

  -- Resolve this caller before inserting a new cycle. An unconfigured
  -- flexible member must not invent an amount. Raising here avoids
  -- creating a cycle that would roll back with the exception. A later
  -- configured member can still open the club cycle.
  v_expected := private.resolve_member_expected_contribution_v1(
    v_policy_id,
    v_membership.id
  );

  if v_cycle.id is null then
    v_investment_day := (
      pg_catalog.date_trunc(
        'day',
        pg_catalog.timezone(v_timezone, pg_catalog.now())
      ) + interval '12 hours'
    ) at time zone v_timezone;

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
    values (
      p_club_id,
      v_schedule.id,
      v_strategy_id,
      v_policy_id,
      v_occurrence,
      v_investment_day,
      v_investment_day - interval '1 day',
      v_investment_day,
      v_investment_day + interval '7 days',
      v_timezone,
      'open',
      pg_catalog.now()
    )
    returning * into v_cycle;
  end if;

  v_plan_id := private.ensure_legacy_saving_plan_for_amount_v1(
    p_club_id,
    v_membership.id,
    v_expected,
    v_club.base_currency
  );

  insert into public.member_cycle_participations (
    club_id,
    investment_cycle_id,
    membership_id,
    saving_plan_id,
    expected_amount_minor,
    currency
  )
  values (
    p_club_id,
    v_cycle.id,
    v_membership.id,
    v_plan_id,
    v_expected,
    v_club.base_currency
  )
  on conflict on constraint member_cycle_participations_cycle_membership_key do nothing;

  return query
  select *
  from private.investment_day_plan_v1(p_club_id, v_membership.id, v_cycle.id);
end;
$function$;

comment on function private.ensure_open_investment_day_v1(uuid) is
  'Opens or reuses the caller Investment Day. Future amounts come from the latest ContributionPolicyVersion and, when flexible, the member commitment. Never invents an amount. Unconfigured flexible members raise vesty.contribution_commitment_required without creating a cycle participation.';

-- ---------------------------------------------------------------------------
-- create_club_v2: explicit Equal / Flexible setup
-- ---------------------------------------------------------------------------

create function private.create_club_v2(
  p_name text,
  p_governance_threshold_kind public.governance_threshold_kind,
  p_package_id text,
  p_contribution_mode public.contribution_policy_mode,
  p_equal_amount_minor bigint,
  p_creator_flexible_amount_minor bigint,
  p_base_currency text
)
returns table (
  club_id uuid,
  membership_id uuid,
  strategy_version_id uuid
)
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_created record;
  v_currency text;
begin
  if p_contribution_mode is null then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.contribution_policy_invalid';
  end if;

  if p_contribution_mode = 'equal' then
    if p_equal_amount_minor is null or p_equal_amount_minor <= 0 then
      raise exception using
        errcode = 'P0001',
        message = 'vesty.contribution_policy_invalid';
    end if;
    if p_creator_flexible_amount_minor is not null then
      raise exception using
        errcode = 'P0001',
        message = 'vesty.contribution_policy_invalid';
    end if;
  else
    if p_equal_amount_minor is not null then
      raise exception using
        errcode = 'P0001',
        message = 'vesty.contribution_policy_invalid';
    end if;
    if p_creator_flexible_amount_minor is null or p_creator_flexible_amount_minor <= 0 then
      raise exception using
        errcode = 'P0001',
        message = 'vesty.contribution_commitment_invalid';
    end if;
  end if;

  select *
  into v_created
  from private.create_club(
    p_name,
    p_governance_threshold_kind,
    private.resolve_curated_package_allocations(p_package_id),
    p_base_currency
  );

  select club.base_currency
  into v_currency
  from public.clubs as club
  where club.id = v_created.club_id;

  insert into public.contribution_policy_versions (
    club_id,
    version_number,
    mode,
    currency,
    equal_amount_minor,
    created_by_membership_id
  )
  values (
    v_created.club_id,
    1,
    p_contribution_mode,
    v_currency,
    case
      when p_contribution_mode = 'equal' then p_equal_amount_minor
      else null
    end,
    v_created.membership_id
  );

  if p_contribution_mode = 'flexible' then
    insert into public.member_contribution_commitment_versions (
      club_id,
      membership_id,
      version_number,
      amount_minor,
      currency
    )
    values (
      v_created.club_id,
      v_created.membership_id,
      1,
      p_creator_flexible_amount_minor,
      v_currency
    );

    perform private.ensure_legacy_saving_plan_for_amount_v1(
      v_created.club_id,
      v_created.membership_id,
      p_creator_flexible_amount_minor,
      v_currency
    );
  end if;

  club_id := v_created.club_id;
  membership_id := v_created.membership_id;
  strategy_version_id := v_created.strategy_version_id;
  return next;
end;
$function$;

create function public.create_club_v2(
  p_name text,
  p_governance_threshold_kind public.governance_threshold_kind,
  p_package_id text,
  p_contribution_mode public.contribution_policy_mode,
  p_equal_amount_minor bigint default null,
  p_creator_flexible_amount_minor bigint default null,
  p_base_currency text default 'NOK'
)
returns table (
  club_id uuid,
  membership_id uuid,
  strategy_version_id uuid
)
language sql
volatile
security invoker
set search_path = ''
as $function$
  select *
  from private.create_club_v2(
    p_name,
    p_governance_threshold_kind,
    p_package_id,
    p_contribution_mode,
    p_equal_amount_minor,
    p_creator_flexible_amount_minor,
    p_base_currency
  );
$function$;

comment on function public.create_club(text, public.governance_threshold_kind, text, text) is
  'Legacy Create Club path. Writes Flexible ContributionPolicyVersion 1 only. Does not invent a creator amount. New mobile clients must use create_club_v2.';

comment on function public.create_club_v2(text, public.governance_threshold_kind, text, public.contribution_policy_mode, bigint, bigint, text) is
  'Creates a club, genesis StrategyVersion 1, and genesis ContributionPolicyVersion 1. Equal requires a shared amount and forbids a creator commitment. Flexible requires the creator private amount and forbids a shared amount.';

comment on function public.create_member_contribution_commitment_v1(uuid, bigint) is
  'Appends an immutable private flexible commitment. Rejected when the latest club policy is equal. Also writes a legacy saving-plan row when none exists so cycle FKs remain satisfied.';

comment on table public.member_saving_plans is
  'Legacy compatibility for member_cycle_participations.saving_plan_id. Future flexible amounts are resolved from member_contribution_commitment_versions, never from this table.';

comment on table public.member_contribution_commitment_versions is
  'Authoritative private flexible contribution amounts. Creating a version activates it for the next unfrozen Investment Cycle. Frozen expected_amount_minor values are never rewritten.';

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------

revoke all on function private.ensure_legacy_saving_plan_for_amount_v1(uuid, uuid, bigint, text) from public, anon, authenticated;
revoke all on function private.create_club_v2(text, public.governance_threshold_kind, text, public.contribution_policy_mode, bigint, bigint, text) from public, anon, authenticated;

grant execute on function private.create_club_v2(text, public.governance_threshold_kind, text, public.contribution_policy_mode, bigint, bigint, text) to authenticated;

revoke all on function public.create_club_v2(text, public.governance_threshold_kind, text, public.contribution_policy_mode, bigint, bigint, text) from public, anon;
grant execute on function public.create_club_v2(text, public.governance_threshold_kind, text, public.contribution_policy_mode, bigint, bigint, text) to authenticated;
