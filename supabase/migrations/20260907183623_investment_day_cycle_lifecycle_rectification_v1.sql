-- F03/F04 rectification: bind lifecycle decisions to historical validity,
-- serialize reporting with cycle transitions, and close remaining private RPCs.

create function private.latest_contribution_policy_version_id_at_v1(
  p_club_id uuid,
  p_as_of timestamptz
)
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
    and policy.created_at <= p_as_of
  order by policy.created_at desc, policy.version_number desc, policy.id desc
  limit 1;
$function$;

comment on function private.latest_contribution_policy_version_id_at_v1(uuid, timestamptz) is
  'Returns the deterministic latest contribution policy that existed at the supplied historical instant.';

create function private.investment_schedule_occurrence_v1(
  p_club_id uuid,
  p_year integer,
  p_month integer
)
returns table (
  investment_schedule_id uuid,
  schedule_status public.investment_schedule_status,
  investment_day_at timestamptz,
  configuration_deadline_at timestamptz,
  reporting_opens_at timestamptz,
  reporting_closes_at timestamptz,
  timezone text
)
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $function$
declare
  v_schedule public.investment_schedules%rowtype;
  v_investment_day timestamptz;
  v_deadline timestamptz;
  v_lead interval;
begin
  for v_schedule in
    select schedule.*
    from public.investment_schedules as schedule
    where schedule.club_id = p_club_id
    order by
      schedule.effective_from desc,
      schedule.revision_number desc,
      schedule.id desc
  loop
    begin
      v_investment_day := private.investment_occurrence_at_v1(
        p_year,
        p_month,
        v_schedule.day_of_month,
        v_schedule.missing_day_policy,
        v_schedule.timezone
      );
    exception
      when sqlstate 'P0001' then
        if sqlerrm = 'vesty.schedule_invalid' then
          continue;
        end if;
        raise;
    end;

    v_lead := pg_catalog.make_interval(
      days => greatest(v_schedule.configuration_lead_days, 0)
    );
    if v_lead = interval '0' then
      v_deadline := v_investment_day - interval '1 second';
    else
      v_deadline := v_investment_day - v_lead;
    end if;

    -- Schedule validity is the half-open interval
    -- [effective_from, effective_until). The same revision must be valid at
    -- both the configuration deadline and the planned occurrence.
    if v_schedule.effective_from <= v_deadline
      and (
        v_schedule.effective_until is null
        or v_deadline < v_schedule.effective_until
      )
      and v_schedule.effective_from <= v_investment_day
      and (
        v_schedule.effective_until is null
        or v_investment_day < v_schedule.effective_until
      )
    then
      investment_schedule_id := v_schedule.id;
      schedule_status := v_schedule.status;
      investment_day_at := v_investment_day;
      configuration_deadline_at := v_deadline;
      reporting_opens_at := v_investment_day;
      reporting_closes_at := v_investment_day + interval '7 days';
      timezone := v_schedule.timezone;
      return next;
      return;
    end if;
  end loop;
end;
$function$;

comment on function private.investment_schedule_occurrence_v1(uuid, integer, integer) is
  'Selects one deterministic schedule revision per club/month. Validity is [effective_from, effective_until), and must include both deadline and occurrence. Paused or scheduled revisions are returned so callers do not fall back to an older active revision.';

