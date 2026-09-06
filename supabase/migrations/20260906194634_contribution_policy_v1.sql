-- Contribution Policy V1: immutable policy versions, private flexible
-- commitments, and cycle freeze. Direct client writes remain blocked.
-- Broker execution and drift-aware planning are out of scope.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.contribution_policy_mode as enum (
  'equal',
  'flexible'
);

-- ---------------------------------------------------------------------------
-- contribution_policy_versions
-- ---------------------------------------------------------------------------

create table public.contribution_policy_versions (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete restrict,
  version_number integer not null,
  mode public.contribution_policy_mode not null,
  currency text not null,
  equal_amount_minor bigint,
  created_by_membership_id uuid not null,
  source_proposal_id uuid,
  created_at timestamptz not null default now(),

  constraint contribution_policy_versions_club_id_id_key
    unique (club_id, id),
  constraint contribution_policy_versions_club_version_key
    unique (club_id, version_number),
  constraint contribution_policy_versions_creator_same_club_fkey
    foreign key (club_id, created_by_membership_id)
    references public.club_memberships (club_id, id)
    on delete restrict,
  constraint contribution_policy_versions_version_check
    check (version_number >= 1),
  constraint contribution_policy_versions_currency_check
    check (currency ~ '^[A-Z]{3}$'),
  constraint contribution_policy_versions_mode_amount_check
    check (
      (
        mode = 'equal'
        and equal_amount_minor is not null
        and equal_amount_minor > 0
      )
      or
      (
        mode = 'flexible'
        and equal_amount_minor is null
      )
    ),
  constraint contribution_policy_versions_genesis_check
    check (
      (version_number = 1 and source_proposal_id is null)
      or version_number > 1
    )
);

create index contribution_policy_versions_club_version_idx
  on public.contribution_policy_versions (club_id, version_number desc);

comment on table public.contribution_policy_versions is
  'Immutable club contribution-policy history. Latest version_number is selected at new cycle creation. Frozen cycles keep their stored reference.';

-- ---------------------------------------------------------------------------
-- member_contribution_commitment_versions
-- ---------------------------------------------------------------------------

create table public.member_contribution_commitment_versions (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null,
  membership_id uuid not null,
  version_number integer not null,
  amount_minor bigint not null,
  currency text not null,
  created_at timestamptz not null default now(),

  constraint member_contribution_commitment_versions_club_id_id_key
    unique (club_id, id),
  constraint member_contribution_commitment_versions_membership_version_key
    unique (membership_id, version_number),
  constraint member_contribution_commitment_versions_club_membership_id_key
    unique (club_id, membership_id, id),
  constraint member_contribution_commitment_versions_membership_same_club_fkey
    foreign key (club_id, membership_id)
    references public.club_memberships (club_id, id)
    on delete restrict,
  constraint member_contribution_commitment_versions_version_check
    check (version_number >= 1),
  constraint member_contribution_commitment_versions_amount_check
    check (amount_minor > 0),
  constraint member_contribution_commitment_versions_currency_check
    check (currency ~ '^[A-Z]{3}$')
);

create index member_contribution_commitment_versions_membership_idx
  on public.member_contribution_commitment_versions (membership_id, version_number desc);

comment on table public.member_contribution_commitment_versions is
  'Immutable private flexible contribution commitments. Only the owning member may read them. Cycle freeze copies the applicable amount into expected_amount_minor.';

-- ---------------------------------------------------------------------------
-- Cycle freeze pointer
-- ---------------------------------------------------------------------------

alter table public.investment_cycles
  add column contribution_policy_version_id uuid;

