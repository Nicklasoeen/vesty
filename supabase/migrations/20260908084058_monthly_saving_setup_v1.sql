-- Member-attested monthly saving setup for Simple saving.
-- Stores only the caller's confirmation that they set up a Nordnet
-- monthly savings agreement. Never places orders, moves money, or
-- writes Investment Day participation, reports, or purchases.
-- Does not edit earlier migrations.

-- ---------------------------------------------------------------------------
-- Attestation status
-- ---------------------------------------------------------------------------

create type public.monthly_saving_setup_attestation_status as enum (
  'active',
  'ended',
  'replaced'
);

comment on type public.monthly_saving_setup_attestation_status is
  'Lifecycle of a member-attested Nordnet monthly saving setup. Never broker_verified.';

-- ---------------------------------------------------------------------------
-- Member-owned attestation rows
-- ---------------------------------------------------------------------------

create table public.member_monthly_saving_setup_attestations (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null,
  membership_id uuid not null,
  broker public.preferred_broker not null,
  investment_target_id uuid not null
    references public.investment_targets (id) on delete restrict,
  attested_amount_minor bigint not null,
  currency text not null,
  strategy_version_id uuid not null,
  contribution_policy_version_id uuid not null,
  investment_schedule_id uuid not null,
  schedule_revision_number integer not null,
  schedule_day_of_month smallint not null,
  schedule_timezone text not null,
  schedule_missing_day_policy text not null,
  context_fingerprint text not null,
  client_attestation_id uuid not null,
  attestation_kind text not null default 'member_attested',
  status public.monthly_saving_setup_attestation_status not null default 'active',
  attested_at timestamptz not null default now(),
  ended_at timestamptz,

  constraint member_monthly_saving_setup_membership_same_club_fkey
    foreign key (club_id, membership_id)
    references public.club_memberships (club_id, id)
    on delete restrict,
  constraint member_monthly_saving_setup_strategy_same_club_fkey
    foreign key (club_id, strategy_version_id)
    references public.strategy_versions (club_id, id)
    on delete restrict,
  constraint member_monthly_saving_setup_policy_same_club_fkey
    foreign key (club_id, contribution_policy_version_id)
    references public.contribution_policy_versions (club_id, id)
    on delete restrict,
  constraint member_monthly_saving_setup_schedule_same_club_fkey
    foreign key (club_id, investment_schedule_id)
    references public.investment_schedules (club_id, id)
    on delete restrict,
  constraint member_monthly_saving_setup_client_id_key
    unique (membership_id, client_attestation_id),
  constraint member_monthly_saving_setup_broker_check
    check (broker = 'nordnet'),
  constraint member_monthly_saving_setup_amount_check
    check (attested_amount_minor > 0),
  constraint member_monthly_saving_setup_currency_check
    check (currency ~ '^[A-Z]{3}$'),
  constraint member_monthly_saving_setup_fingerprint_check
    check (context_fingerprint ~ '^[0-9a-f]{64}$'),
  constraint member_monthly_saving_setup_kind_check
    check (attestation_kind = 'member_attested'),
  constraint member_monthly_saving_setup_schedule_day_check
    check (schedule_day_of_month between 1 and 31),
  constraint member_monthly_saving_setup_ended_check
    check (
      (
        status = 'active'
        and ended_at is null
      )
      or (
        status in ('ended', 'replaced')
        and ended_at is not null
      )
    )
);

comment on table public.member_monthly_saving_setup_attestations is
  'Caller-owned confirmation that a Nordnet monthly saving agreement was set up. member_attested only. Never broker_verified. Does not record a purchase.';

comment on column public.member_monthly_saving_setup_attestations.client_attestation_id is
  'Client-generated idempotency key. Retry with the same id and derived context is idempotent. A different derived context conflicts.';

comment on column public.member_monthly_saving_setup_attestations.attestation_kind is
  'Always member_attested. Broker verification is out of scope.';

create unique index member_monthly_saving_setup_one_active_idx
  on public.member_monthly_saving_setup_attestations (membership_id)
  where status = 'active';

create index member_monthly_saving_setup_club_idx
  on public.member_monthly_saving_setup_attestations (club_id, membership_id);

alter table public.member_monthly_saving_setup_attestations enable row level security;
alter table public.member_monthly_saving_setup_attestations force row level security;

