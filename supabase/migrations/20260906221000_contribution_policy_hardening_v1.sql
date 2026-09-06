-- Harden Contribution Policy before commit:
-- 1. No ordinary client RPC can append policy versions.
-- 2. Existing cycles never re-resolve against the latest policy.
-- 3. Existing participations never recalculate expected_amount_minor.
-- 4. Remove the retired 2000 NOK inventing helper.

-- ---------------------------------------------------------------------------
-- Trusted policy-version insert: governance/tests only
-- ---------------------------------------------------------------------------

revoke all on function public.create_contribution_policy_version_v1(
  uuid,
  public.contribution_policy_mode,
  bigint
) from public, anon, authenticated;

drop function public.create_contribution_policy_version_v1(
  uuid,
  public.contribution_policy_mode,
  bigint
);

revoke all on function private.create_contribution_policy_version_v1(
  uuid,
  public.contribution_policy_mode,
  bigint
) from public, anon, authenticated;

create or replace function private.create_contribution_policy_version_v1(
  p_club_id uuid,
  p_mode public.contribution_policy_mode,
  p_equal_amount_minor bigint
)
returns table (
  policy_version_id uuid,
  version_number integer,
  mode public.contribution_policy_mode,
  currency text,
  equal_amount_minor bigint
)
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_club public.clubs%rowtype;
  v_next integer;
  v_amount bigint;
  v_creator uuid;
begin
  if p_club_id is null or p_mode is null then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.contribution_policy_invalid';
  end if;

  select *
  into v_club
  from public.clubs as club
  where club.id = p_club_id;

  if not found or v_club.status <> 'active' then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.contribution_policy_forbidden';
  end if;

  v_creator := v_club.current_owner_membership_id;
  if v_creator is null then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.contribution_policy_forbidden';
  end if;

  if p_mode = 'equal' then
    v_amount := p_equal_amount_minor;
    if v_amount is null or v_amount <= 0 then
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
    v_amount := null;
  end if;

  select coalesce(max(policy.version_number), 0) + 1
  into v_next
  from public.contribution_policy_versions as policy
  where policy.club_id = p_club_id;

  insert into public.contribution_policy_versions (
    club_id,
    version_number,
    mode,
    currency,
    equal_amount_minor,
    created_by_membership_id
  )
  values (
    p_club_id,
    v_next,
    p_mode,
    v_club.base_currency,
    v_amount,
    v_creator
  )
  returning
    public.contribution_policy_versions.id,
    public.contribution_policy_versions.version_number,
    public.contribution_policy_versions.mode,
    public.contribution_policy_versions.currency,
    public.contribution_policy_versions.equal_amount_minor
  into
    policy_version_id,
    version_number,
    mode,
    currency,
    equal_amount_minor;

  return next;
end;
$function$;

comment on function private.create_contribution_policy_version_v1(uuid, public.contribution_policy_mode, bigint) is
  'Trusted append of an immutable ContributionPolicyVersion. Not executable by authenticated clients. Future proposal approval will call this after a vote. Creating a version activates it only for the next eligible/unfrozen Investment Cycle.';

revoke all on function private.create_contribution_policy_version_v1(
  uuid,
  public.contribution_policy_mode,
  bigint
) from public, anon, authenticated;

grant execute on function private.create_contribution_policy_version_v1(
  uuid,
  public.contribution_policy_mode,
  bigint
) to service_role;

-- ---------------------------------------------------------------------------
-- Existing cycles: freeze to stored policy; never re-resolve latest
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
  v_existing public.member_cycle_participations%rowtype;
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
    -- Existing cycle: always the frozen policy pointer. Never latest.
    v_policy_id := v_cycle.contribution_policy_version_id;

    select *
    into v_existing
    from public.member_cycle_participations as participation
    where participation.investment_cycle_id = v_cycle.id
      and participation.membership_id = v_membership.id;

    if found then
      return query
      select *
      from private.investment_day_plan_v1(p_club_id, v_membership.id, v_cycle.id);
      return;
    end if;
  else
    -- New cycle only: latest active policy.
    v_policy_id := private.ensure_genesis_contribution_policy_v1(
      p_club_id,
      v_membership.id
    );
  end if;

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
  'Opens or reuses the caller Investment Day. A NEW cycle may select the latest ContributionPolicyVersion. An EXISTING cycle always uses investment_cycles.contribution_policy_version_id. An existing participation is returned as stored and is never recalculated. Flexible members without a commitment raise vesty.contribution_commitment_required.';

-- ---------------------------------------------------------------------------
-- Remove retired 2000 NOK inventing helper
-- ---------------------------------------------------------------------------

revoke all on function private.materialize_flexible_commitment_for_ensure_v1(
  uuid,
  uuid,
  text,
  public.member_saving_plans
) from public, anon, authenticated;

drop function private.materialize_flexible_commitment_for_ensure_v1(
  uuid,
  uuid,
  text,
  public.member_saving_plans
);
