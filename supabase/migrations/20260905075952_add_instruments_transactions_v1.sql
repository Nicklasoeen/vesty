-- Real instruments + member-reported transactions / positions V1.
--
-- InvestmentTarget is a purchasable product (fund / etf / stock), not a
-- generic exposure category. V1 does not fetch market prices, convert FX,
-- or talk to brokers.
--
-- Currency boundary: instrument.currency is trading/reporting metadata.
-- member_investment_transactions.amount_minor is the member-reported
-- contribution in the club base currency. quantity and unit_price_minor
-- stay null until a future lot/price flow exists. Do not treat a NOK
-- contribution as a foreign-instrument purchase amount.

-- ---------------------------------------------------------------------------
-- Catalog: kind, currency, optional provider symbol
-- ---------------------------------------------------------------------------

alter type public.investment_target_kind add value if not exists 'stock';

alter table public.investment_targets
  add column if not exists currency text;

alter table public.investment_targets
  add column if not exists provider_symbol text;

update public.investment_targets
set currency = 'NOK'
where currency is null;

alter table public.investment_targets
  alter column currency set not null;

alter table public.investment_targets
  drop constraint if exists investment_targets_currency_check;

alter table public.investment_targets
  add constraint investment_targets_currency_check
  check (currency ~ '^[A-Z]{3}$');

alter table public.investment_targets
  drop constraint if exists investment_targets_provider_symbol_check;

alter table public.investment_targets
  add constraint investment_targets_provider_symbol_check
  check (provider_symbol is null or btrim(provider_symbol) <> '');

comment on column public.investment_targets.currency is
  'Instrument trading/reporting currency. Metadata only in V1; not an FX rate and not the transaction amount currency.';

comment on column public.investment_targets.provider_symbol is
  'Optional future market-data/broker symbol. Nullable. Do not invent values.';

comment on column public.investment_targets.isin is
  'Optional verified ISIN. Leave null when the identifier has not been verified in project data.';

-- ---------------------------------------------------------------------------
-- Replace generic exposure fixtures with curated instrument-name fixtures.
-- Same UUIDs so genesis create-club and existing allocations keep working.
-- Tickers GLOBAL/TECH/NORWAY/EM were fabricated and are cleared.
-- ISINs, exchanges, and provider symbols stay null (not fabricated).
-- ---------------------------------------------------------------------------

update public.investment_targets
set
  name = 'KLP AksjeGlobal Indeks P',
  kind = 'fund',
  status = 'active',
  currency = 'NOK',
  isin = null,
  ticker = null,
  exchange = null,
  provider_symbol = null,
  updated_at = now()
where id = '31000000-0000-4000-8000-000000000001';

update public.investment_targets
set
  name = 'DNB Teknologi A',
  kind = 'fund',
  status = 'active',
  currency = 'NOK',
  isin = null,
  ticker = null,
  exchange = null,
  provider_symbol = null,
  updated_at = now()
where id = '31000000-0000-4000-8000-000000000002';

update public.investment_targets
set
  name = 'KLP AksjeNorge Indeks P',
  kind = 'fund',
  status = 'active',
  currency = 'NOK',
  isin = null,
  ticker = null,
  exchange = null,
  provider_symbol = null,
  updated_at = now()
where id = '31000000-0000-4000-8000-000000000003';

update public.investment_targets
set
  name = 'KLP AksjeFremvoksende Markeder P',
  kind = 'fund',
  status = 'active',
  currency = 'NOK',
  isin = null,
  ticker = null,
  exchange = null,
  provider_symbol = null,
  updated_at = now()
where id = '31000000-0000-4000-8000-000000000004';

comment on table public.investment_targets is
  'Vesty-curated investable products (fund, etf, stock). The four 31000000-… rows are TestFlight fixtures with realistic names only; identifiers are intentionally null.';

-- Refresh genesis snapshots that still carry generic category labels / fake tickers.
update public.strategy_allocations as allocation
set
  target_name = target.name,
  target_kind = target.kind,
  target_isin = target.isin,
  target_ticker = target.ticker,
  target_exchange = target.exchange