create or replace function private.freeze_investment_cycle_roster_v1(
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
    and version.effective_at <= v_cycle.configuration_deadline_at
  order by
    version.effective_at desc,
    version.version_number desc,
    version.id desc
  limit 1;

  if v_strategy_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.strategy_missing';
  end if;

  v_policy_id := private.latest_contribution_policy_version_id_at_v1(
    v_cycle.club_id,
    v_cycle.configuration_deadline_at
  );

  if v_policy_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.contribution_policy_missing';
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

create or replace function private.advance_club_investment_cycles_v1(
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
  v_anchor_schedule public.investment_schedules%rowtype;
  v_strategy_id uuid;
  v_policy_id uuid;
  v_occurrence_strategy_id uuid;
  v_occurrence_policy_id uuid;
  v_local timestamp;
  v_month timestamp;
  v_end timestamp;
  v_year integer;
  v_month_no integer;
  v_key text;
  v_occurrence record;
  v_cycle public.investment_cycles%rowtype;
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

  perform private.ensure_club_investment_schedule_v1(p_club_id);

  select *
  into v_anchor_schedule
  from public.investment_schedules as schedule
  where schedule.club_id = p_club_id
  order by schedule.revision_number desc, schedule.id desc
  limit 1;

  if not found then
    return;
  end if;

  select version.id
  into v_strategy_id
  from public.strategy_versions as version
  where version.club_id = p_club_id
  order by version.version_number desc, version.id desc
  limit 1;

  v_policy_id := private.latest_contribution_policy_version_id_v1(p_club_id);

  if v_strategy_id is null or v_policy_id is null then
    return;
  end if;

  v_local := v_now at time zone v_anchor_schedule.timezone;
  v_month := pg_catalog.date_trunc('month', v_local) - interval '2 months';
  v_end := pg_catalog.date_trunc('month', v_local) + interval '2 months';

  while v_month <= v_end loop
    v_year := pg_catalog.date_part('year', v_month)::integer;
    v_month_no := pg_catalog.date_part('month', v_month)::integer;

    select *
    into v_occurrence
    from private.investment_schedule_occurrence_v1(
      p_club_id,
      v_year,
      v_month_no
    );

    if found
      and v_occurrence.schedule_status in ('active', 'replaced', 'ended')
    then
      v_key := private.investment_occurrence_key_v1(
        v_occurrence.investment_day_at,
        v_occurrence.timezone
      );

      select version.id
      into v_occurrence_strategy_id
      from public.strategy_versions as version
      where version.club_id = p_club_id
        and version.effective_at <= v_occurrence.configuration_deadline_at
      order by
        version.effective_at desc,
        version.version_number desc,
        version.id desc
      limit 1;

      v_occurrence_policy_id := private.latest_contribution_policy_version_id_at_v1(
        p_club_id,
        v_occurrence.configuration_deadline_at
      );

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
        v_occurrence.investment_schedule_id,
        coalesce(v_occurrence_strategy_id, v_strategy_id),
        coalesce(v_occurrence_policy_id, v_policy_id),
        v_key,
        v_occurrence.investment_day_at,
        v_occurrence.configuration_deadline_at,
        v_occurrence.reporting_opens_at,
        v_occurrence.reporting_closes_at,
        v_occurrence.timezone,
        'upcoming'
      )
      on conflict on constraint investment_cycles_club_occurrence_key do nothing;
    end if;

    v_month := v_month + interval '1 month';
  end loop;

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

create or replace function private.report_investment_day_at_v1(
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
    and cycle.club_id = p_club_id
  for update;

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

  if v_existing.id is not null
    and v_existing.client_report_id = p_client_report_id
  then
    if v_existing.payload_fingerprint = v_fingerprint then
      return query
      select *
      from private.investment_day_plan_v1(
        p_club_id,
        v_membership.id,
        p_cycle_id
      );
      return;
    end if;

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

  if v_existing.id is not null
    or v_participation.outcome <> 'expected'
  then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.report_conflict';
  end if;

  v_provenance := case
    when p_report_mode = 'as_planned'
      then 'member_attested_plan'::public.investment_amount_provenance
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
  from private.investment_day_plan_v1(
    p_club_id,
    v_membership.id,
    p_cycle_id
  );
end;
$function$;

alter function private.member_investment_day_streak_v1(uuid, uuid, timestamptz)
  set row_security = off;

alter function public.club_investment_day_participation_v1(uuid, uuid)
  security definer;
alter function public.club_investment_day_participation_v1(uuid, uuid)
  set row_security = off;

revoke all on function private.latest_contribution_policy_version_id_at_v1(uuid, timestamptz)
  from public, anon, authenticated;
revoke all on function private.investment_schedule_occurrence_v1(uuid, integer, integer)
  from public, anon, authenticated;
revoke all on function private.freeze_investment_cycle_roster_v1(uuid, timestamptz)
  from public, anon, authenticated;
revoke all on function private.advance_club_investment_cycles_v1(uuid, timestamptz)
  from public, anon, authenticated;
revoke all on function private.report_investment_day_at_v1(
  uuid,
  uuid,
  uuid,
  public.investment_day_report_mode,
  public.participation_outcome,
  jsonb,
  timestamptz
) from public, anon, authenticated;
revoke all on function private.club_investment_day_participation_v1(uuid, uuid)
  from public, anon, authenticated;
revoke all on function private.prevent_cycle_policy_rewrite()
  from public, anon, authenticated;
revoke all on function private.investment_occurrence_at_v1(
  integer,
  integer,
  integer,
  text,
  text
) from public, anon, authenticated;
revoke all on function private.investment_occurrence_key_v1(timestamptz, text)
  from public, anon, authenticated;
revoke all on function private.resolve_member_expected_contribution_at_v1(
  uuid,
  uuid,
  timestamptz
) from public, anon, authenticated;
revoke all on function private.latest_contribution_policy_version_id_v1(uuid)
  from public, anon, authenticated;
revoke all on function private.ensure_club_investment_schedule_v1(uuid)
  from public, anon, authenticated;
revoke all on function private.ensure_legacy_saving_plan_for_amount_v1(
  uuid,
  uuid,
  bigint,
  text
) from public, anon, authenticated;
revoke all on function private.advance_investment_cycles_v1(timestamptz, uuid)
  from public, anon, authenticated;
revoke all on function private.report_investment_day_v1(
  uuid,
  uuid,
  uuid,
  public.investment_day_report_mode,
  public.participation_outcome,
  jsonb
) from public, anon, authenticated;
revoke all on function private.current_investment_day_v1(uuid, timestamptz)
  from public, anon, authenticated;
revoke all on function private.member_investment_day_streak_v1(
  uuid,
  uuid,
  timestamptz
) from public, anon, authenticated;
revoke all on function private.club_investment_day_participation_at_v1(
  uuid,
  uuid,
  timestamptz
) from public, anon, authenticated;

comment on function private.freeze_investment_cycle_roster_v1(uuid, timestamptz) is
  'Freezes the strategy effective at, policy created by, memberships active at, and Flexible commitments created by configuration_deadline_at. Missing historical strategy/policy raises; it never falls back to the latest current version.';

comment on function private.report_investment_day_at_v1(
  uuid,
  uuid,
  uuid,
  public.investment_day_report_mode,
  public.participation_outcome,
  jsonb,
  timestamptz
) is
  'Locked Investment Day report writer. Identical same-ID retries return without DML; changed same-ID payload conflicts; new IDs obey the current reporting window and cycle status.';