create index investment_cycles_contribution_policy_version_idx
  on public.investment_cycles (contribution_policy_version_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.contribution_policy_versions enable row level security;
alter table public.contribution_policy_versions force row level security;
alter table public.member_contribution_commitment_versions enable row level security;
alter table public.member_contribution_commitment_versions force row level security;

revoke all on public.contribution_policy_versions from public, anon, authenticated;
revoke all on public.member_contribution_commitment_versions from public, anon, authenticated;

grant select on public.contribution_policy_versions to authenticated;
grant select on public.member_contribution_commitment_versions to authenticated;

create policy contribution_policy_versions_select_active_members
on public.contribution_policy_versions
for select
to authenticated
using ((select private.is_active_club_member(club_id)));

create policy member_contribution_commitment_versions_select_self
on public.member_contribution_commitment_versions
for select
to authenticated
using ((select private.owns_active_membership(membership_id)));

-- ---------------------------------------------------------------------------
-- Resolution and write helpers
-- ---------------------------------------------------------------------------

create function private.latest_contribution_policy_version_id_v1(p_club_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $function$
  select policy.id
  from public.contribution_policy_versions as policy
  where policy.club_id = p_club_id
  order by policy.version_number desc
  limit 1;
$function$;

create function private.ensure_genesis_contribution_policy_v1(
  p_club_id uuid,
  p_created_by_membership_id uuid
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_policy_id uuid;
  v_currency text;
begin
  v_policy_id := private.latest_contribution_policy_version_id_v1(p_club_id);
  if v_policy_id is not null then
    return v_policy_id;
  end if;

  select club.base_currency
  into v_currency
  from public.clubs as club
  where club.id = p_club_id;

  if v_currency is null then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.contribution_policy_missing';
  end if;

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
    1,
    'flexible',
    v_currency,
    null,
    p_created_by_membership_id
  )
  returning id into v_policy_id;

  return v_policy_id;
end;
$function$;

create function private.resolve_member_expected_contribution_v1(
  p_policy_id uuid,
  p_membership_id uuid
)
returns bigint
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_policy public.contribution_policy_versions%rowtype;
  v_amount bigint;
begin
  if p_policy_id is null or p_membership_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.contribution_resolution_invalid';
  end if;

  select *
  into v_policy
  from public.contribution_policy_versions as policy
  where policy.id = p_policy_id;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.contribution_policy_missing';
  end if;

  if not exists (
    select 1
    from public.club_memberships as membership
    where membership.id = p_membership_id
      and membership.club_id = v_policy.club_id
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.contribution_resolution_invalid';
  end if;

  if v_policy.mode = 'equal' then
    return v_policy.equal_amount_minor;
  end if;

  select commitment.amount_minor
  into v_amount
  from public.member_contribution_commitment_versions as commitment
  where commitment.membership_id = p_membership_id
    and commitment.club_id = v_policy.club_id
  order by commitment.version_number desc
  limit 1;

  if v_amount is null then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.contribution_commitment_required';
  end if;

  return v_amount;
end;
$function$;

create function private.create_contribution_policy_version_v1(
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
  v_user_id uuid;
  v_club public.clubs%rowtype;
  v_next integer;
  v_amount bigint;
begin
  v_user_id := private.require_authenticated_profile_id();

  if p_club_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.contribution_policy_forbidden';
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

  if not private.is_club_owner(p_club_id) then
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
    (
      select membership.id
      from public.club_memberships as membership
      where membership.club_id = p_club_id
        and membership.profile_id = v_user_id
        and membership.status = 'active'
    )
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

create function private.create_member_contribution_commitment_v1(
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

  return next;
end;
$function$;

create function private.materialize_flexible_commitment_for_ensure_v1(
  p_club_id uuid,
  p_membership_id uuid,
  p_currency text,
  p_existing_plan public.member_saving_plans
)
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_amount bigint;
  v_next integer;
  v_default_amount constant bigint := 200000;
begin
  select commitment.amount_minor
  into v_amount
  from public.member_contribution_commitment_versions as commitment
  where commitment.membership_id = p_membership_id
    and commitment.club_id = p_club_id
  order by commitment.version_number desc
  limit 1;

  if v_amount is not null then
    return v_amount;
  end if;

  -- V1 compatibility: an existing private saving plan is the historical
  -- commitment. Do not invent a new amount when that plan exists.
  if p_existing_plan.id is not null then
    v_amount := p_existing_plan.amount_minor;
  else
    -- TestFlight ensure_open still bootstraps the historical 2000.00 NOK
    -- default so current Investment Day clients keep working until Create /
    -- Join setup UX exists. The domain resolver never invents this amount.
    v_amount := v_default_amount;
  end if;

  select coalesce(max(commitment.version_number), 0) + 1
  into v_next
  from public.member_contribution_commitment_versions as commitment
  where commitment.membership_id = p_membership_id;

  insert into public.member_contribution_commitment_versions (
    club_id,
    membership_id,
    version_number,
    amount_minor,
    currency
  )
  values (
    p_club_id,
    p_membership_id,
    v_next,
    v_amount,
    p_currency
  );

  return v_amount;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Public wrappers and reads
-- ---------------------------------------------------------------------------

create function public.create_contribution_policy_version_v1(
  p_club_id uuid,
  p_mode public.contribution_policy_mode,
  p_equal_amount_minor bigint default null
)
returns table (
  policy_version_id uuid,
  version_number integer,
  mode public.contribution_policy_mode,
  currency text,
  equal_amount_minor bigint
)
language sql
volatile
security invoker
set search_path = ''
as $function$
  select *
  from private.create_contribution_policy_version_v1(
    p_club_id,
    p_mode,
    p_equal_amount_minor
  );
$function$;

create function public.create_member_contribution_commitment_v1(
  p_club_id uuid,
  p_amount_minor bigint
)
returns table (
  commitment_version_id uuid,
  version_number integer,
  amount_minor bigint,
  currency text
)
language sql
volatile
security invoker
set search_path = ''
as $function$
  select *
  from private.create_member_contribution_commitment_v1(p_club_id, p_amount_minor);
$function$;

create function public.club_contribution_policy_v1(p_club_id uuid)
returns table (
  club_id uuid,
  policy_version_id uuid,
  mode public.contribution_policy_mode,
  currency text,
  equal_amount_minor bigint
)
language plpgsql
stable
security invoker
set search_path = ''
as $function$
begin
  if p_club_id is null or not private.is_active_club_member(p_club_id) then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.not_club_member';
  end if;

  return query
  select
    policy.club_id,
    policy.id,
    policy.mode,
    policy.currency,
    policy.equal_amount_minor
  from public.contribution_policy_versions as policy
  where policy.club_id = p_club_id
  order by policy.version_number desc
  limit 1;
end;
$function$;

create function public.my_contribution_commitment_v1(p_club_id uuid)
returns table (
  club_id uuid,
  membership_id uuid,
  commitment_version_id uuid,
  version_number integer,
  amount_minor bigint,
  currency text,
  created_at timestamptz
)
language plpgsql
stable
security invoker
set search_path = ''
as $function$
declare
  v_user_id uuid;
begin
  v_user_id := (select auth.uid());
  if v_user_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.unauthenticated';
  end if;

  if p_club_id is null or not private.is_active_club_member(p_club_id) then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.not_club_member';
  end if;

  return query
  select
    commitment.club_id,
    commitment.membership_id,
    commitment.id,
    commitment.version_number,
    commitment.amount_minor,
    commitment.currency,
    commitment.created_at
  from public.member_contribution_commitment_versions as commitment
  join public.club_memberships as membership
    on membership.id = commitment.membership_id
   and membership.club_id = commitment.club_id
  where commitment.club_id = p_club_id
    and membership.profile_id = v_user_id
    and membership.status = 'active'
  order by commitment.version_number desc
  limit 1;
end;
$function$;

-- ---------------------------------------------------------------------------
-- create_club: genesis flexible policy, same public signature
-- ---------------------------------------------------------------------------

drop function public.create_club(text, public.governance_threshold_kind, text, text);

create function public.create_club(
  p_name text,
  p_governance_threshold_kind public.governance_threshold_kind,
  p_package_id text,
  p_base_currency text default 'NOK'
)
returns table (
  club_id uuid,
  membership_id uuid,
  strategy_version_id uuid
)
language plpgsql
volatile
security invoker
set search_path = ''
as $function$
declare
  v_created record;
begin
  select *
  into v_created
  from private.create_club(
    p_name,
    p_governance_threshold_kind,
    private.resolve_curated_package_allocations(p_package_id),
    p_base_currency
  );

  perform private.ensure_genesis_contribution_policy_v1(
    v_created.club_id,
    v_created.membership_id
  );

  club_id := v_created.club_id;
  membership_id := v_created.membership_id;
  strategy_version_id := v_created.strategy_version_id;
  return next;
end;
$function$;

comment on function public.create_club(text, public.governance_threshold_kind, text, text) is
  'Creates a club, genesis StrategyVersion 1, and genesis flexible ContributionPolicyVersion 1. Callers cannot supply allocations or contribution amounts.';

-- ---------------------------------------------------------------------------
-- Backfill existing clubs / cycles / saving-plan history
-- ---------------------------------------------------------------------------

insert into public.contribution_policy_versions (
  club_id,
  version_number,
  mode,
  currency,
  equal_amount_minor,
  created_by_membership_id,
  created_at
)
select
  club.id,
  1,
  'flexible',
  club.base_currency,
  null,
  club.current_owner_membership_id,
  club.created_at
from public.clubs as club
where not exists (
  select 1
  from public.contribution_policy_versions as policy
  where policy.club_id = club.id
);

insert into public.member_contribution_commitment_versions (
  club_id,
  membership_id,
  version_number,
  amount_minor,
  currency,
  created_at
)
select
  plan.club_id,
  plan.membership_id,
  pg_catalog.row_number() over (
    partition by plan.membership_id
    order by plan.created_at, plan.id
  ),
  plan.amount_minor,
  plan.currency,
  plan.created_at
from public.member_saving_plans as plan
where not exists (
  select 1
  from public.member_contribution_commitment_versions as commitment
  where commitment.membership_id = plan.membership_id
);

update public.investment_cycles as cycle
set contribution_policy_version_id = policy.id
from public.contribution_policy_versions as policy
where policy.club_id = cycle.club_id
  and policy.version_number = 1
  and cycle.contribution_policy_version_id is null;

alter table public.investment_cycles
  alter column contribution_policy_version_id set not null;

alter table public.investment_cycles
  add constraint investment_cycles_policy_same_club_fkey
    foreign key (club_id, contribution_policy_version_id)
    references public.contribution_policy_versions (club_id, id)
    on delete restrict;

-- ---------------------------------------------------------------------------
-- Frozen cycle policy cannot be rewritten
-- ---------------------------------------------------------------------------

create function private.prevent_cycle_policy_rewrite()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if old.contribution_policy_version_id is distinct from new.contribution_policy_version_id then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.cycle_policy_frozen';
  end if;
  return new;
end;
$function$;

create trigger investment_cycles_policy_frozen
before update on public.investment_cycles
for each row
execute function private.prevent_cycle_policy_rewrite();

-- ---------------------------------------------------------------------------
-- ensure_open: freeze the cycle policy and resolved expected amount
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
  v_plan public.member_saving_plans%rowtype;
  v_policy public.contribution_policy_versions%rowtype;
  v_strategy_id uuid;
  v_policy_id uuid;
  v_expected bigint;
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

    if not found then
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
  end if;

  select *
  into v_policy
  from public.contribution_policy_versions as policy
  where policy.id = v_cycle.contribution_policy_version_id;

  select *
  into v_plan
  from public.member_saving_plans as plan
  where plan.membership_id = v_membership.id
    and plan.club_id = p_club_id
    and plan.status = 'active'
  order by plan.active_from desc
  limit 1;

  if v_policy.mode = 'equal' then
    v_expected := v_policy.equal_amount_minor;
  else
    v_expected := private.materialize_flexible_commitment_for_ensure_v1(
      p_club_id,
      v_membership.id,
      v_club.base_currency,
      v_plan
    );
  end if;

  if v_plan.id is null then
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
      v_membership.id,
      v_expected,
      v_club.base_currency,
      'active',
      pg_catalog.now()
    )
    returning * into v_plan;
  end if;

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
    v_plan.id,
    v_expected,
    v_club.base_currency
  )
  on conflict on constraint member_cycle_participations_cycle_membership_key do nothing;

  return query
  select *
  from private.investment_day_plan_v1(p_club_id, v_membership.id, v_cycle.id);
end;
$function$;

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------

revoke all on function private.latest_contribution_policy_version_id_v1(uuid) from public, anon, authenticated;
revoke all on function private.ensure_genesis_contribution_policy_v1(uuid, uuid) from public, anon, authenticated;
revoke all on function private.resolve_member_expected_contribution_v1(uuid, uuid) from public, anon, authenticated;
revoke all on function private.create_contribution_policy_version_v1(uuid, public.contribution_policy_mode, bigint) from public, anon, authenticated;
revoke all on function private.create_member_contribution_commitment_v1(uuid, bigint) from public, anon, authenticated;
revoke all on function private.materialize_flexible_commitment_for_ensure_v1(uuid, uuid, text, public.member_saving_plans) from public, anon, authenticated;
revoke all on function private.prevent_cycle_policy_rewrite() from public, anon, authenticated;

grant execute on function private.ensure_genesis_contribution_policy_v1(uuid, uuid) to authenticated;
grant execute on function private.create_contribution_policy_version_v1(uuid, public.contribution_policy_mode, bigint) to authenticated;
grant execute on function private.create_member_contribution_commitment_v1(uuid, bigint) to authenticated;

revoke all on function public.create_contribution_policy_version_v1(uuid, public.contribution_policy_mode, bigint) from public, anon;
revoke all on function public.create_member_contribution_commitment_v1(uuid, bigint) from public, anon;
revoke all on function public.club_contribution_policy_v1(uuid) from public, anon;
revoke all on function public.my_contribution_commitment_v1(uuid) from public, anon;
revoke all on function public.create_club(text, public.governance_threshold_kind, text, text) from public, anon;

grant execute on function public.create_contribution_policy_version_v1(uuid, public.contribution_policy_mode, bigint) to authenticated;
grant execute on function public.create_member_contribution_commitment_v1(uuid, bigint) to authenticated;
grant execute on function public.club_contribution_policy_v1(uuid) to authenticated;
grant execute on function public.my_contribution_commitment_v1(uuid) to authenticated;
grant execute on function public.create_club(text, public.governance_threshold_kind, text, text) to authenticated;