from public.investment_targets as target
where allocation.investment_target_id = target.id
  and target.id in (
    '31000000-0000-4000-8000-000000000001',
    '31000000-0000-4000-8000-000000000002',
    '31000000-0000-4000-8000-000000000003',
    '31000000-0000-4000-8000-000000000004'
  );

-- ---------------------------------------------------------------------------
-- Transaction enums and table
-- ---------------------------------------------------------------------------

create type public.investment_transaction_type as enum (
  'buy'
);

create type public.investment_transaction_source as enum (
  'manual',
  'broker_sync'
);

create type public.investment_transaction_verification as enum (
  'member_reported',
  'broker_verified'
);

comment on type public.investment_transaction_type is
  'V1 writes buy only. sell may be added later without changing buy semantics.';

comment on type public.investment_transaction_source is
  'V1 writes manual. broker_sync is reserved; manual is never treated as broker-verified.';

comment on type public.investment_transaction_verification is
  'V1 writes member_reported. broker_verified is reserved for a future evidence path.';

create table public.member_investment_transactions (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null,
  membership_id uuid not null,
  investment_cycle_id uuid not null,
  investment_target_id uuid not null references public.investment_targets (id) on delete restrict,
  transaction_type public.investment_transaction_type not null,
  amount_minor bigint not null,
  currency text not null,
  quantity numeric(28, 8),
  unit_price_minor bigint,
  executed_at timestamptz not null,
  reported_at timestamptz not null default now(),
  source public.investment_transaction_source not null,
  verification_status public.investment_transaction_verification not null,
  created_at timestamptz not null default now(),

  constraint member_investment_transactions_membership_same_club_fkey
    foreign key (club_id, membership_id)
    references public.club_memberships (club_id, id)
    on delete restrict,
  constraint member_investment_transactions_cycle_same_club_fkey
    foreign key (club_id, investment_cycle_id)
    references public.investment_cycles (club_id, id)
    on delete restrict,
  constraint member_investment_transactions_cycle_target_type_key
    unique (membership_id, investment_cycle_id, investment_target_id, transaction_type),
  constraint member_investment_transactions_amount_check
    check (amount_minor > 0),
  constraint member_investment_transactions_currency_check
    check (currency ~ '^[A-Z]{3}$'),
  constraint member_investment_transactions_quantity_check
    check (quantity is null or quantity > 0),
  constraint member_investment_transactions_unit_price_check
    check (unit_price_minor is null or unit_price_minor > 0),
  constraint member_investment_transactions_lot_pair_check
    check (
      (quantity is null and unit_price_minor is null)
      or (quantity is not null and unit_price_minor is not null)
    ),
  constraint member_investment_transactions_reported_at_check
    check (reported_at >= created_at or reported_at >= executed_at)
);

comment on table public.member_investment_transactions is
  'Member-reported investment events. V1 Investment Day writes one buy per membership/cycle/target. Amount is club-base-currency contribution; quantity and unit_price_minor are not fabricated from amount.';

comment on column public.member_investment_transactions.amount_minor is
  'Positive integer minor units of currency (øre for NOK). Reported contribution, not a live market value.';

comment on column public.member_investment_transactions.quantity is
  'Optional instrument units. Null in V1 amount-only reports. Never derived from amount.';

comment on column public.member_investment_transactions.unit_price_minor is
  'Optional unit price in minor units. Null in V1. Never derived from amount.';

create index member_investment_transactions_membership_cycle_idx
  on public.member_investment_transactions (membership_id, investment_cycle_id);

create index member_investment_transactions_club_target_idx
  on public.member_investment_transactions (club_id, investment_target_id);