revoke all on public.member_monthly_saving_setup_attestations from public, anon, authenticated;
grant select on public.member_monthly_saving_setup_attestations to authenticated;

create policy member_monthly_saving_setup_select_self
on public.member_monthly_saving_setup_attestations
for select
to authenticated
using ((select private.owns_active_membership(membership_id)));

-- ---------------------------------------------------------------------------
-- Context fingerprint (fund, amount, currency, schedule identity)
-- ---------------------------------------------------------------------------

create function private.monthly_saving_setup_fingerprint_v1(
  p_broker public.preferred_broker,
  p_investment_target_id uuid,
  p_amount_minor bigint,
  p_currency text,
  p_schedule_id uuid,
  p_schedule_revision integer,
  p_day_of_month smallint,
  p_timezone text,
  p_missing_day_policy text
)
returns text
language sql
immutable
security invoker
set search_path = ''
as $function$
  select pg_catalog.encode(
    pg_catalog.sha256(
      pg_catalog.convert_to(
        coalesce(p_broker::text, '')
          || chr(10)
          || coalesce(p_investment_target_id::text, '')
          || chr(10)
          || coalesce(p_amount_minor::text, '')
          || chr(10)
          || coalesce(p_currency, '')
          || chr(10)
          || coalesce(p_schedule_id::text, '')
          || chr(10)
          || coalesce(p_schedule_revision::text, '')
          || chr(10)
          || coalesce(p_day_of_month::text, '')
          || chr(10)
          || coalesce(p_timezone, '')
          || chr(10)
          || coalesce(p_missing_day_policy, ''),
        'UTF8'
      )
    ),
    'hex'
  );
$function$;

revoke all on function private.monthly_saving_setup_fingerprint_v1(
  public.preferred_broker,
  uuid,
  bigint,
  text,
  uuid,
  integer,
  smallint,
  text,
  text
) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Shared projection. Amount, fund, and schedule come from Vesty data.
-- ---------------------------------------------------------------------------

create function private.monthly_saving_setup_row_v1(
  p_club_id uuid,
  p_membership_id uuid
)
returns table (
  status text,
  provenance text,
  broker text,
  fund_name text,
  isin text,
  recommended_amount_minor bigint,
  currency text,
  recommended_investment_day_at timestamptz,
  schedule_day_of_month smallint,
  monthly_setup_url text,
  one_time_product_url text,
  attested_at timestamptz,
  attested_amount_minor bigint,
  attested_fund_name text,
  attested_schedule_day_of_month smallint,
  amount_changed boolean,
  fund_changed boolean,
  schedule_changed boolean,
  one_time_available boolean
)
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $function$
declare
  v_club public.clubs%rowtype;
  v_policy public.contribution_policy_versions%rowtype;
  v_schedule public.investment_schedules%rowtype;
  v_attestation public.member_monthly_saving_setup_attestations%rowtype;
  v_strategy_id uuid;
  v_allocation_count integer := 0;
  v_target_id uuid;
  v_fund_name text;
  v_isin text;
  v_amount bigint;
  v_one_time_url text;
  v_monthly_url constant text := 'https://www.nordnet.no/monthlysavings/create';
  v_investment_day_at timestamptz;
  v_now timestamptz := pg_catalog.now();
  v_fingerprint text;
  v_ready boolean := false;
  v_attested_fund_name text;