create function private.member_investment_transaction_target_in_strategy()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if not exists (
    select 1
    from public.investment_cycles as cycle
    join public.strategy_allocations as allocation
      on allocation.strategy_version_id = cycle.strategy_version_id
    where cycle.id = new.investment_cycle_id
      and cycle.club_id = new.club_id
      and allocation.investment_target_id = new.investment_target_id
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.invalid_target';
  end if;

  return new;
end;
$function$;

create trigger member_investment_transactions_target_in_strategy
before insert on public.member_investment_transactions
for each row
execute function private.member_investment_transaction_target_in_strategy();

-- ---------------------------------------------------------------------------
-- RLS: own reads only. Trusted RPC writes. No client insert/update/delete.
-- ---------------------------------------------------------------------------

alter table public.member_investment_transactions enable row level security;
alter table public.member_investment_transactions force row level security;

revoke all on public.member_investment_transactions from public, anon, authenticated;
grant select on public.member_investment_transactions to authenticated;

create policy member_investment_transactions_select_self
on public.member_investment_transactions
for select
to authenticated
using ((select private.owns_active_membership(membership_id)));

-- ---------------------------------------------------------------------------
-- Own positions: derived cost basis. No market value.
-- security_invoker so underlying transaction RLS applies.
-- ---------------------------------------------------------------------------

create view public.member_investment_positions
with (security_invoker = true)
as
select
  transaction.membership_id,
  transaction.club_id,
  transaction.investment_target_id,
  transaction.currency,
  pg_catalog.sum(transaction.amount_minor) as total_invested_minor,
  pg_catalog.sum(transaction.quantity) as total_quantity
from public.member_investment_transactions as transaction
where transaction.transaction_type = 'buy'
group by
  transaction.membership_id,
  transaction.club_id,
  transaction.investment_target_id,
  transaction.currency;

comment on view public.member_investment_positions is
  'Derived own cost basis from member-reported buy transactions. No current market value. Readable only where the underlying transactions are readable (own active membership).';

revoke all on public.member_investment_positions from public, anon, authenticated;
grant select on public.member_investment_positions to authenticated;

-- ---------------------------------------------------------------------------
-- Integer allocation: largest remainder, tie-break by strategy position.
-- Rows always sum exactly to p_total_minor.
-- ---------------------------------------------------------------------------

create function private.allocate_minor_by_bps(
  p_total_minor bigint,
  p_lines jsonb
)
returns table (
  investment_target_id uuid,
  allocation_bps integer,
  display_position integer,
  amount_minor bigint
)
language plpgsql
immutable
security invoker
set search_path = ''
as $function$
declare
  v_line jsonb;
  v_n integer := 0;
  v_ids uuid[] := '{}';
  v_bps integer[] := '{}';
  v_pos integer[] := '{}';
  v_amt bigint[] := '{}';
  v_rem integer[] := '{}';
  v_sum bigint := 0;
  v_leftover bigint;
  v_order integer[] := '{}';
  v_i integer;
  v_idx integer;
  v_exact bigint;
begin
  if p_total_minor is null or p_total_minor <= 0 then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.amount_invalid';
  end if;

  if p_lines is null or pg_catalog.jsonb_typeof(p_lines) <> 'array' then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.invalid_allocations';
  end if;

  for v_line in
    select value
    from pg_catalog.jsonb_array_elements(p_lines) as elements(value)
  loop
    v_n := v_n + 1;
    v_ids := pg_catalog.array_append(v_ids, (v_line->>'investment_target_id')::uuid);
    v_bps := pg_catalog.array_append(v_bps, (v_line->>'allocation_bps')::integer);
    v_pos := pg_catalog.array_append(v_pos, (v_line->>'position')::integer);
    v_exact := p_total_minor * (v_line->>'allocation_bps')::bigint;
    v_amt := pg_catalog.array_append(v_amt, v_exact / 10000);
    v_rem := pg_catalog.array_append(v_rem, (v_exact % 10000)::integer);
    v_sum := v_sum + (v_exact / 10000);
  end loop;

  if v_n = 0 then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.strategy_missing';
  end if;

  select coalesce(pg_catalog.array_agg(idx order by v_rem[idx] desc, v_pos[idx] asc), '{}')
  into v_order
  from pg_catalog.generate_series(1, v_n) as idx;

  v_leftover := p_total_minor - v_sum;
  v_i := 1;

  while v_leftover > 0 loop
    v_idx := v_order[((v_i - 1) % v_n) + 1];
    v_amt[v_idx] := v_amt[v_idx] + 1;
    v_leftover := v_leftover - 1;
    v_i := v_i + 1;
  end loop;

  for v_i in 1..v_n loop
    investment_target_id := v_ids[v_i];
    allocation_bps := v_bps[v_i];
    display_position := v_pos[v_i];
    amount_minor := v_amt[v_i];
    return next;
  end loop;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Shared Investment Day plan projection
-- ---------------------------------------------------------------------------

create function private.investment_day_plan_v1(
  p_club_id uuid,
  p_membership_id uuid,
  p_cycle_id uuid
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
stable
security definer
set search_path = ''
as $function$
declare
  v_club public.clubs%rowtype;
  v_cycle public.investment_cycles%rowtype;
  v_participation public.member_cycle_participations%rowtype;
  v_lines jsonb;
  v_allocations jsonb;
  v_transactions jsonb;
begin
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
    and participation.membership_id = p_membership_id
    and participation.club_id = p_club_id;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.cycle_invalid';
  end if;

  select pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'investment_target_id', allocation.investment_target_id,
      'allocation_bps', allocation.allocation_bps,
      'position', allocation.position
    )
    order by allocation.position
  )
  into v_lines
  from public.strategy_allocations as allocation
  where allocation.strategy_version_id = v_cycle.strategy_version_id;

  if v_lines is null then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.strategy_missing';
  end if;

  select pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'investment_target_id', allocated.investment_target_id,
      'name', allocation.target_name,
      'kind', allocation.target_kind,
      'instrument_currency', target.currency,
      'allocation_bps', allocated.allocation_bps,
      'position', allocated.display_position,
      'amount_minor', allocated.amount_minor
    )
    order by allocated.display_position
  )
  into v_allocations
  from private.allocate_minor_by_bps(
    v_participation.expected_amount_minor,
    v_lines
  ) as allocated
  join public.strategy_allocations as allocation
    on allocation.strategy_version_id = v_cycle.strategy_version_id
   and allocation.investment_target_id = allocated.investment_target_id
  join public.investment_targets as target
    on target.id = allocated.investment_target_id;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', transaction.id,
        'investment_target_id', transaction.investment_target_id,
        'amount_minor', transaction.amount_minor,
        'currency', transaction.currency,
        'transaction_type', transaction.transaction_type,
        'source', transaction.source,
        'verification_status', transaction.verification_status,
        'quantity', transaction.quantity,
        'unit_price_minor', transaction.unit_price_minor,
        'executed_at', transaction.executed_at,
        'reported_at', transaction.reported_at
      )
      order by transaction.created_at
    ),
    '[]'::jsonb
  )
  into v_transactions
  from public.member_investment_transactions as transaction
  where transaction.membership_id = p_membership_id
    and transaction.investment_cycle_id = p_cycle_id
    and transaction.club_id = p_club_id;

  club_id := v_club.id;
  club_name := v_club.name;
  membership_id := p_membership_id;
  cycle_id := v_cycle.id;
  investment_day_at := v_cycle.investment_day_at;
  cycle_status := v_cycle.status;
  participation_id := v_participation.id;
  participation_outcome := v_participation.outcome;
  expected_amount_minor := v_participation.expected_amount_minor;
  currency := v_participation.currency;
  allocations := v_allocations;
  transactions := v_transactions;
  return next;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Open (or reuse) the current TestFlight Investment Day for the caller.
-- Creates schedule / open cycle / default saving plan / participation when
-- missing. Does not write transactions.
-- ---------------------------------------------------------------------------

create function private.ensure_open_investment_day_v1(p_club_id uuid)
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
  v_strategy_id uuid;
  v_occurrence text;
  v_timezone text := 'Europe/Oslo';
  v_investment_day timestamptz;
  v_default_amount constant bigint := 200000;
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
  into v_plan
  from public.member_saving_plans as plan
  where plan.membership_id = v_membership.id
    and plan.club_id = p_club_id
    and plan.status = 'active'
  order by plan.active_from desc
  limit 1;

  if not found then
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
      v_default_amount,
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
    v_plan.amount_minor,
    v_club.base_currency
  )
  on conflict on constraint member_cycle_participations_cycle_membership_key do nothing;

  return query
  select *
  from private.investment_day_plan_v1(p_club_id, v_membership.id, v_cycle.id);
end;
$function$;

-- ---------------------------------------------------------------------------
-- Atomic Investment Day confirm: insert missing buys, mark participation.
-- Idempotent on membership + cycle + target + buy.
-- ---------------------------------------------------------------------------

create function private.confirm_investment_day_v1(
  p_club_id uuid,
  p_cycle_id uuid
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
as $function$
declare
  v_user_id uuid;
  v_membership public.club_memberships%rowtype;
  v_club public.clubs%rowtype;
  v_cycle public.investment_cycles%rowtype;
  v_participation public.member_cycle_participations%rowtype;
  v_lines jsonb;
  v_now timestamptz := pg_catalog.now();
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
    and participation.club_id = p_club_id;

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

  if v_participation.outcome = 'confirmed' then
    return query
    select *
    from private.investment_day_plan_v1(p_club_id, v_membership.id, p_cycle_id);
    return;
  end if;

  if v_cycle.status <> 'open' then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.cycle_not_open';
  end if;

  select pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'investment_target_id', allocation.investment_target_id,
      'allocation_bps', allocation.allocation_bps,
      'position', allocation.position
    )
    order by allocation.position
  )
  into v_lines
  from public.strategy_allocations as allocation
  where allocation.strategy_version_id = v_cycle.strategy_version_id;

  if v_lines is null then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.strategy_missing';
  end if;

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
    executed_at,
    reported_at,
    source,
    verification_status
  )
  select
    p_club_id,
    v_membership.id,
    p_cycle_id,
    allocated.investment_target_id,
    'buy',
    allocated.amount_minor,
    v_club.base_currency,
    null,
    null,
    v_now,
    v_now,
    'manual',
    'member_reported'
  from private.allocate_minor_by_bps(
    v_participation.expected_amount_minor,
    v_lines
  ) as allocated
  where allocated.amount_minor > 0
  on conflict on constraint member_investment_transactions_cycle_target_type_key
  do nothing;

  update public.member_cycle_participations as participation
  set
    outcome = 'confirmed',
    report_source = 'member_reported',
    reported_at = coalesce(participation.reported_at, v_now)
  where participation.id = v_participation.id
    and participation.outcome = 'expected';

  return query
  select *
  from private.investment_day_plan_v1(p_club_id, v_membership.id, p_cycle_id);