begin
  provenance := 'member_attested';
  amount_changed := false;
  fund_changed := false;
  schedule_changed := false;
  one_time_available := false;

  select *
  into v_club
  from public.clubs as club
  where club.id = p_club_id;

  select *
  into v_policy
  from public.contribution_policy_versions as policy
  where policy.club_id = p_club_id
  order by policy.version_number desc
  limit 1;

  select *
  into v_schedule
  from public.investment_schedules as schedule
  where schedule.club_id = p_club_id
    and schedule.status in ('active', 'paused')
  order by schedule.revision_number desc
  limit 1;

  select version.id
  into v_strategy_id
  from public.strategy_versions as version
  where version.club_id = p_club_id
  order by version.version_number desc
  limit 1;

  select count(*)::integer
  into v_allocation_count
  from public.strategy_allocations as allocation
  where allocation.strategy_version_id = v_strategy_id;

  if v_allocation_count = 1 then
    select
      allocation.investment_target_id,
      coalesce(product.display_name, allocation.target_name, target.name),
      coalesce(allocation.target_isin, target.isin)
    into v_target_id, v_fund_name, v_isin
    from public.strategy_allocations as allocation
    join public.investment_targets as target
      on target.id = allocation.investment_target_id
    left join private.single_fund_products as product
      on product.investment_target_id = allocation.investment_target_id
    where allocation.strategy_version_id = v_strategy_id;
  end if;

  if v_allocation_count = 1 and v_target_id is not null then
    select listing.product_url
    into v_one_time_url
    from private.single_fund_products as product
    join private.single_fund_broker_listings as listing
      on listing.product_id = product.id
     and listing.broker = 'nordnet'
     and listing.is_verified
    where product.investment_target_id = v_target_id
      and product.status = 'active'
      and private.is_allowed_nordnet_handoff_url(listing.product_url);
  end if;

  if v_policy.id is not null then
    v_amount := private.resolve_member_expected_contribution_at_v1(
      v_policy.id,
      p_membership_id,
      v_now
    );
  end if;

  select cycle.investment_day_at
  into v_investment_day_at
  from public.investment_cycles as cycle
  where cycle.club_id = p_club_id
    and cycle.status <> 'cancelled'
    and cycle.reporting_opens_at <= v_now
    and v_now < cycle.reporting_closes_at
  order by cycle.investment_day_at desc, cycle.id desc
  limit 1;

  if v_investment_day_at is null then
    select cycle.investment_day_at
    into v_investment_day_at
    from public.investment_cycles as cycle
    where cycle.club_id = p_club_id
      and cycle.status <> 'cancelled'
      and v_now < cycle.reporting_opens_at
    order by cycle.reporting_opens_at, cycle.id
    limit 1;
  end if;

  if v_investment_day_at is null then
    select cycle.investment_day_at
    into v_investment_day_at
    from public.investment_cycles as cycle
    where cycle.club_id = p_club_id
      and cycle.status <> 'cancelled'
      and cycle.reporting_closes_at <= v_now
    order by cycle.investment_day_at desc, cycle.id desc
    limit 1;
  end if;

  select *
  into v_attestation
  from public.member_monthly_saving_setup_attestations as attestation
  where attestation.membership_id = p_membership_id
    and attestation.club_id = p_club_id
    and attestation.status = 'active'
  order by attestation.attested_at desc
  limit 1;

  if v_attestation.investment_target_id is not null then
    select coalesce(product.display_name, target.name)
    into v_attested_fund_name
    from public.investment_targets as target
    left join private.single_fund_products as product
      on product.investment_target_id = target.id
    where target.id = v_attestation.investment_target_id;
  end if;

  v_ready :=
    v_club.investment_mode = 'single_fund'
    and v_allocation_count = 1
    and v_target_id is not null
    and v_schedule.id is not null
    and v_strategy_id is not null
    and v_policy.id is not null
    and private.is_allowed_nordnet_handoff_url(v_monthly_url)
    and v_one_time_url is not null;

  fund_name := case when v_allocation_count = 1 then v_fund_name else null end;
  isin := case when v_allocation_count = 1 then v_isin else null end;
  recommended_amount_minor := v_amount;
  currency := coalesce(v_policy.currency, v_club.base_currency);
  recommended_investment_day_at := v_investment_day_at;
  schedule_day_of_month := v_schedule.day_of_month;
  monthly_setup_url := case when v_ready then v_monthly_url else null end;
  one_time_product_url := v_one_time_url;
  one_time_available := v_one_time_url is not null;
  broker := case when v_ready then 'nordnet' else null end;

  if v_attestation.id is not null then
    attested_at := v_attestation.attested_at;
    attested_amount_minor := v_attestation.attested_amount_minor;
    attested_fund_name := v_attested_fund_name;
    attested_schedule_day_of_month := v_attestation.schedule_day_of_month;
    fund_changed := v_attestation.investment_target_id is distinct from v_target_id;
    amount_changed :=
      v_attestation.attested_amount_minor is distinct from v_amount
      or v_attestation.currency is distinct from coalesce(v_policy.currency, v_club.base_currency);
    schedule_changed :=
      v_attestation.investment_schedule_id is distinct from v_schedule.id
      or v_attestation.schedule_revision_number is distinct from v_schedule.revision_number
      or v_attestation.schedule_day_of_month is distinct from v_schedule.day_of_month
      or v_attestation.schedule_timezone is distinct from v_schedule.timezone
      or v_attestation.schedule_missing_day_policy is distinct from v_schedule.missing_day_policy;
  end if;

  if not v_ready then
    status := 'unavailable';
    monthly_setup_url := null;
    broker := null;
    return next;
    return;
  end if;

  if v_amount is null then
    status := 'setup_required';
    return next;
    return;
  end if;

  if v_attestation.id is null then
    status := 'not_set_up';
    return next;
    return;
  end if;

  v_fingerprint := private.monthly_saving_setup_fingerprint_v1(
    'nordnet'::public.preferred_broker,
    v_target_id,
    v_amount,
    coalesce(v_policy.currency, v_club.base_currency),
    v_schedule.id,
    v_schedule.revision_number,
    v_schedule.day_of_month,
    v_schedule.timezone,
    v_schedule.missing_day_policy
  );

  if v_attestation.context_fingerprint = v_fingerprint then
    status := 'current';
  else
    status := 'needs_update';
  end if;

  return next;
end;
$function$;

revoke all on function private.monthly_saving_setup_row_v1(uuid, uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Read
-- ---------------------------------------------------------------------------

create function private.monthly_saving_setup_v1(p_club_id uuid)
returns table (
  status text,
  provenance text,
  broker text,
  fund_name text,
  isin text,
  recommended_amount_minor bigint,
  currency text,
  recommended_investment_day_at timestamptz,
  schedule_day_of_month smallint,
  monthly_setup_url text,
  one_time_product_url text,
  attested_at timestamptz,
  attested_amount_minor bigint,
  attested_fund_name text,
  attested_schedule_day_of_month smallint,
  amount_changed boolean,
  fund_changed boolean,
  schedule_changed boolean,
  one_time_available boolean
)
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $function$
declare
  v_user_id uuid;
  v_membership_id uuid;
begin
  v_user_id := private.require_authenticated_profile_id();

  if p_club_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.not_club_member';
  end if;

  if not exists (
    select 1
    from public.clubs as club
    where club.id = p_club_id
      and club.status = 'active'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.not_club_member';
  end if;

  select membership.id
  into v_membership_id
  from public.club_memberships as membership
  where membership.club_id = p_club_id
    and membership.profile_id = v_user_id
    and membership.status = 'active';

  if v_membership_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.not_club_member';
  end if;

  return query
  select *
  from private.monthly_saving_setup_row_v1(p_club_id, v_membership_id);
end;
$function$;

comment on function private.monthly_saving_setup_v1(uuid) is
  'Read the caller''s monthly saving setup and the current recommended Nordnet context. Does not require a frozen cycle. Never writes.';

revoke all on function private.monthly_saving_setup_v1(uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Confirm I've set it up
-- ---------------------------------------------------------------------------

create function private.confirm_monthly_saving_setup_v1(
  p_club_id uuid,
  p_client_attestation_id uuid
)
returns table (
  status text,
  provenance text,
  broker text,
  fund_name text,
  isin text,
  recommended_amount_minor bigint,
  currency text,
  recommended_investment_day_at timestamptz,
  schedule_day_of_month smallint,
  monthly_setup_url text,
  one_time_product_url text,
  attested_at timestamptz,
  attested_amount_minor bigint,
  attested_fund_name text,
  attested_schedule_day_of_month smallint,
  amount_changed boolean,
  fund_changed boolean,
  schedule_changed boolean,
  one_time_available boolean
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
  v_snapshot record;
  v_policy public.contribution_policy_versions%rowtype;
  v_schedule public.investment_schedules%rowtype;
  v_strategy_id uuid;
  v_target_id uuid;
  v_amount bigint;
  v_currency text;
  v_fingerprint text;
  v_existing public.member_monthly_saving_setup_attestations%rowtype;
  v_active public.member_monthly_saving_setup_attestations%rowtype;
begin
  v_user_id := private.require_authenticated_profile_id();

  if p_client_attestation_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.client_attestation_id_invalid';
  end if;

  if p_club_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.not_club_member';
  end if;

  if not exists (
    select 1
    from public.clubs as club
    where club.id = p_club_id
      and club.status = 'active'
  ) then
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
    pg_catalog.hashtextextended(v_membership.id::text, 0)
  );

  select *
  into v_snapshot
  from private.monthly_saving_setup_row_v1(p_club_id, v_membership.id);

  if v_snapshot.status = 'unavailable' then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.monthly_saving_setup_unavailable';
  end if;

  if v_snapshot.status = 'setup_required' then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.monthly_saving_setup_required';
  end if;

  select *
  into v_policy
  from public.contribution_policy_versions as policy
  where policy.club_id = p_club_id
  order by policy.version_number desc
  limit 1;

  select *
  into v_schedule
  from public.investment_schedules as schedule
  where schedule.club_id = p_club_id
    and schedule.status in ('active', 'paused')
  order by schedule.revision_number desc
  limit 1;

  select version.id
  into v_strategy_id
  from public.strategy_versions as version
  where version.club_id = p_club_id
  order by version.version_number desc
  limit 1;

  select allocation.investment_target_id
  into v_target_id
  from public.strategy_allocations as allocation
  where allocation.strategy_version_id = v_strategy_id
  limit 1;

  v_amount := v_snapshot.recommended_amount_minor;
  v_currency := v_snapshot.currency;

  v_fingerprint := private.monthly_saving_setup_fingerprint_v1(
    'nordnet'::public.preferred_broker,
    v_target_id,
    v_amount,
    v_currency,
    v_schedule.id,
    v_schedule.revision_number,
    v_schedule.day_of_month,
    v_schedule.timezone,
    v_schedule.missing_day_policy
  );

  select *
  into v_existing
  from public.member_monthly_saving_setup_attestations as attestation
  where attestation.membership_id = v_membership.id
    and attestation.client_attestation_id = p_client_attestation_id;

  if found then
    if v_existing.context_fingerprint = v_fingerprint and v_existing.status = 'active' then
      return query
      select *
      from private.monthly_saving_setup_row_v1(p_club_id, v_membership.id);
      return;
    end if;

    raise exception using
      errcode = 'P0001',
      message = 'vesty.monthly_saving_setup_conflict';
  end if;

  select *
  into v_active
  from public.member_monthly_saving_setup_attestations as attestation
  where attestation.membership_id = v_membership.id
    and attestation.status = 'active'
  for update;

  if found then
    update public.member_monthly_saving_setup_attestations as attestation
    set
      status = 'replaced',
      ended_at = pg_catalog.now()
    where attestation.id = v_active.id;
  end if;

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
    client_attestation_id,
    attestation_kind,
    status
  )
  values (
    p_club_id,
    v_membership.id,
    'nordnet',
    v_target_id,
    v_amount,
    v_currency,
    v_strategy_id,
    v_policy.id,
    v_schedule.id,
    v_schedule.revision_number,
    v_schedule.day_of_month,
    v_schedule.timezone,
    v_schedule.missing_day_policy,
    v_fingerprint,
    p_client_attestation_id,
    'member_attested',
    'active'
  );

  return query
  select *
  from private.monthly_saving_setup_row_v1(p_club_id, v_membership.id);
end;
$function$;

comment on function private.confirm_monthly_saving_setup_v1(uuid, uuid) is
  'Stores a member_attested Nordnet monthly saving confirmation for the caller. Derives fund, amount, and schedule server-side. Never writes a purchase, participation, or Investment Day report.';

revoke all on function private.confirm_monthly_saving_setup_v1(uuid, uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- End or reset own attestation
-- ---------------------------------------------------------------------------

create function private.end_monthly_saving_setup_v1(p_club_id uuid)
returns table (
  status text,
  provenance text,
  broker text,
  fund_name text,
  isin text,
  recommended_amount_minor bigint,
  currency text,
  recommended_investment_day_at timestamptz,
  schedule_day_of_month smallint,
  monthly_setup_url text,
  one_time_product_url text,
  attested_at timestamptz,
  attested_amount_minor bigint,
  attested_fund_name text,
  attested_schedule_day_of_month smallint,
  amount_changed boolean,
  fund_changed boolean,
  schedule_changed boolean,
  one_time_available boolean
)
language plpgsql
volatile
security definer
set search_path = ''
set row_security = off
as $function$
declare
  v_user_id uuid;
  v_membership_id uuid;
begin
  v_user_id := private.require_authenticated_profile_id();

  if p_club_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.not_club_member';
  end if;

  if not exists (
    select 1
    from public.clubs as club
    where club.id = p_club_id
      and club.status = 'active'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.not_club_member';
  end if;

  select membership.id
  into v_membership_id
  from public.club_memberships as membership
  where membership.club_id = p_club_id
    and membership.profile_id = v_user_id
    and membership.status = 'active';

  if v_membership_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.not_club_member';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_membership_id::text, 0)
  );

  update public.member_monthly_saving_setup_attestations as attestation
  set
    status = 'ended',
    ended_at = pg_catalog.now()
  where attestation.membership_id = v_membership_id
    and attestation.club_id = p_club_id
    and attestation.status = 'active';

  return query
  select *
  from private.monthly_saving_setup_row_v1(p_club_id, v_membership_id);
end;
$function$;

comment on function private.end_monthly_saving_setup_v1(uuid) is
  'Ends the caller''s active monthly saving attestation. Historical rows and Investment Day data are kept.';

revoke all on function private.end_monthly_saving_setup_v1(uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Public wrappers
-- ---------------------------------------------------------------------------

create function public.monthly_saving_setup_v1(p_club_id uuid)
returns table (
  status text,
  provenance text,
  broker text,
  fund_name text,
  isin text,
  recommended_amount_minor bigint,
  currency text,
  recommended_investment_day_at timestamptz,
  schedule_day_of_month smallint,
  monthly_setup_url text,
  one_time_product_url text,
  attested_at timestamptz,
  attested_amount_minor bigint,
  attested_fund_name text,
  attested_schedule_day_of_month smallint,
  amount_changed boolean,
  fund_changed boolean,
  schedule_changed boolean,
  one_time_available boolean
)
language sql
stable
security definer
set search_path = ''
set row_security = off
as $function$
  select *
  from private.monthly_saving_setup_v1(p_club_id);
$function$;

comment on function public.monthly_saving_setup_v1(uuid) is
  'Authenticated read of the caller''s monthly saving setup and recommended Nordnet context. Available before the first cycle freeze. Returns only the caller''s own setup. Never writes.';

create function public.confirm_monthly_saving_setup_v1(
  p_club_id uuid,
  p_client_attestation_id uuid
)
returns table (
  status text,
  provenance text,
  broker text,
  fund_name text,
  isin text,
  recommended_amount_minor bigint,
  currency text,
  recommended_investment_day_at timestamptz,
  schedule_day_of_month smallint,
  monthly_setup_url text,
  one_time_product_url text,
  attested_at timestamptz,
  attested_amount_minor bigint,
  attested_fund_name text,
  attested_schedule_day_of_month smallint,
  amount_changed boolean,
  fund_changed boolean,
  schedule_changed boolean,
  one_time_available boolean
)
language sql
volatile
security definer
set search_path = ''
set row_security = off
as $function$
  select *
  from private.confirm_monthly_saving_setup_v1(p_club_id, p_client_attestation_id);
$function$;

comment on function public.confirm_monthly_saving_setup_v1(uuid, uuid) is
  'Caller-only member_attested confirmation that a Nordnet monthly saving agreement was set up. Fund, amount, and schedule are derived on the server. Idempotent on client_attestation_id.';

create function public.end_monthly_saving_setup_v1(p_club_id uuid)
returns table (
  status text,
  provenance text,
  broker text,
  fund_name text,
  isin text,
  recommended_amount_minor bigint,
  currency text,
  recommended_investment_day_at timestamptz,
  schedule_day_of_month smallint,
  monthly_setup_url text,
  one_time_product_url text,
  attested_at timestamptz,
  attested_amount_minor bigint,
  attested_fund_name text,
  attested_schedule_day_of_month smallint,
  amount_changed boolean,
  fund_changed boolean,
  schedule_changed boolean,
  one_time_available boolean
)
language sql
volatile
security definer
set search_path = ''
set row_security = off
as $function$
  select *
  from private.end_monthly_saving_setup_v1(p_club_id);
$function$;

comment on function public.end_monthly_saving_setup_v1(uuid) is
  'Caller-only end of the active monthly saving attestation. Does not delete historical Investment Day rows.';

revoke all on function public.monthly_saving_setup_v1(uuid) from public, anon;
revoke all on function public.confirm_monthly_saving_setup_v1(uuid, uuid) from public, anon;
revoke all on function public.end_monthly_saving_setup_v1(uuid) from public, anon;

grant execute on function public.monthly_saving_setup_v1(uuid) to authenticated;
grant execute on function public.confirm_monthly_saving_setup_v1(uuid, uuid) to authenticated;
grant execute on function public.end_monthly_saving_setup_v1(uuid) to authenticated;

notify pgrst, 'reload schema';