end;
$function$;

create function public.ensure_open_investment_day_v1(p_club_id uuid)
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
security invoker
set search_path = ''
as $function$
  select *
  from private.ensure_open_investment_day_v1(p_club_id);
$function$;

create function public.confirm_investment_day_v1(
  p_club_id uuid,
  p_cycle_id uuid
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
security invoker
set search_path = ''
as $function$
  select *
  from private.confirm_investment_day_v1(p_club_id, p_cycle_id);
$function$;

revoke all on function private.allocate_minor_by_bps(bigint, jsonb) from public, anon, authenticated;
revoke all on function private.member_investment_transaction_target_in_strategy() from public, anon, authenticated;
revoke all on function private.investment_day_plan_v1(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function private.ensure_open_investment_day_v1(uuid) from public, anon, authenticated;
revoke all on function private.confirm_investment_day_v1(uuid, uuid) from public, anon, authenticated;
revoke all on function public.ensure_open_investment_day_v1(uuid) from public, anon;
revoke all on function public.confirm_investment_day_v1(uuid, uuid) from public, anon;

grant execute on function private.ensure_open_investment_day_v1(uuid) to authenticated;
grant execute on function private.confirm_investment_day_v1(uuid, uuid) to authenticated;
grant execute on function public.ensure_open_investment_day_v1(uuid) to authenticated;
grant execute on function public.confirm_investment_day_v1(uuid, uuid) to authenticated;
